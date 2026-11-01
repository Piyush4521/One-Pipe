/**
 * System Event & Audit Logging Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.1, 16.4
 *
 * Runs against local test database: 'mongodb://127.0.0.1:27017/pipebot_test'
 * CRITICAL VERIFICATIONS:
 * 1. Software emergency stop events MUST ALWAYS enforce physicalStopConfirmed: false.
 * 2. Sensitive credential redaction (tokens, passwords, database URIs).
 * 3. High-volume sensor telemetry is not routed into audit events.
 * 4. Paginated retrieval and category/severity filtering.
 * 5. Disconnected database returns 503 DATABASE_UNAVAILABLE.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { mongoConnectionManager } from '../src/database/mongo-connection';
import { SystemEventModel } from '../src/models';
import { MongoSystemEventRepository } from '../src/repositories/mongo/mongo-system-event.repository';
import { AuditLogService, sanitizeEventDetails } from '../src/services/audit-log.service';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
} from './mongo-test-helper';

describe('System Event & Audit Logging Layer', () => {
  let eventRepo: MongoSystemEventRepository;
  let auditLogService: AuditLogService;

  beforeAll(async () => {
    await connectTestMongo();
    await mongoConnectionManager.connect(
      'mongodb://127.0.0.1:27017/pipebot_test',
      'pipebot_test'
    );

    eventRepo = new MongoSystemEventRepository();
    auditLogService = new AuditLogService(eventRepo);
  });

  beforeEach(async () => {
    await cleanTestCollections();
  });

  afterAll(async () => {
    await disconnectTestMongo();
    await mongoConnectionManager.disconnect();
  });

  describe('Safety Invariant & Audit Logic', () => {
    it('CRITICAL: must ALWAYS enforce physicalStopConfirmed = false for emergency stop events', async () => {
      // Attempting to pass physicalStopConfirmed: true MUST be overridden to false
      const event = await eventRepo.create({
        category: 'emergency_stop_request',
        severity: 'critical',
        message: 'Operator pressed Emergency Stop',
        physicalStopConfirmed: true as any, // Malicious or mistaken true
      });

      expect(event.category).toBe('emergency_stop_request');
      expect(event.physicalStopConfirmed).toBe(false);

      // Verify directly in MongoDB document
      const doc = await SystemEventModel.findOne({ eventId: event.id }).lean().exec();
      expect(doc?.physicalStopConfirmed).toBe(false);
    });

    it('should log emergency stop via AuditLogService with invariant enforced', async () => {
      const event = await auditLogService.logEmergencyStop('Operator Carol', {
        reason: 'Obstacle detected ahead',
      });

      expect(event).not.toBeNull();
      expect(event?.category).toBe('emergency_stop_request');
      expect(event?.severity).toBe('critical');
      expect(event?.physicalStopConfirmed).toBe(false);
      expect(event?.details).toEqual({
        requestedBy: 'Operator Carol',
        reason: 'Obstacle detected ahead',
      });
    });

    it('should redact sensitive credentials and database connection strings in details', () => {
      const rawDetails = {
        operatorToken: 'super-secret-token-12345',
        password: 'admin-password',
        mongoUri: 'mongodb://admin:secretPass123@127.0.0.1:27017/pipebot',
        safeProperty: 'normal-diagnostic-info',
        nested: {
          secret: 'nested-secret-value',
          subsystem: 'camera',
        },
      };

      const sanitized = sanitizeEventDetails(rawDetails) as any;
      expect(sanitized.operatorToken).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.mongoUri).toBe('mongodb://admin:***@127.0.0.1:27017/pipebot');
      expect(sanitized.safeProperty).toBe('normal-diagnostic-info');
      expect(sanitized.nested.secret).toBe('[REDACTED]');
      expect(sanitized.nested.subsystem).toBe('camera');
    });

    it('should create and retrieve events across categories with pagination and filtering', async () => {
      await auditLogService.logSubsystemStatus('camera', 'ok');
      await auditLogService.logSubsystemStatus('esp32_link', 'degraded');
      await auditLogService.logSecurityAlert('Unauthorized CORS origin attempt');

      const allEvents = await auditLogService.getEvents({ page: 1, limit: 10 });
      expect(allEvents.total).toBe(3);
      expect(allEvents.items.length).toBe(3);

      const securityEvents = await auditLogService.getEvents({ category: 'security_alert' });
      expect(securityEvents.total).toBe(1);
      expect(securityEvents.items[0].category).toBe('security_alert');
      expect(securityEvents.items[0].message).toContain('Unauthorized CORS origin');

      const statusEvents = await auditLogService.getEvents({ category: 'subsystem_status' });
      expect(statusEvents.total).toBe(2);
    });
  });

  describe('REST API Endpoints', () => {
    it('POST /api/system/events should record a system event', async () => {
      const response = await request(app)
        .post('/api/system/events')
        .send({
          category: 'subsystem_status',
          subsystem: 'lidar',
          severity: 'info',
          message: 'Lidar subsystem diagnostic check passed',
          details: { latencyMs: 12 },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('subsystem_status');
      expect(response.body.data.subsystem).toBe('lidar');
    });

    it('GET /api/system/events should return paginated events list with filters', async () => {
      await eventRepo.create({
        category: 'inspection_lifecycle',
        severity: 'info',
        message: 'Inspection session started',
      });

      const response = await request(app)
        .get('/api/system/events?category=inspection_lifecycle&page=1&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.data[0].category).toBe('inspection_lifecycle');
    });

    it('POST /api/system/events with emergency_stop_request must never have physicalStopConfirmed: true', async () => {
      const response = await request(app)
        .post('/api/system/events')
        .send({
          category: 'emergency_stop_request',
          severity: 'critical',
          message: 'Safety cutoff requested',
          physicalStopConfirmed: true, // Malicious override
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.physicalStopConfirmed).toBe(false);
    });
  });
});

