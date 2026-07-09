import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { parseCsvBuffer } from '../services/csv.service';

/**
 * POST /api/csv/preview
 * Accepts a CSV upload and parses it — no AI processing happens here.
 * Optional convenience endpoint the frontend can use for its Step 2 preview
 * table instead of (or in addition to) client-side parsing.
 */
export async function previewCsv(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError('No file uploaded. Attach a CSV file under the "file" field.', 400);
  }

  const { headers, rows, totalRows, truncated } = parseCsvBuffer(req.file.buffer);

  res.status(200).json({
    success: true,
    data: {
      headers,
      rows,
      totalRows,
      truncated,
    },
  });
}
