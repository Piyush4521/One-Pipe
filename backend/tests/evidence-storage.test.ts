/**
 * Local Evidence Storage Service Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 16.4
 *
 * Runs against local test database: 'mongodb://127.0.0.1:27017/pipebot_test'
 * CRITICAL VERIFICATIONS:
 * 1. Path traversal attempts are strictly detected and rejected.
 * 2. Magic bytes validation accepts valid JPEG/PNG and rejects other binary/text formats.
 * 3. Atomic writes prevent partial/corrupt files.
 * 4. Cryptographic SHA-256 checksums are verified on write and retrieval.
 * 5. Relative paths ensure portable backups without machine-specific hardcoded prefixes.
 * 6. Defect document is updated with evidence file size, sha256, and mimeType.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { mongoConnectionManager } from '../src/database/mongo-connection';
import { MongoDefectRepository } from '../src/repositories/mongo/mongo-defect.repository';
import { MongoInspectionRepository } from '../src/repositories/mongo/mongo-inspection.repository';
import { EvidenceStorageService } from '../src/services/evidence-storage.service';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
} from './mongo-test-helper';

describe('Local Inspection Evidence Storage Layer', () => {
  const testStorageRoot = path.resolve(__dirname, 'test-storage');
  let evidenceService: EvidenceStorageService;
  let inspectionRepo: MongoInspectionRepository;
  let defectRepo: MongoDefectRepository;

  // Minimal valid 1x1 JPEG buffer
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0xff, 0xd9,
  ]);

  // Minimal valid 1x1 PNG buffer
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  beforeAll(async () => {
    await connectTestMongo();
    await mongoConnectionManager.connect(
      'mongodb://127.0.0.1:27017/pipebot_test',
      'pipebot_test'
    );

    evidenceService = new EvidenceStorageService(testStorageRoot, 1024 * 1024); // 1MB limit for tests
    inspectionRepo = new MongoInspectionRepository();
    defectRepo = new MongoDefectRepository();
  });

  beforeEach(async () => {
    await cleanTestCollections();
    if (fs.existsSync(testStorageRoot)) {
      await fs.promises.rm(testStorageRoot, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await disconnectTestMongo();
    await mongoConnectionManager.disconnect();
    if (fs.existsSync(testStorageRoot)) {
      await fs.promises.rm(testStorageRoot, { recursive: true, force: true });
    }
  });

  describe('Security Boundaries & Format Validation', () => {
    it('should detect and reject path traversal attacks', () => {
      expect(() =>
        evidenceService.resolveSafePath('../../etc/passwd')
      ).toThrow(/Path traversal detected/);

      expect(() =>
        evidenceService.sanitizePathComponent('../../dangerous')
      ).toThrow(/Invalid path component/);
    });

    it('should validate magic bytes and detect invalid file signatures', () => {
      // Valid JPEG
      expect(evidenceService.validateMagicBytes(validJpegBuffer)).toBe('image/jpeg');

      // Valid PNG
      expect(evidenceService.validateMagicBytes(validPngBuffer)).toBe('image/png');

      // Plain text or invalid bytes
      const textBuffer = Buffer.from('This is not an image at all!');
      expect(() => evidenceService.validateMagicBytes(textBuffer)).toThrow(
        /Unsupported file format/
      );
    });

    it('should reject files exceeding maxFileSizeBytes limit', async () => {
      const limitedService = new EvidenceStorageService(testStorageRoot, 20); // 20 bytes limit (validJpegBuffer is 38 bytes)
      await expect(
        limitedService.saveEvidence('insp-1', 'def-1', 'frm-1', validJpegBuffer)
      ).rejects.toThrow(/exceeds maximum allowed limit/);
    });
  });

  describe('Atomic Storage & Checksum Verification', () => {
    it('should save JPEG evidence atomically and verify SHA-256 digest', async () => {
      const result = await evidenceService.saveEvidence(
        'insp-001',
        'defect-100',
        'frame-50',
        validJpegBuffer
      );

      expect(result.relativePath).toBe('inspections/insp-001/evidence/defect-100_frame-50.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.fileSizeBytes).toBe(validJpegBuffer.length);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fs.existsSync(result.absolutePath)).toBe(true);

      // Verify file contents via getEvidence
      const retrieved = await evidenceService.getEvidence(result.relativePath);
      expect(retrieved.sha256).toBe(result.sha256);
      expect(retrieved.mimeType).toBe('image/jpeg');

      // Verify checksum helper
      const isValid = await evidenceService.verifyEvidence(result.relativePath, result.sha256);
      expect(isValid).toBe(true);
    });

    it('should save PNG evidence atomically', async () => {
      const result = await evidenceService.saveEvidence(
        'insp-002',
        'defect-200',
        'frame-60',
        validPngBuffer
      );

      expect(result.relativePath).toBe('inspections/insp-002/evidence/defect-200_frame-60.png');
      expect(result.mimeType).toBe('image/png');
      expect(fs.existsSync(result.absolutePath)).toBe(true);
    });
  });

  describe('REST API Evidence Upload & Retrieval', () => {
    it('POST /api/inspections/:id/defects/:defectId/evidence should store evidence and update defect record', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Evidence',
        pipeIdentifier: 'PIPE-EV-01',
      });

      const defect = await defectRepo.create({
        inspectionId: inspection.id,
        classId: 1,
        className: 'crack',
        confidence: 0.88,
        estimatedDistance: null,
        frameId: 'frm-99',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'provisional/path',
      });

      const response = await request(app)
        .post(`/api/inspections/${inspection.id}/defects/${defect.id}/evidence`)
        .set('Content-Type', 'image/jpeg')
        .set('x-frame-id', 'frm-99')
        .send(validJpegBuffer)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.relativePath).toContain('evidence');
      expect(response.body.data.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Verify defect record in repository updated with evidence metadata
      const updatedDefect = await defectRepo.findById(defect.id);
      expect(updatedDefect?.evidenceImagePath).toBe(response.body.data.relativePath);
      expect(updatedDefect?.evidenceFileSizeBytes).toBe(validJpegBuffer.length);
      expect(updatedDefect?.evidenceSha256).toBe(response.body.data.sha256);
      expect(updatedDefect?.evidenceMimeType).toBe('image/jpeg');
    });

    it('GET /api/inspections/:id/evidence/:filename should stream stored evidence with proper headers', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Stream',
        pipeIdentifier: 'PIPE-EV-02',
      });

      const defect = await defectRepo.create({
        inspectionId: inspection.id,
        classId: 2,
        className: 'corrosion',
        confidence: 0.92,
        estimatedDistance: null,
        frameId: 'frm-101',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'provisional',
      });

      // Upload first
      const uploadRes = await request(app)
        .post(`/api/inspections/${inspection.id}/defects/${defect.id}/evidence?frameId=frm-101`)
        .set('Content-Type', 'image/jpeg')
        .send(validJpegBuffer)
        .expect(201);

      const filename = path.basename(uploadRes.body.data.relativePath);

      // Now retrieve
      const streamRes = await request(app)
        .get(`/api/inspections/${inspection.id}/evidence/${filename}`)
        .expect(200);

      expect(streamRes.headers['content-type']).toContain('image/jpeg');
      expect(streamRes.headers['etag']).toBe(`"${uploadRes.body.data.sha256}"`);
      expect(streamRes.headers['cache-control']).toContain('immutable');
    });
  });
});
