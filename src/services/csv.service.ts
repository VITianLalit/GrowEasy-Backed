import { parse } from 'csv-parse/sync';
import { AppError } from '../utils/AppError';
import { CsvPreviewResult, RawRow } from '../types/crm.types';

const MAX_ROWS_HARD_CAP = 20000;

/**
 * Parses a raw CSV buffer into headers + records.
 * Column names are NOT assumed to be fixed — whatever headers exist in the
 * uploaded file are preserved verbatim and later handed to the AI for
 * intelligent mapping.
 */
export function parseCsvBuffer(buffer: Buffer): CsvPreviewResult {
  let records: RawRow[];

  try {
    records = parse(buffer, {
      columns: (headerRow: string[]) =>
        headerRow.map((h, idx) => (h && h.trim().length > 0 ? h.trim() : `column_${idx + 1}`)),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as RawRow[];
  } catch (err) {
    throw new AppError('Unable to parse CSV file. Please ensure it is a valid CSV.', 400, {
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  if (records.length === 0) {
    throw new AppError('The uploaded CSV has no data rows.', 400);
  }

  const headers = Object.keys(records[0]);
  const truncated = records.length > MAX_ROWS_HARD_CAP;
  const rows = truncated ? records.slice(0, MAX_ROWS_HARD_CAP) : records;

  return {
    headers,
    rows,
    totalRows: records.length,
    truncated,
  };
}
