import { Router } from 'express';
import { csvUpload } from '../middleware/upload.middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { getImport, importLeads } from '../controllers/import.controller';

const router = Router();

router.post('/import', csvUpload.single('file'), asyncHandler(importLeads));
router.get('/imports/:importId', asyncHandler(getImport));

export default router;
