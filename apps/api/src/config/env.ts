import { z } from 'zod';

/**
 * Parsed once, at import time, before anything else boots. A missing or
 * malformed variable kills the process here with a readable message rather
 * than surfacing as `undefined` inside a request handler at 3am.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Neon pooled connection string)'),
  DIRECT_URL: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required (Upstash rediss:// URL)'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  RESEND_API_KEY: z.string().optional(),
  OTP_FROM_EMAIL: z.string().default('onboarding@resend.dev'),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  OTP_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(5),
  BALL_WRITES_PER_MINUTE: z.coerce.number().int().positive().default(120),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    // Deliberately console, not the logger — the logger itself depends on env.
    console.error(
      `\nHowzat cannot start: the environment is incomplete.\n\n${issues}\n\n` +
        `Copy .env.example to .env at the repo root and fill in the blanks.\n`,
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/** True when OTP emails actually send; false means codes go to the log. */
export const emailEnabled = Boolean(env.RESEND_API_KEY);

/**
 * True when the browser and the API live on different hosts — the shape of a
 * Vercel + Render deploy. It changes what the refresh cookie has to look like:
 * a cross-site request only carries a cookie marked SameSite=None; Secure.
 * Behind a single domain the hostnames match and the stricter default stands.
 */
export const isCrossSite =
  new URL(env.WEB_BASE_URL).hostname !== new URL(env.API_BASE_URL).hostname;
