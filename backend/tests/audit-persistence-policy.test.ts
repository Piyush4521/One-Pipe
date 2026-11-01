/**
 * Audit Persistence Policy & Safety Guarantees Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.1, 16.4
 *
 * CRITICAL VERIFICATIONS:
 * 1. Critical audit event failure policy: Non-recursive handling, returns auditPersisted: false without masking.
 * 2. Diagnostic audit event policy: Best-effort delivery without crashing operational pipeline.
 * 3. Software Emergency Stop Safety Invariant:
 *    - physicalStopConfirmed MUST ALWAYS be false.
 *    - E-stop executes and returns 200 even if database audit logging fails.
 *    - Truthful auditPersisted status returned in response envelope.
 * 4. Sensitive credential redaction in event details.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { mongoConnectionManager } from '../src/database/mongo-connection';
import { ISystemEventRepository } from '../interfaces/repositories';
import { SystemEventRecord } from '../interfaces/system-event.interface';
import { MongoSystemEventRepository } from '../src/repositories/mongo/mongo-system-event.repository';
import {
  AuditLogService,
  isCriticalEvent,
  sanitizeEventDetails,
} from '../src/services/audit-log.service';
import { auditLogService } from '../src/services/container';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
} from './mongo-test-helper';

describe('Audit Persistence Policy & Safety Guarantees', () => {
  let eventRepo: MongoSystemEventRepository;
  let service: AuditLogService;

  beforeAll(async () => {
    await connectTestMongo();
    await mongoConnectionManager.connect(
      'mongodb://127.0.0.1:27017/pipebot_test',
      'pipebot_test'
    );
    eventRepo = new MongoSystemEventRepository();
    service = new AuditLogService(eventRepo);
  });

  beforeEach(async () => {
    await cleanTestCollections();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectTestMongo();
    await mongoConnectionManager.disconnect();
    vi.restoreAllMocks();
  });

  describe('Critical vs Ordinary Event Classification', () => {
    it('should classify emergency_stop_request, inspection_lifecycle, backup, and storage as critical', () => {
      expect(isCriticalEvent('emergency_stop_request')).toBe(true);
      expect(isCriticalEvent('inspection_lifecycle')).toBe(true);
      expect(isCriticalEvent('backup')).toBe(true);
      expect(isCriticalEvent('storage')).toBe(true);
      expect(isCriticalEvent('subsystem_status', 'critical')).toBe(true);
      expect(isCriticalEvent('subsystem_status', 'info')).toBe(false);
      expect(isCriticalEvent('subsystem_status', 'warning')).toBe(false);
    });
  });

  describe('Critical Audit Event Failure Policy', () => {
    it('should persist critical event successfully when repository is healthy', async () => {
      const result = await service.logCriticalEvent({
        category: 'inspection_lifecycle',
        severity: 'info',
        subsystem: 'backend',
        message: 'Inspection started',
        inspectionId: 'insp-101',
      });

      expect(result.auditPersisted).toBe(true);
      expect(result.isCritical).toBe(true);
      expect(result.record).not.toBeNull();
      expect(result.record?.category).toBe('inspection_lifecycle');
    });

    it('should return auditPersisted: false and not crash when repository throws an error', async () => {
      // Mock repository create failure
      const failingRepo: ISystemEventRepository = {
        create: vi.fn().mockRejectedValue(new Error('Database connection lost')),
        findMany: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 }),
      };
      const failingService = new AuditLogService(failingRepo);

      const result = await failingService.logCriticalEvent({
        category: 'backup',
        severity: 'critical',
        subsystem: 'backend',
        message: 'Backup failed',
      });

      expect(result.auditPersisted).toBe(false);
      expect(result.isCritical).toBe(true);
      expect(result.record).toBeNull();
      expect(result.error).toBe('Database connection lost');
    });
  });

  describe('Ordinary Diagnostic Event Best-Effort Delivery', () => {
    it('should silently handle ordinary event persistence failure without bubbling error', async () => {
      const failingRepo: ISystemEventRepository = {
        create: vi.fn().mockRejectedValue(new Error('Transient DB timeout')),
        findMany: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 }),
      };
      const failingService = new AuditLogService(failingRepo);

      const record = await failingService.logDiagnosticEvent({
        category: 'subsystem_status',
        severity: 'info',
        subsystem: 'sensor',
        message: 'Sensor polling ok',
      });

      expect(record).toBeNull();
    });
  });

  describe('Software Emergency Stop Safety Contract', () => {
    it('CRITICAL SAFETY: physicalStopConfirmed MUST ALWAYS be false for emergency stop audit log', async () => {
      const result = await service.logEmergencyStop({
        subsystem: 'firmware',
        message: 'Operator pressed physical e-stop simulation button',
        details: { operator: 'Alice' },
      });

      expect(result.auditPersisted).toBe(true);
      expect(result.record?.physicalStopConfirmed).toBe(false);
    });

    it('POST /api/robot/emergency-stop should return status REQUEST_ACCEPTED and physicalStopConfirmed: false', async () => {
      const response = await request(app)
        .post('/api/robot/emergency-stop')
        .set('x-operator-token', env.OPERATOR_TOKEN)
        .send({ reason: 'Obstacle detected' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REQUEST_ACCEPTED');
      expect(response.body.data.physicalStopConfirmed).toBe(false);
      expect(response.body.data.auditPersisted).toBe(true);
    });

    it('POST /api/robot/emergency-stop should execute successfully even if audit logging fails', async () => {
      // Mock auditLogService.logEmergencyStop to return unpersisted result
      const spy = vi.spyOn(auditLogService, 'logEmergencyStop').mockResolvedValueOnce({
        record: null,
        auditPersisted: false,
        isCritical: true,
        error: 'MongoDB connection offline',
      });

      const response = await request(app)
        .post('/api/robot/emergency-stop')
        .set('x-operator-token', env.OPERATOR_TOKEN)
        .send({ reason: 'Hardware jam' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REQUEST_ACCEPTED');
      expect(response.body.data.physicalStopConfirmed).toBe(false);
      // Truthfully reports that audit logging was not persisted without crashing E-stop
      expect(response.body.data.auditPersisted).toBe(false);

      spy.mockRestore();
    });
  });

  describe('Sensitive Credential Redaction', () => {
    it('should sanitize tokens, passwords, and sensitive credentials in event details', () => {
      const details = {
        token: 'secret-token-123',
        operatorToken: 'super-operator-key',
        password: 'admin-password',
        mongodb_uri: 'mongodb://user:pass@127.0.0.1:27017/pipebot',
        safeProperty: 'safe-value',
        nested: {
          authorization: 'Bearer 999999',
          conduitId: 'PIPE-01',
        },
      };

      const sanitized: any = sanitizeEventDetails(details);
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.operatorToken).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.mongodb_uri).toBe('[REDACTED]');
      expect(sanitized.safeProperty).toBe('safe-value');
      expect(sanitized.nested.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.conduitId).toBe('PIPE-01');
    });
  });
});

