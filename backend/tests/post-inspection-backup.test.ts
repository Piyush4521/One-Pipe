/**
 * Post-Inspection Backup Trigger & Manual Retry Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2, 16.4, 17
 *
 * CRITICAL VERIFICATIONS:
 * 1. Inspection completion asynchronously triggers observable backup.
 * 2. Duplicate completion triggers do not launch concurrent duplicate backup operations.
 * 3. Backup failure records backupStatus: 'failed' and backupError without breaking inspection completion.
 * 4. Manual operator retry endpoint POST /api/inspections/:id/backup initiates backup and recovers status.
 */

import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { mongoConnectionManager } from '../src/database/mongo-connection';
import { MongoInspectionRepository } from '../src/repositories/mongo/mongo-inspection.repository';
import { MongoSystemEventRepository } from '../src/repositories/mongo/mongo-system-event.repository';
import { AuditLogService } from '../src/services/audit-log.service';
import { BackupService } from '../src/services/backup.service';
import { inspectionService } from '../src/services/container';
import { InspectionService } from '../src/services/inspection.service';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
} from './mongo-test-helper';

describe('Post-Inspection Backup Workflow & Manual Retry', () => {
  const testBackupRoot = path.resolve(__dirname, 'test-post-insp-backups');
  const testStorageRoot = path.resolve(__dirname, 'test-post-insp-storage');

  let inspectionRepo: MongoInspectionRepository;
  let auditLogService: AuditLogService;
  let backupService: BackupService;
  let service: InspectionService;

  beforeAll(async () => {
    await connectTestMongo();
    await mongoConnectionManager.connect(
      'mongodb://127.0.0.1:27017/pipebot_test',
      'pipebot_test'
    );

    inspectionRepo = new MongoInspectionRepository();
    const eventRepo = new MongoSystemEventRepository();
    auditLogService = new AuditLogService(eventRepo);
    backupService = new BackupService(
      auditLogService,
      testBackupRoot,
      testStorageRoot,
      3
    );
    service = new InspectionService(inspectionRepo, backupService, auditLogService);
  });

  beforeEach(async () => {
    await cleanTestCollections();
    if (fs.existsSync(testBackupRoot)) {
      await fs.promises.rm(testBackupRoot, { recursive: true, force: true });
    }
    if (fs.existsSync(testStorageRoot)) {
      await fs.promises.rm(testStorageRoot, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectTestMongo();
    await mongoConnectionManager.disconnect();
    if (fs.existsSync(testBackupRoot)) {
      await fs.promises.rm(testBackupRoot, { recursive: true, force: true });
    }
    if (fs.existsSync(testStorageRoot)) {
      await fs.promises.rm(testStorageRoot, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('Post-Inspection Automatic Trigger', () => {
    it('should complete inspection and complete post-inspection backup', async () => {
      const created = await inspectionRepo.create({
        conduitName: 'PIPE-AUTO-01',
      });
      await inspectionRepo.updateStatus(created.id, 'running');

      const completed = await service.completeInspection(created.id, 'Inspection completed successfully');
      expect(completed.status).toBe('completed');
      expect(completed.backupStatus).toBe('pending');

      // Wait briefly for asynchronous backup to execute
      await new Promise((resolve) => setTimeout(resolve, 500));

      const updated = await inspectionRepo.findById(created.id);
      expect(updated?.status).toBe('completed');
      expect(updated?.backupStatus).toBe('completed');
      expect(updated?.backupVerified).toBe(true);
      expect(updated?.backupId).toMatch(/^backup_/);
      expect(updated?.backupError).toBeNull();
    });

    it('should prevent duplicate backup execution if already running or completed', async () => {
      const created = await inspectionRepo.create({
        conduitName: 'PIPE-DUP-01',
      });
      await inspectionRepo.updateStatus(created.id, 'running');
      await service.completeInspection(created.id);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500));

      const spy = vi.spyOn(backupService, 'createBackup');

      // Attempt second trigger on completed backup
      await service.triggerPostInspectionBackup(created.id);

      // Should not call createBackup again
      expect(spy).not.toHaveBeenCalled();
    });

    it('should record backupStatus: failed and backupError when backup encounters an error', async () => {
      const created = await inspectionRepo.create({
        conduitName: 'PIPE-FAIL-01',
      });
      await inspectionRepo.updateStatus(created.id, 'running');

      // Mock backupService.createBackup failure
      vi.spyOn(backupService, 'createBackup').mockRejectedValueOnce(
        new Error('Disk write failed: out of disk space')
      );

      await service.completeInspection(created.id);

      // Wait for asynchronous backup execution
      await new Promise((resolve) => setTimeout(resolve, 500));

      const record = await inspectionRepo.findById(created.id);
      expect(record?.status).toBe('completed');
      expect(record?.backupStatus).toBe('failed');
      expect(record?.backupVerified).toBe(false);
      expect(record?.backupError).toContain('out of disk space');
    });
  });

  describe('Manual Operator Retry Endpoint POST /api/inspections/:id/backup', () => {
    it('should reject request without operator authority with 403', async () => {
      await request(app)
        .post('/api/inspections/any-id/backup')
        .expect(403);
    });

    it('should reject request for non-existent inspection with 404', async () => {
      const response = await request(app)
        .post('/api/inspections/00000000-0000-0000-0000-000000000000/backup')
        .set('x-operator-token', env.OPERATOR_TOKEN)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });

    it('should reject request for inspection that is not completed with 409', async () => {
      const created = await inspectionRepo.create({
        conduitName: 'PIPE-ACTIVE-01',
      });

      const response = await request(app)
        .post(`/api/inspections/${created.id}/backup`)
        .set('x-operator-token', env.OPERATOR_TOKEN)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should successfully retry backup on a completed inspection and update record', async () => {
      const created = await inspectionRepo.create({
        conduitName: 'PIPE-RETRY-01',
      });
      await inspectionRepo.updateStatus(created.id, 'running');
      await inspectionRepo.updateStatus(created.id, 'completed');
      await inspectionRepo.update(created.id, {
        backupStatus: 'failed',
        backupError: 'Prior backup failed',
      });

      const response = await request(app)
        .post(`/api/inspections/${created.id}/backup`)
        .set('x-operator-token', env.OPERATOR_TOKEN)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.manifest.backupId).toMatch(/^backup_/);

      const updated = await inspectionRepo.findById(created.id);
      expect(updated?.backupStatus).toBe('completed');
      expect(updated?.backupVerified).toBe(true);
      expect(updated?.backupId).toBe(response.body.data.manifest.backupId);
      expect(updated?.backupError).toBeNull();
    });
  });
});
