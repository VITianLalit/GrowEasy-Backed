import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES, RawRow } from '../types/crm.types';

/**
 * Builds the extraction prompt for a single batch of raw CSV rows.
 * The prompt is intentionally explicit and rule-heavy: the challenge in this
 * assignment is *robust field mapping across arbitrary, messy CSV schemas*,
 * not the extraction call itself.
 */
export function buildExtractionPrompt(headers: string[], rows: RawRow[], batchStartIndex: number): string {
  const statusList = CRM_STATUS_VALUES.join(', ');
  const sourceList = DATA_SOURCE_VALUES.join(', ');

  const numberedRows = rows
    .map((row, i) => `Row ${batchStartIndex + i}: ${JSON.stringify(row)}`)
    .join('\n');

  return `You are a data-mapping engine for GrowEasy CRM's AI-powered CSV importer.

You will be given raw rows from an arbitrary CSV export (Facebook Lead Ads, Google Ads, Excel exports, real-estate CRM exports, sales reports, manually created spreadsheets, etc). Column names, order, and structure are NOT fixed and may be messy, abbreviated, misspelled, or in a different language. Your job is to intelligently map each row's available fields into the canonical GrowEasy CRM schema below.

SOURCE CSV HEADERS (verbatim, in original order):
${JSON.stringify(headers)}

CANONICAL CRM FIELDS TO PRODUCE FOR EACH ROW:
- created_at: lead creation date/time. Must be a value parseable by JavaScript's "new Date(value)". Prefer ISO 8601 ("YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"). If no usable date exists in the row, leave it null — do NOT invent a date.
- name: the lead's full name.
- email: the lead's PRIMARY email address only (see multi-value rule below).
- country_code: phone country calling code, formatted like "+91". Infer from context (e.g. a 10-digit Indian mobile with no explicit code can be assumed "+91" only if other rows/columns strongly imply an Indian source; otherwise leave null rather than guessing).
- mobile_without_country_code: the lead's PRIMARY mobile number, digits only, WITHOUT the country code and without spaces/dashes.
- company: company / organization name.
- city: city.
- state: state / province.
- country: country.
- lead_owner: the sales rep / agent / owner assigned to this lead (often an email or name).
- crm_status: MUST be exactly one of: ${statusList}. If nothing in the row confidently maps to one of these, leave it as an empty string "". Never invent a value outside this list.
- crm_note: free-text notes. Use this field for: remarks, follow-up notes, additional comments, EXTRA phone numbers beyond the primary one, EXTRA email addresses beyond the primary one, and any other useful information from the row that doesn't fit a canonical field. Combine multiple such pieces of info into one readable note.
- data_source: MUST be exactly one of: ${sourceList}. If none match confidently, leave it as an empty string "". Never invent a value outside this list.
- possession_time: property possession time / date, if this is real-estate related data. Otherwise null.
- description: any additional free-text description of the lead that isn't better suited to crm_note.

CRITICAL RULES:
1. Allowed crm_status values are EXACTLY: ${statusList}. Leave "" if unsure — never guess or output any other string.
2. Allowed data_source values are EXACTLY: ${sourceList}. Leave "" if unsure — never guess or output any other string.
3. created_at must be directly usable by JavaScript's Date constructor, or null.
4. If a row contains MULTIPLE email addresses: use the first as "email", and append the rest into "crm_note" (e.g. "Additional email: x@y.com").
5. If a row contains MULTIPLE phone/mobile numbers: use the first as "mobile_without_country_code", and append the rest into "crm_note" (e.g. "Additional phone: 9998887777").
6. SKIP RULE: if a row has NEITHER a usable email NOR a usable mobile number, set "skip": true and provide a short "skip_reason" (e.g. "No email or mobile number present"). Still return the row (with skip=true) rather than omitting it — every input row must have exactly one corresponding output object.
7. Never fabricate data. If a field cannot be confidently determined from the row, use null (or "" for the two enum fields specifically).
8. Preserve the exact "original_row_index" given for each row so results can be matched back to the source.
9. Keep every value a plain string/number/boolean/null — never nested objects or arrays. Escape internal newlines as "\\n" so each record stays a single logical value.

ROWS TO PROCESS (do not skip any, do not reorder):
${numberedRows}

Return your answer using the provided JSON schema only.`;
}
