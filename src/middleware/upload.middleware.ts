import multer from 'multer';
import { Request } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain', // some browsers/OSes report CSV as text/plain
]);

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const isCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
  const isCsvMime = CSV_MIME_TYPES.has(file.mimetype);

  if (!isCsvExtension && !isCsvMime) {
    return cb(new AppError('Only .csv files are supported.', 400));
  }
  cb(null, true);
}

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter,
});
