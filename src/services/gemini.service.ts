import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { sleep } from '../utils/batching';
import {
  AiExtractedRecord,
  CRM_STATUS_VALUES,
  CrmRecord,
  DATA_SOURCE_VALUES,
  RawRow,
} from '../types/crm.types';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    records: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          original_row_index: { type: SchemaType.NUMBER },
          skip: { type: SchemaType.BOOLEAN },
          skip_reason: { type: SchemaType.STRING, nullable: true },
          created_at: { type: SchemaType.STRING, nullable: true },
          name: { type: SchemaType.STRING, nullable: true },
          email: { type: SchemaType.STRING, nullable: true },
          country_code: { type: SchemaType.STRING, nullable: true },
          mobile_without_country_code: { type: SchemaType.STRING, nullable: true },
          company: { type: SchemaType.STRING, nullable: true },
          city: { type: SchemaType.STRING, nullable: true },
          state: { type: SchemaType.STRING, nullable: true },
          country: { type: SchemaType.STRING, nullable: true },
          lead_owner: { type: SchemaType.STRING, nullable: true },
          crm_status: { type: SchemaType.STRING, nullable: true },
          crm_note: { type: SchemaType.STRING, nullable: true },
          data_source: { type: SchemaType.STRING, nullable: true },
          possession_time: { type: SchemaType.STRING, nullable: true },
          description: { type: SchemaType.STRING, nullable: true },
        },
        required: ['original_row_index', 'skip'],
      },
    },
  },
  required: ['records'],
} as const;

const model = genAI.getGenerativeModel({
  model: env.GEMINI_MODEL,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: responseSchema as never,
    temperature: 0.1,
  },
});

const VALID_STATUSES = new Set<string>(CRM_STATUS_VALUES);
const VALID_SOURCES = new Set<string>(DATA_SOURCE_VALUES);

function isParseableDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return !Number.isNaN(t);
}

/** Enforces enum whitelists, date validity, and the skip rule server-side —
 * defense in depth on top of the AI's own instruction-following. */
function normalize(raw: AiExtractedRecord): { record: CrmRecord; skip: boolean; reason?: string } {
  const crm_status = raw.crm_status && VALID_STATUSES.has(raw.crm_status) ? (raw.crm_status as CrmRecord['crm_status']) : '';
  const data_source = raw.data_source && VALID_SOURCES.has(raw.data_source) ? (raw.data_source as CrmRecord['data_source']) : '';
  const created_at = isParseableDate(raw.created_at ?? null) ? (raw.created_at as string) : null;

  const record: CrmRecord = {
    created_at,
    name: raw.name?.trim() || null,
    email: raw.email?.trim() || null,
    country_code: raw.country_code?.trim() || null,
    mobile_without_country_code: raw.mobile_without_country_code?.trim() || null,
    company: raw.company?.trim() || null,
    city: raw.city?.trim() || null,
    state: raw.state?.trim() || null,
    country: raw.country?.trim() || null,
    lead_owner: raw.lead_owner?.trim() || null,
    crm_status,
    crm_note: raw.crm_note?.trim() || null,
    data_source,
    possession_time: raw.possession_time?.trim() || null,
    description: raw.description?.trim() || null,
  };

  const hasEmail = Boolean(record.email);
  const hasMobile = Boolean(record.mobile_without_country_code);

  if (raw.skip || (!hasEmail && !hasMobile)) {
    return {
      record,
      skip: true,
      reason: raw.skip_reason?.trim() || 'Missing both email and mobile number',
    };
  }

  return { record, skip: false };
}

export interface BatchExtractionResult {
  results: Map<number, { record: CrmRecord; skip: boolean; reason?: string }>;
  failed: boolean;
}

/**
 * Sends one batch of rows to Gemini and returns normalized results keyed
 * by original_row_index. Retries with exponential backoff on failure; if
 * all retries are exhausted, every row in the batch is gracefully marked
 * as skipped rather than crashing the whole import.
 */
export async function extractBatchWithRetry(
  headers: string[],
  rows: RawRow[],
  batchStartIndex: number,
  maxRetries: number = env.BATCH_MAX_RETRIES
): Promise<BatchExtractionResult> {
  const { buildExtractionPrompt } = await import('../prompts/extraction.prompt');
  const prompt = buildExtractionPrompt(headers, rows, batchStartIndex);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text) as { records: AiExtractedRecord[] };

      const map = new Map<number, { record: CrmRecord; skip: boolean; reason?: string }>();
      for (const raw of parsed.records ?? []) {
        map.set(raw.original_row_index, normalize(raw));
      }

      // Defensive fill: if the model dropped any row, mark it skipped rather
      // than silently losing data.
      for (let i = 0; i < rows.length; i++) {
        const idx = batchStartIndex + i;
        if (!map.has(idx)) {
          map.set(idx, {
            record: normalize({ original_row_index: idx, skip: true }).record,
            skip: true,
            reason: 'AI did not return a result for this row',
          });
        }
      }

      return { results: map, failed: false };
    } catch (err) {
      lastError = err;
      logger.warn('Gemini batch extraction attempt failed', {
        attempt,
        maxRetries,
        batchStartIndex,
        batchSize: rows.length,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt < maxRetries) {
        await sleep(2 ** attempt * 500); // exponential backoff: 1s, 2s, 4s...
      }
    }
  }

  logger.error('Gemini batch extraction failed after all retries — skipping batch', {
    batchStartIndex,
    batchSize: rows.length,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  const map = new Map<number, { record: CrmRecord; skip: boolean; reason?: string }>();
  rows.forEach((_, i) => {
    const idx = batchStartIndex + i;
    map.set(idx, {
      record: normalize({ original_row_index: idx, skip: true }).record,
      skip: true,
      reason: 'AI extraction failed for this batch after multiple retries',
    });
  });

  return { results: map, failed: true };
}
