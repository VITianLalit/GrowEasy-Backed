import { Router } from 'express';
import csvRoutes from './csv.routes';
import importRoutes from './import.routes';
import { isSupabaseConfigured } from '../config/env';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    persistence: isSupabaseConfigured ? 'supabase' : 'stateless',
    timestamp: new Date().toISOString(),
  });
});

router.use('/csv', csvRoutes);
router.use('/leads', importRoutes);

export default router;
