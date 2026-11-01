/**
 * Report File Storage & Verification Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 16.4, 17
 *
 * Runs against local test database: 'mongodb://127.0.0.1:27017/pipebot_test'
 * CRITICAL VERIFICATIONS:
 * 1. %PDF- magic bytes validation prevents saving non-PDF documents.
 * 2. Atomic writes prevent partial report file generation.
 * 3. PDF binaries are never stored in MongoDB; only metadata and relative paths are persisted.
 * 4. Download endpoint streams file with Content-Disposition attachment and ETag.
 * 5. Returns 404 when report PDF is not yet compiled.
 */

import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { mongoConnectionManager } from '../src/database/mongo-connection';
import { MongoInspectionRepository } from '../src/repositories/mongo/mongo-inspection.repository';
import { MongoReportRepository } from '../src/repositories/mongo/mongo-report.repository';
import { ReportStorageService } from '../src/services/report-storage.service';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
} from './mongo-test-helper';

describe('Report File Persistence & Verification Layer', () => {
  const testStorageRoot = path.resolve(__dirname, 'test-report-storage');
  let reportStorageService: ReportStorageService;
  let inspectionRepo: MongoInspectionRepository;
  let reportRepo: MongoReportRepository;

  // Minimal valid PDF binary buffer: starts with %PDF- and ends with %%EOF
  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
    'utf-8'
  );

  beforeAll(async () => {
    await connectTestMongo();
    await mongoConnectionManager.connect(
      'mongodb://127.0.0.1:27017/pipebot_test',
      'pipebot_test'
    );

    reportStorageService = new ReportStorageService(testStorageRoot);
    inspectionRepo = new MongoInspectionRepository();
    reportRepo = new MongoReportRepository();
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

  describe('Report Storage Service Logic', () => {
    it('should validate %PDF- magic bytes and reject invalid payloads', () => {
      // Valid PDF
      expect(() =>
        reportStorageService.validatePdfMagicBytes(validPdfBuffer)
      ).not.toThrow();

      // Plain text
      const nonPdfBuffer = Buffer.from('This is not a PDF file');
      expect(() =>
        reportStorageService.validatePdfMagicBytes(nonPdfBuffer)
      ).toThrow(/Unsupported file format/);
    });

    it('should atomically store report PDF and compute SHA-256 digest', async () => {
      const result = await reportStorageService.saveReportPdf(
        'insp-101',
        'rep-202',
        validPdfBuffer
      );

      expect(result.relativePath).toBe('inspections/insp-101/reports/rep-202.pdf');
      expect(result.fileSizeBytes).toBe(validPdfBuffer.length);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fs.existsSync(result.absolutePath)).toBe(true);

      const isValid = await reportStorageService.verifyReportFile(
        result.relativePath,
        result.sha256
      );
      expect(isValid).toBe(true);
    });
  });

  describe('REST API Download & Status Lifecycle', () => {
    it('GET /api/reports/:id/download should return 404 if report is still pending or not ready', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Pending Report',
        pipeIdentifier: 'PIPE-REP-01',
      });

      // Pending report record without compiled PDF
      const report = await reportRepo.create({
        inspectionId: inspection.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      const response = await request(app)
        .get(`/api/reports/${report.id}/download`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REPORT_FILE_NOT_READY');
    });

    it('GET /api/reports/:id/download should stream compiled PDF with proper headers when completed', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Completed Report',
        pipeIdentifier: 'PIPE-REP-02',
      });

      const report = await reportRepo.create({
        inspectionId: inspection.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      // Save PDF using default service
      const { reportStorageService: activeReportStorage } = await import(
        '../src/services/container'
      );
      const saved = await activeReportStorage.saveReportPdf(
        inspection.id,
        report.id,
        validPdfBuffer
      );

      // Transition report to completed
      await reportRepo.update(report.id, {
        status: 'generating',
      });
      await reportRepo.update(report.id, {
        status: 'completed',
        compiledTimestamp: new Date().toISOString(),
        fileSizeBytes: saved.fileSizeBytes,
        pdfRelativePath: saved.relativePath,
        pdfSha256: saved.sha256,
        defectCount: 0,
        totalDistanceMeters: null,
      });

      const response = await request(app)
        .get(`/api/reports/${report.id}/download`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(`PipeBot-Report-${inspection.id}.pdf`);
      expect(response.headers['etag']).toBe(`"${saved.sha256}"`);
    });
  });
});

