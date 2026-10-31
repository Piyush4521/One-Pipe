/**
 * Centralized Environment Configuration & Validation
 * Follows Rules/PipeBot_Build_Rulebook.md § 7, 16, 20
 * Migrated to Zod 4.6.7
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(5000),
  HOST: z.string().default('127.0.0.1'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OPERATOR_TOKEN: z.string().min(16).default('pipebot-dev-operator-token-32ch'),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface ValidatedEnv extends RawEnv {
  CORS_ORIGINS: string[];
}

export function validateEnvironment(inputEnv: Record<string, unknown> = process.env): ValidatedEnv {
  const result = envSchema.safeParse(inputEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    console.error('Invalid environment configuration:\n' + errorDetails);
    throw new Error('Environment configuration validation failed');
  }

  const raw = result.data;
  const origins = raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    ...raw,
    CORS_ORIGINS: origins,
  };
}

export const env: ValidatedEnv = validateEnvironment();
