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

  // Injected by Vercel, absent everywhere else. VERCEL_URL is this specific
  // deployment's host — every preview gets its own — which is why the socket
  // origin allow-list cannot be pinned to WEB_BASE_URL alone.
  VERCEL_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    // Deliberately console, not the logger — the logger itself depends on env.
    const message =
      `\nHowzat cannot start: the environment is incomplete.\n\n${issues}\n\n` +
      `Copy .env.example to .env at the repo root and fill in the blanks.\n`;

    console.error(message);

    // Thrown rather than process.exit(1): on a serverless host this runs during
    // module init, where an exit is reported as an opaque crash with no output,
    // while a thrown error carries this message into the platform's logs.
    throw new Error(message);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Origins the browser is allowed to reach the API and the socket from.
 *
 * WEB_BASE_URL is the configured one. The Vercel hosts are added because web
 * and API ship as a single deployment there: a preview build serves the SPA
 * from the same throwaway host it serves the socket from, and hard-coding one
 * production URL would reject every preview.
 */
export const allowedOrigins: string[] = [
  env.WEB_BASE_URL,
  env.VERCEL_URL && `https://${env.VERCEL_URL}`,
  env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
].filter((origin): origin is string => Boolean(origin));

/** True when OTP emails actually send; false means codes go to the log. */
export const emailEnabled = Boolean(env.RESEND_API_KEY);
