import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the maximum allowed size.' : err.message;
    logger.warn('Multer upload error', { code: err.code, message });
    return res.status(400).json({ success: false, error: message });
  }

  if (err instanceof AppError) {
    logger.warn('Handled application error', { message: err.message, statusCode: err.statusCode });
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error('Unhandled error', { message, stack: err instanceof Error ? err.stack : undefined });

  return res.status(500).json({
    success: false,
    error: 'Internal server error. Please try again.',
  });
}
