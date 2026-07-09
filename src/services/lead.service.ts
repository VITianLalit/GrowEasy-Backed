import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { chunkArray, runWithConcurrency } from '../utils/batching';
import { extractBatchWithRetry } from './gemini.service';
import { persistImportRun } from './supabase.service';
import { CrmRecord, ImportSummary, RawRow, SkippedRecord } from '../types/crm.types';

/**
 * Full pipeline: batches raw rows, runs AI extraction with bounded
 * concurrency, aggregates imported vs skipped records, and (optionally)
 * persists the run to Supabase.
 */
export async function processImport(
  headers: string[],
  rows: RawRow[],
  sourceFilename?: string
): Promise<ImportSummary> {
  const importId = uuidv4();
  const batches = chunkArray(rows, env.BATCH_SIZE);

  logger.info('Starting AI import', {
    importId,
    totalRows: rows.length,
    batchCount: batches.length,
    batchSize: env.BATCH_SIZE,
  });

  let failedBatches = 0;
  let cursor = 0;
  const batchStartIndexes = batches.map((b) => {
    const start = cursor;
    cursor += b.length;
    return start;
  });

  const batchResults = await runWithConcurrency(
    batches,
    env.BATCH_CONCURRENCY,
    async (batchRows, i) => {
      const result = await extractBatchWithRetry(headers, batchRows, batchStartIndexes[i]);
      if (result.failed) failedBatches++;
      return result;
    }
  );

  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const batchIdx = Math.floor(i / env.BATCH_SIZE);
    const entry = batchResults[batchIdx]?.results.get(i);

    if (!entry) {
      skipped.push({ original_row_index: i, reason: 'Internal error: no AI result mapped', raw_row: rows[i] });
      continue;
    }

    if (entry.skip) {
      skipped.push({
        original_row_index: i,
        reason: entry.reason ?? 'Skipped',
        raw_row: rows[i],
      });
    } else {
      imported.push(entry.record);
    }
  }

  const summary: ImportSummary = {
    importId,
    totalRows: rows.length,
    totalImported: imported.length,
    totalSkipped: skipped.length,
    imported,
    skipped,
    batches: { total: batches.length, failed: failedBatches },
    persisted: false,
  };

  try {
    summary.persisted = await persistImportRun(summary, sourceFilename);
  } catch (err) {
    logger.error('Failed to persist import run (continuing without persistence)', {
      importId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('Import complete', {
    importId,
    totalImported: imported.length,
    totalSkipped: skipped.length,
    failedBatches,
  });

  return summary;
}
