import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { parseCsvBuffer } from '../services/csv.service';
import { processImport } from '../services/lead.service';
import { getImportRun } from '../services/supabase.service';

/**
 * POST /api/leads/import
 * The single endpoint the frontend calls after the user clicks "Confirm".
 * Runs the full backend pipeline: accept upload -> parse CSV -> AI batch
 * extraction -> return structured CRM JSON.
 */
export async function importLeads(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError('No file uploaded. Attach a CSV file under the "file" field.', 400);
  }

  const { headers, rows } = parseCsvBuffer(req.file.buffer);
  const summary = await processImport(headers, rows, req.file.originalname);

  res.status(200).json({
    success: true,
    data: summary,
  });
}

/**
 * GET /api/leads/imports/:importId
 * Fetch a previously persisted import run (only available if Supabase is
 * configured).
 */
export async function getImport(req: Request, res: Response) {
  const { importId } = req.params;
  const result = await getImportRun(importId);

  if (!result) {
    throw new AppError(
      'Import run not found. It may not exist, or Supabase persistence is not configured.',
      404
    );
  }

  res.status(200).json({ success: true, data: result });
}
