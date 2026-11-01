/**
 * Centralized Environment Configuration & Validation
 * Follows Rules/PipeBot_Build_Rulebook.md § 7, 16, 20
 * Migrated to Zod 4.6.7
 */

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file if present
dotenv.config();

/**
 * Validates that MongoDB URI is strictly local (127.0.0.1 or localhost)
 * and forbids remote, cloud, or Atlas connection strings.
 */
function isValidLocalMongoUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== 'mongodb:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
      return false;
    }
    // Reject any hostname containing atlas or cloud domains
    if (hostname.includes('mongodb.net') || hostname.includes('atlas')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Redacts credentials from MongoDB URI for safe logging and status reporting.
 */
export function getRedactedMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return 'mongodb://127.0.0.1:27017/[redacted]';
  }
}

// Compute safe default storage paths
const defaultStorageRoot = path.resolve(process.cwd(), 'storage');
const defaultBackupDir = path.resolve(defaultStorageRoot, 'backups');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1024).max(65535).default(5000),
    HOST: z.string().default('127.0.0.1'),
    CORS_ORIGIN: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    OPERATOR_TOKEN: z.string().min(16).default('pipebot-dev-operator-token-32ch'),

    // Storage driver: mongodb (production/development) | memory (testbed only)
    STORAGE_DRIVER: z.enum(['mongodb', 'memory']).default('mongodb'),

    // Production MongoDB Configuration
    MONGODB_URI: z
      .string()
      .default('mongodb://127.0.0.1:27017/pipebot')
      .refine(
        (val) => isValidLocalMongoUri(val),
        'MONGODB_URI must be a local mongodb:// URI bound strictly to 127.0.0.1 or localhost (cloud/remote databases forbidden)'
      ),
    MONGODB_DB_NAME: z
      .string()
      .min(1, 'MONGODB_DB_NAME cannot be empty')
      .max(64, 'MONGODB_DB_NAME too long')
      .regex(/^[^/\\. "$*<>:|?]+$/, 'MONGODB_DB_NAME contains invalid characters')
      .default('pipebot'),

    // Filesystem Storage Configuration
    STORAGE_ROOT: z.string().default(defaultStorageRoot),
    MAX_EVIDENCE_FILE_SIZE_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(52428800)
      .default(10485760), // 10MB default, max 50MB
    BACKUP_DIR: z.string().default(defaultBackupDir),
    BACKUP_RETENTION_COUNT: z.coerce.number().int().min(1).max(100).default(5),
    MONGODUMP_PATH: z.string().default('mongodump'),
    MONGORESTORE_PATH: z.string().default('mongorestore'),
  })
  .refine(
    (data) => {
      // In production mode, in-memory repository fallback is strictly forbidden
      if (data.NODE_ENV === 'production' && data.STORAGE_DRIVER === 'memory') {
        return false;
      }
      return true;
    },
    {
      message: "In-memory repository fallback is forbidden in production environment. STORAGE_DRIVER must be 'mongodb'.",
      path: ['STORAGE_DRIVER'],
    }
  );

export type RawEnv = z.infer<typeof envSchema>;

export interface ValidatedEnv extends RawEnv {
  CORS_ORIGINS: string[];
  REDACTED_MONGODB_URI: string;
}

export function validateEnvironment(inputEnv: Record<string, unknown> = process.env): ValidatedEnv {
  const result = envSchema.safeParse(inputEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    console.error('Invalid environment configuration:\n' + errorDetails);
    throw new Error(`Environment configuration validation failed:\n${errorDetails}`);
  }

  const raw = result.data;
  const origins = raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    ...raw,
    CORS_ORIGINS: origins,
    REDACTED_MONGODB_URI: getRedactedMongoUri(raw.MONGODB_URI),
  };
}

export const env: ValidatedEnv = validateEnvironment();
