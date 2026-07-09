import { supabase } from '../config/supabase';
import { isSupabaseConfigured } from '../config/env';
import { logger } from '../utils/logger';
import { ImportSummary } from '../types/crm.types';

/**
 * Persists an import run + its leads to Supabase, if configured.
 * The app is fully functional (stateless) without Supabase — this is
 * best-effort persistence for import history / audit purposes.
 */
export async function persistImportRun(summary: ImportSummary, sourceFilename?: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error: runError } = await supabase.from('import_runs').insert({
    id: summary.importId,
    source_filename: sourceFilename ?? null,
    total_rows: summary.totalRows,
    total_imported: summary.totalImported,
    total_skipped: summary.totalSkipped,
    failed_batches: summary.batches.failed,
  });

  if (runError) {
    logger.error('Supabase: failed to insert import_run', { error: runError.message });
    return false;
  }

  const leadRows = summary.imported.map((record) => ({
    import_run_id: summary.importId,
    ...record,
    skipped: false,
  }));

  const skippedRows = summary.skipped.map((s) => ({
    import_run_id: summary.importId,
    skipped: true,
    skip_reason: s.reason,
    raw_row: s.raw_row,
  }));

  const allRows = [...leadRows, ...skippedRows];
  if (allRows.length > 0) {
    const { error: leadsError } = await supabase.from('leads').insert(allRows);
    if (leadsError) {
      logger.error('Supabase: failed to insert leads', { error: leadsError.message });
      return false;
    }
  }

  return true;
}

export async function getImportRun(importId: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: run, error: runError } = await supabase
    .from('import_runs')
    .select('*')
    .eq('id', importId)
    .single();

  if (runError || !run) return null;

  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .eq('import_run_id', importId);

  if (leadsError) return { run, leads: [] };

  return { run, leads };
}
