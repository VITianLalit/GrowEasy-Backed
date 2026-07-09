import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',

  GEMINI_API_KEY: requireEnv('GEMINI_API_KEY'),
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',

  BATCH_SIZE: parseInt(process.env.BATCH_SIZE ?? '15', 10),
  BATCH_CONCURRENCY: parseInt(process.env.BATCH_CONCURRENCY ?? '3', 10),
  BATCH_MAX_RETRIES: parseInt(process.env.BATCH_MAX_RETRIES ?? '3', 10),

  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB ?? '5', 10),

  SUPABASE_URL: optionalEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
} as const;

export const isSupabaseConfigured = Boolean(
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
);
