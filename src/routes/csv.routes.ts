import { Router } from 'express';
import { csvUpload } from '../middleware/upload.middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { previewCsv } from '../controllers/csv.controller';

const router = Router();

router.post('/preview', csvUpload.single('file'), asyncHandler(previewCsv));

export default router;
