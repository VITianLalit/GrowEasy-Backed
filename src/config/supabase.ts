import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';
import { logger } from '../utils/logger';

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false },
  });
  logger.info('Supabase persistence enabled');
} else {
  logger.warn(
    'Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). ' +
      'Running in stateless mode — import history will not be persisted.'
  );
}

export const supabase = client;
