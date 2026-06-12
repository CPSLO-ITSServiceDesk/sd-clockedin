import 'dotenv/config';

/**
 * Validates that all required environment variables are present.
 * Call this once at startup, before the server begins listening.
 */
export function loadEnvironment(): void {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

  const missing = requiredVars.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
};
