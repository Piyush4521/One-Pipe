/**
 * Production MongoDB Connection & Runtime Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 7, 16.1, 16.4
 *
 * Verifies:
 * - Environment configuration validation (localhost-only, rejection of Atlas/cloud)
 * - Connection lifecycle management (connect, disconnect, state tracking)
 * - Safe pool options and non-destructive index initialization
 * - Fail-fast and degraded startup policies
 * - Health and readiness probes (/healthz vs /readyz)
 * - Strict prohibition of in-memory fallback in production
 * - No credentials leaked in logs, snapshots, or public endpoints
 */

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { getRedactedMongoUri, validateEnvironment } from '../src/config/env';
import { initializeDatabaseIndexes } from '../src/database/index-initializer';
import {
  MONGO_CONNECTION_OPTIONS,
  MongoConnectionManager,
  mongoConnectionManager,
} from '../src/database/mongo-connection';
import {
  buildRepositories,
  getActiveStorageDriver,
  inspectionRepository,
  setStorageDriverForTesting,
} from '../src/services/container';
import { healthService } from '../src/services/health.service';
import { TEST_MONGO_URI } from './mongo-test-helper';

describe('Production MongoDB Connection & Runtime Integration', () => {
  beforeAll(async () => {
    // Ensure disconnected before starting tests
    await mongoConnectionManager.disconnect();
  });

  afterAll(async () => {
    // Clean up connections
    await mongoConnectionManager.disconnect();
    setStorageDriverForTesting('mongodb');
  });

  // =========================================================================
  // 1. Environment & Security Validation Tests
  // =========================================================================
  describe('Environment Configuration & Security Boundaries', () => {
    it('should accept valid localhost MongoDB configuration', () => {
      const config = validateEnvironment({
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/pipebot',
        MONGODB_DB_NAME: 'pipebot',
        STORAGE_DRIVER: 'mongodb',
      });

      expect(config.MONGODB_URI).toBe('mongodb://127.0.0.1:27017/pipebot');
      expect(config.MONGODB_DB_NAME).toBe('pipebot');
      expect(config.STORAGE_DRIVER).toBe('mongodb');
      expect(config.REDACTED_MONGODB_URI).toBe('mongodb://127.0.0.1:27017/pipebot');
    });

    it('should redact credentials from MongoDB connection URI', () => {
      const sensitiveUri = 'mongodb://app_user:secret_password_123@127.0.0.1:27017/pipebot';
      const redacted = getRedactedMongoUri(sensitiveUri);

      expect(redacted).not.toContain('secret_password_123');
      expect(redacted).not.toContain('app_user');
      expect(redacted).toContain('***:***@127.0.0.1:27017/pipebot');
    });

    it('should strictly reject remote and cloud MongoDB Atlas URIs', () => {
      // Reject mongodb+srv protocol (Atlas)
      expect(() =>
        validateEnvironment({
          MONGODB_URI: 'mongodb+srv://cluster.mongodb.net/pipebot',
        })
      ).toThrow(/cloud\/remote databases forbidden/);

      // Reject non-localhost IP
      expect(() =>
        validateEnvironment({
          MONGODB_URI: 'mongodb://192.168.1.50:27017/pipebot',
        })
      ).toThrow(/cloud\/remote databases forbidden/);

      // Reject remote cloud domain
      expect(() =>
        validateEnvironment({
          MONGODB_URI: 'mongodb://remote-db.pipebot-cloud.com:27017/pipebot',
        })
      ).toThrow(/cloud\/remote databases forbidden/);
    });

    it('should strictly forbid in-memory repository fallback in production environment', () => {
      expect(() =>
        validateEnvironment({
          NODE_ENV: 'production',
          STORAGE_DRIVER: 'memory', // Forbidden in production
        })
      ).toThrow(/In-memory repository fallback is forbidden in production environment/);
    });

    it('should reject invalid MONGODB_DB_NAME characters', () => {
      expect(() =>
        validateEnvironment({
          MONGODB_DB_NAME: 'invalid/db/name',
        })
      ).toThrow(/MONGODB_DB_NAME contains invalid characters/);

      expect(() =>
        validateEnvironment({
          MONGODB_DB_NAME: 'db with spaces',
        })
      ).toThrow(/MONGODB_DB_NAME contains invalid characters/);
    });
  });

  // =========================================================================
  // 2. Connection Manager Lifecycle & Pooling Tests
  // =========================================================================
  describe('Connection Manager Lifecycle & Pooling', () => {
    it('should verify sensible, documented connection pool options', () => {
      expect(MONGO_CONNECTION_OPTIONS.maxPoolSize).toBe(10);
      expect(MONGO_CONNECTION_OPTIONS.minPoolSize).toBe(2);
      expect(MONGO_CONNECTION_OPTIONS.serverSelectionTimeoutMS).toBe(5000);
      expect(MONGO_CONNECTION_OPTIONS.autoIndex).toBe(false); // Controlled non-destructive indexing
      expect(MONGO_CONNECTION_OPTIONS.bufferCommands).toBe(false); // Fail-fast when disconnected
    });

    it('should connect to local test database and track connected state', async () => {
      expect(mongoConnectionManager.isConnected()).toBe(false);

      await mongoConnectionManager.connect(TEST_MONGO_URI, 'pipebot_test');

      expect(mongoConnectionManager.isConnected()).toBe(true);
      expect(mongoConnectionManager.getConnectionState()).toBe('connected');

      const health = mongoConnectionManager.getHealthSnapshot();
      expect(health.isAvailable).toBe(true);
      expect(health.state).toBe('connected');
      expect(health.databaseName).toBe('pipebot_test');
      expect(health.lastConnectedAt).not.toBeNull();
      expect(health.lastError).toBeNull();
    });

    it('should memoize active connection and avoid competing Mongoose connections', async () => {
      // Second connect call returns same connected instance immediately
      const instance = await mongoConnectionManager.connect(TEST_MONGO_URI, 'pipebot_test');
      expect(instance).toBeDefined();
      expect(mongoConnectionManager.isConnected()).toBe(true);
    });

    it('should safely execute non-destructive index initialization', async () => {
      const report = await initializeDatabaseIndexes();

      expect(report.success).toBe(true);
      expect(report.results.length).toBe(5);
      expect(report.results.every((r) => r.status === 'ensured')).toBe(true);
      expect(report.results.map((r) => r.collection)).toEqual([
        'inspections',
        'defects',
        'reports',
        'system_events',
        'telemetry',
      ]);
    });

    it('should disconnect cleanly and track disconnected state', async () => {
      await mongoConnectionManager.disconnect();

      expect(mongoConnectionManager.isConnected()).toBe(false);
      expect(mongoConnectionManager.getConnectionState()).toBe('disconnected');

      const health = mongoConnectionManager.getHealthSnapshot();
      expect(health.isAvailable).toBe(false);
      expect(health.state).toBe('disconnected');
      expect(health.lastDisconnectedAt).not.toBeNull();
    });

    it(
      'should handle initial connection failure gracefully without unhandled rejection',
      async () => {
        // Connect to unreachable local port with fast server selection timeout
        const manager = new MongoConnectionManager();
        const unreachableUri = 'mongodb://127.0.0.1:27099/unreachable_db';

        await expect(
          manager.connect(unreachableUri, 'unreachable_db', {
            serverSelectionTimeoutMS: 1500,
          })
        ).rejects.toThrow();

        expect(manager.isConnected()).toBe(false);
        expect(manager.getConnectionState()).toBe('error');
        expect(manager.getHealthSnapshot().lastError).not.toBeNull();
      },
      10000
    );
  });

  // =========================================================================
  // 3. Health & Readiness Integration Tests
  // =========================================================================
  describe('Health & Readiness Probes Integration', () => {
    it('should distinguish liveness (/healthz) from readiness (/readyz) when disconnected', async () => {
      await mongoConnectionManager.disconnect();

      // Liveness remains 200 alive (process is running)
      const healthzRes = await request(app).get('/healthz');
      expect(healthzRes.status).toBe(200);
      expect(healthzRes.body.data.status).toBe('alive');

      // Readiness returns 503 not_ready (database is disconnected)
      const readyzRes = await request(app).get('/readyz');
      expect(readyzRes.status).toBe(503);
      expect(readyzRes.body.data.status).toBe('not_ready');
      expect(readyzRes.body.data.database).toBe('disconnected');
    });

    it('should return 200 ready on /readyz when database is connected', async () => {
      await mongoConnectionManager.connect(TEST_MONGO_URI, 'pipebot_test');

      const readyzRes = await request(app).get('/readyz');
      expect(readyzRes.status).toBe(200);
      expect(readyzRes.body.data.status).toBe('ready');
      expect(readyzRes.body.data.database).toBe('connected');

      // Clean up
      await mongoConnectionManager.disconnect();
    });

    it('should report database as healthy on /api/system/status when connected, offline when disconnected', async () => {
      // When disconnected
      await mongoConnectionManager.disconnect();
      const offlineStatus = healthService.getSystemStatusData();
      expect(offlineStatus.subsystems.database).toBe('offline');
      expect(offlineStatus.storage.isPersistent).toBe(false);
      expect(offlineStatus.storage.limitation).toContain('disconnected');

      // When connected
      await mongoConnectionManager.connect(TEST_MONGO_URI, 'pipebot_test');
      const onlineStatus = healthService.getSystemStatusData();
      expect(onlineStatus.subsystems.database).toBe('healthy');
      expect(onlineStatus.storage.isPersistent).toBe(true);
      expect(onlineStatus.storage.limitation).toContain('Persistent local MongoDB database active');

      await mongoConnectionManager.disconnect();
    });
  });

  // =========================================================================
  // 4. Runtime Repository Wiring & Disconnect Guard Tests
  // =========================================================================
  describe('Runtime Repository Wiring & Disconnect Guard', () => {
    it('should wire MongoDB repositories in default persistent mode', () => {
      setStorageDriverForTesting('mongodb');
      expect(getActiveStorageDriver()).toBe('mongodb');

      const repos = buildRepositories('mongodb');
      expect(repos.inspectionRepository.constructor.name).toBe('MongoInspectionRepository');
      expect(repos.defectRepository.constructor.name).toBe('MongoDefectRepository');
      expect(repos.reportRepository.constructor.name).toBe('MongoReportRepository');
    });

    it('should reject persistent repository operations with 503 when MongoDB is disconnected', async () => {
      setStorageDriverForTesting('mongodb');
      await mongoConnectionManager.disconnect();

      // Attempting to create inspection when disconnected must fail with 503 DATABASE_UNAVAILABLE
      await expect(
        inspectionRepository.create({ conduitName: 'Conduit-While-Disconnected' })
      ).rejects.toMatchObject({
        statusCode: 503,
        code: 'DATABASE_UNAVAILABLE',
      });
    });

    it('should forbid setting storage driver to memory in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        expect(() => setStorageDriverForTesting('memory')).toThrow(
          /strictly forbidden in production environment/
        );
      } finally {
        (process.env as any).NODE_ENV = originalNodeEnv;
        setStorageDriverForTesting('mongodb');
      }
    });
  });
});
