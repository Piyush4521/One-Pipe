/**
 * MongoDB Concrete Repositories Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 14, 16.1, 16.4, 17
 *
 * Runs against the actual local MongoDB test database (pipebot_test) on 127.0.0.1:27017.
 * Verifies real persistence, indexing, atomic transitions, error handling,
 * and strict null distance semantics.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MongoDefectRepository,
  MongoInspectionRepository,
  MongoReportRepository,
} from '../src/repositories/mongo';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
  TEST_DB_NAME,
} from './mongo-test-helper';

describe('MongoDB Concrete Repositories Integration Tests (pipebot_test)', () => {
  let inspectionRepo: MongoInspectionRepository;
  let defectRepo: MongoDefectRepository;
  let reportRepo: MongoReportRepository;

  beforeAll(async () => {
    const mongooseInstance = await connectTestMongo();
    expect(mongooseInstance.connection.name).toBe(TEST_DB_NAME);
    expect(mongooseInstance.connection.host).toBe('127.0.0.1');

    inspectionRepo = new MongoInspectionRepository();
    defectRepo = new MongoDefectRepository();
    reportRepo = new MongoReportRepository();
  });

  afterAll(async () => {
    await disconnectTestMongo();
  });

  beforeEach(async () => {
    await cleanTestCollections();
  });

  // =========================================================================
  // 1. MongoInspectionRepository Tests
  // =========================================================================
  describe('MongoInspectionRepository', () => {
    it('should create and retrieve an inspection with truthful null initial distance', async () => {
      const created = await inspectionRepo.create({
        conduitName: 'Storm-Drain-West-1',
        operatorNotes: 'Pre-inspection calibration check',
      });

      expect(created.id).toBeDefined();
      expect(typeof created.id).toBe('string');
      expect(created.conduitName).toBe('Storm-Drain-West-1');
      expect(created.operatorNotes).toBe('Pre-inspection calibration check');
      expect(created.status).toBe('ready');
      expect(created.defectCount).toBe(0);
      expect(created.reportGenerated).toBe(false);
      expect(created.backupVerified).toBe(false);

      // CRITICAL: totalDistanceMeters MUST be null when uncalibrated, NEVER coerced to 0
      expect(created.totalDistanceMeters).toBeNull();
      expect(created.totalDistanceMeters).not.toBe(0);

      // Verify no leakage of Mongoose internals
      expect((created as any)._id).toBeUndefined();
      expect((created as any).__v).toBeUndefined();

      const retrieved = await inspectionRepo.findById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.totalDistanceMeters).toBeNull();
      expect(retrieved?.conduitName).toBe('Storm-Drain-West-1');
    });

    it('should return null when retrieving a non-existent inspection ID', async () => {
      const result = await inspectionRepo.findById('non-existent-uuid-999');
      expect(result).toBeNull();
    });

    it('should list and filter inspections with pagination', async () => {
      // Create 5 sessions
      for (let i = 1; i <= 5; i++) {
        await inspectionRepo.create({ conduitName: `Conduit-Line-${i}` });
      }

      const paginated = await inspectionRepo.findMany({ page: 1, limit: 3 });
      expect(paginated.items.length).toBe(3);
      expect(paginated.total).toBe(5);
      expect(paginated.page).toBe(1);
      expect(paginated.limit).toBe(3);
      expect(paginated.totalPages).toBe(2);

      const page2 = await inspectionRepo.findMany({ page: 2, limit: 3 });
      expect(page2.items.length).toBe(2);
    });

    it('should filter inspections by lifecycle status', async () => {
      const s1 = await inspectionRepo.create({ conduitName: 'Line-1' });
      const s2 = await inspectionRepo.create({ conduitName: 'Line-2' });
      await inspectionRepo.create({ conduitName: 'Line-3' });

      await inspectionRepo.updateStatus(s1.id, 'running');
      await inspectionRepo.updateStatus(s2.id, 'running');

      const runningList = await inspectionRepo.findMany({ status: 'running' });
      expect(runningList.items.length).toBe(2);
      expect(runningList.items.every((i) => i.status === 'running')).toBe(true);

      const readyList = await inspectionRepo.findMany({ status: 'ready' });
      expect(readyList.items.length).toBe(1);
    });

    it('should execute valid lifecycle sequence: ready -> running -> paused -> running -> completed', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Sequence-Conduit' });
      expect(session.status).toBe('ready');

      const running1 = await inspectionRepo.updateStatus(session.id, 'running');
      expect(running1?.status).toBe('running');

      const paused = await inspectionRepo.updateStatus(session.id, 'paused');
      expect(paused?.status).toBe('paused');

      const running2 = await inspectionRepo.updateStatus(session.id, 'running');
      expect(running2?.status).toBe('running');

      const completed = await inspectionRepo.updateStatus(session.id, 'completed');
      expect(completed?.status).toBe('completed');
    });

    it('should reject invalid lifecycle transition from ready directly to completed with 409', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Invalid-Direct' });

      await expect(inspectionRepo.updateStatus(session.id, 'completed')).rejects.toThrow(
        /Invalid lifecycle transition/
      );

      // Verify status was not mutated
      const unchanged = await inspectionRepo.findById(session.id);
      expect(unchanged?.status).toBe('ready');
    });

    it('should reject mutations out of terminal completed state', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Terminal-Test' });
      await inspectionRepo.updateStatus(session.id, 'running');
      await inspectionRepo.updateStatus(session.id, 'completed');

      // Attempting to transition from completed to running must be blocked
      await expect(inspectionRepo.updateStatus(session.id, 'running')).rejects.toThrow(
        /Invalid lifecycle transition/
      );

      // Attempting to transition from completed to paused must be blocked
      await expect(inspectionRepo.updateStatus(session.id, 'paused')).rejects.toThrow(
        /Invalid lifecycle transition/
      );
    });

    it('should preserve actual calibrated zero distance as 0, not null', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Zero-Distance-Test' });
      expect(session.totalDistanceMeters).toBeNull();

      // Update with measured zero (e.g. verified zero displacement from calibrated sensor)
      const updatedZero = await inspectionRepo.update(session.id, {
        totalDistanceMeters: 0,
      });

      expect(updatedZero?.totalDistanceMeters).toBe(0);
      expect(updatedZero?.totalDistanceMeters).not.toBeNull();

      // Verify persistence in MongoDB
      const reloaded = await inspectionRepo.findById(session.id);
      expect(reloaded?.totalDistanceMeters).toBe(0);
      expect(reloaded?.totalDistanceMeters).not.toBeNull();
    });

    it('should preserve positive calibrated distance', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Distance-Calibrated' });

      const updated = await inspectionRepo.update(session.id, {
        totalDistanceMeters: 38.75,
        defectCount: 3,
      });

      expect(updated?.totalDistanceMeters).toBe(38.75);
      expect(updated?.defectCount).toBe(3);

      const reloaded = await inspectionRepo.findById(session.id);
      expect(reloaded?.totalDistanceMeters).toBe(38.75);
    });

    it('should preserve explicit null distance update without coercing to zero', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Explicit-Null' });

      const updated = await inspectionRepo.update(session.id, {
        totalDistanceMeters: null,
      });

      expect(updated?.totalDistanceMeters).toBeNull();
      expect(updated?.totalDistanceMeters).not.toBe(0);
    });

    it('should reject negative totalDistanceMeters during update via database schema validation', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Negative-Dist' });

      await expect(
        inspectionRepo.update(session.id, { totalDistanceMeters: -5.0 })
      ).rejects.toThrow();
    });

    it('should reject duplicate inspectionId with 409 DUPLICATE_IDENTIFIER', async () => {
      const duplicateId = 'insp-duplicate-fixed-uuid';

      await inspectionRepo.create({
        conduitName: 'First-Session',
        ...({ id: duplicateId } as any),
      });

      await expect(
        inspectionRepo.create({
          conduitName: 'Second-Session-With-Same-Id',
          ...({ id: duplicateId } as any),
        })
      ).rejects.toThrow(/already exists/);
    });

    it('should handle atomic conditional updates to prevent race conditions on lifecycle state', async () => {
      const session = await inspectionRepo.create({ conduitName: 'Atomic-Race-Test' });

      // Run parallel transitions: one valid (running), one illegal from ready (paused)
      const results = await Promise.allSettled([
        inspectionRepo.updateStatus(session.id, 'running'),
        inspectionRepo.updateStatus(session.id, 'paused'),
      ]);

      // Exactly one succeeds ('running') and the invalid one ('paused' from 'ready') is rejected
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const finalDoc = await inspectionRepo.findById(session.id);
      expect(finalDoc?.status).toBe('running');
    });
  });

  // =========================================================================
  // 2. MongoDefectRepository Tests
  // =========================================================================
  describe('MongoDefectRepository', () => {
    it('should reject defect creation if parent inspection does not exist (404)', async () => {
      await expect(
        defectRepo.create({
          inspectionId: 'non-existent-inspection-id',
          classId: 1,
          className: 'crack',
          confidence: 0.92,
          estimatedDistance: null,
          frameId: 'frm-001',
          frameCaptureTimestamp: new Date().toISOString(),
          reviewStatus: 'UNREVIEWED',
          evidenceImagePath: 'evidence/insp-xyz/defects/frm-001.jpg',
        })
      ).rejects.toThrow(/Referenced parent inspection session.*was not found/);
    });

    it('should create and retrieve a defect record with truthful null estimated distance', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Defect-Parent-1' });

      const defect = await defectRepo.create({
        inspectionId: parent.id,
        classId: 2,
        className: 'joint_displacement',
        confidence: 0.88,
        estimatedDistance: null, // Uncalibrated distance
        frameId: 'frm-101',
        frameCaptureTimestamp: '2026-11-01T10:00:00.000Z',
        inferenceTimestamp: '2026-11-01T10:00:00.085Z',
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: `evidence/${parent.id}/defects/frm-101.jpg`,
        boundingBox: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 },
      });

      expect(defect.id).toBeDefined();
      expect(defect.inspectionId).toBe(parent.id);
      expect(defect.classId).toBe(2);
      expect(defect.className).toBe('joint_displacement');
      expect(defect.confidence).toBe(0.88);
      expect(defect.estimatedDistance).toBeNull();
      expect(defect.frameId).toBe('frm-101');
      expect(defect.frameCaptureTimestamp).toBe('2026-11-01T10:00:00.000Z');
      expect(defect.inferenceTimestamp).toBe('2026-11-01T10:00:00.085Z');
      expect(defect.reviewStatus).toBe('UNREVIEWED');
      expect(defect.boundingBox).toEqual({ x: 0.1, y: 0.2, width: 0.4, height: 0.3 });

      // Verify no leakage of Mongoose internals
      expect((defect as any)._id).toBeUndefined();
      expect((defect as any).__v).toBeUndefined();

      const retrieved = await defectRepo.findById(defect.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(defect.id);
      expect(retrieved?.estimatedDistance).toBeNull();
    });

    it('should filter defects by inspectionId, reviewStatus, and classId', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Filter-Conduit' });

      await defectRepo.create({
        inspectionId: parent.id,
        classId: 1,
        className: 'crack',
        confidence: 0.91,
        estimatedDistance: 2.5,
        frameId: 'f1',
        frameCaptureTimestamp: '2026-11-01T10:01:00.000Z',
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'path1.jpg',
      });

      await defectRepo.create({
        inspectionId: parent.id,
        classId: 1,
        className: 'crack',
        confidence: 0.94,
        estimatedDistance: 4.8,
        frameId: 'f2',
        frameCaptureTimestamp: '2026-11-01T10:02:00.000Z',
        reviewStatus: 'CONFIRMED',
        evidenceImagePath: 'path2.jpg',
      });

      await defectRepo.create({
        inspectionId: parent.id,
        classId: 3,
        className: 'blockage',
        confidence: 0.82,
        estimatedDistance: 7.1,
        frameId: 'f3',
        frameCaptureTimestamp: '2026-11-01T10:03:00.000Z',
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'path3.jpg',
      });

      const unreviewedCracks = await defectRepo.findMany({
        inspectionId: parent.id,
        reviewStatus: 'UNREVIEWED',
        classId: 1,
      });

      expect(unreviewedCracks.items.length).toBe(1);
      expect(unreviewedCracks.items[0]?.className).toBe('crack');
      expect(unreviewedCracks.items[0]?.confidence).toBe(0.91);

      const confirmed = await defectRepo.findMany({
        inspectionId: parent.id,
        reviewStatus: 'CONFIRMED',
      });
      expect(confirmed.items.length).toBe(1);
      expect(confirmed.items[0]?.frameId).toBe('f2');
    });

    it('should update review status while preserving immutable detection evidence', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Immutability-Check' });

      const defect = await defectRepo.create({
        inspectionId: parent.id,
        classId: 1,
        className: 'crack',
        confidence: 0.95,
        estimatedDistance: 3.14,
        frameId: 'frm-fixed-evidence',
        frameCaptureTimestamp: '2026-11-01T10:10:00.000Z',
        inferenceTimestamp: '2026-11-01T10:10:00.050Z',
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'immutable/evidence/path.jpg',
        boundingBox: { x: 0.2, y: 0.3, width: 0.5, height: 0.4 },
      });

      const updated = await defectRepo.updateReview(defect.id, {
        reviewStatus: 'CONFIRMED',
        operatorNotes: 'Verified structural circumferential crack by certified operator',
      });

      expect(updated?.reviewStatus).toBe('CONFIRMED');
      expect(updated?.operatorNotes).toBe(
        'Verified structural circumferential crack by certified operator'
      );

      // CRITICAL: Detection evidence MUST be completely unchanged
      expect(updated?.classId).toBe(1);
      expect(updated?.className).toBe('crack');
      expect(updated?.confidence).toBe(0.95);
      expect(updated?.estimatedDistance).toBe(3.14);
      expect(updated?.frameId).toBe('frm-fixed-evidence');
      expect(updated?.frameCaptureTimestamp).toBe('2026-11-01T10:10:00.000Z');
      expect(updated?.inferenceTimestamp).toBe('2026-11-01T10:10:00.050Z');
      expect(updated?.evidenceImagePath).toBe('immutable/evidence/path.jpg');
      expect(updated?.boundingBox).toEqual({ x: 0.2, y: 0.3, width: 0.5, height: 0.4 });
    });

    it('should reject invalid confidence values (out of 0.0 - 1.0 range)', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Confidence-Bound-Test' });

      await expect(
        defectRepo.create({
          inspectionId: parent.id,
          classId: 1,
          className: 'crack',
          confidence: 1.5, // Invalid > 1.0
          estimatedDistance: 1.0,
          frameId: 'f-bad',
          frameCaptureTimestamp: new Date().toISOString(),
          reviewStatus: 'UNREVIEWED',
          evidenceImagePath: 'bad.jpg',
        })
      ).rejects.toThrow();

      await expect(
        defectRepo.create({
          inspectionId: parent.id,
          classId: 1,
          className: 'crack',
          confidence: -0.1, // Invalid < 0.0
          estimatedDistance: 1.0,
          frameId: 'f-bad2',
          frameCaptureTimestamp: new Date().toISOString(),
          reviewStatus: 'UNREVIEWED',
          evidenceImagePath: 'bad2.jpg',
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate defectId with 409 DUPLICATE_IDENTIFIER', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Duplicate-Defect-Parent' });
      const defectId = 'defect-fixed-duplicate-uuid';

      await defectRepo.create({
        inspectionId: parent.id,
        classId: 1,
        className: 'crack',
        confidence: 0.85,
        estimatedDistance: 2.0,
        frameId: 'f1',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'p1.jpg',
        ...({ id: defectId } as any),
      });

      await expect(
        defectRepo.create({
          inspectionId: parent.id,
          classId: 2,
          className: 'joint_displacement',
          confidence: 0.9,
          estimatedDistance: 3.0,
          frameId: 'f2',
          frameCaptureTimestamp: new Date().toISOString(),
          reviewStatus: 'UNREVIEWED',
          evidenceImagePath: 'p2.jpg',
          ...({ id: defectId } as any),
        })
      ).rejects.toThrow(/already exists/);
    });
  });

  // =========================================================================
  // 3. MongoReportRepository Tests
  // =========================================================================
  describe('MongoReportRepository', () => {
    it('should reject report creation if parent inspection does not exist (404)', async () => {
      await expect(
        reportRepo.create({
          inspectionId: 'missing-inspection-session',
          status: 'pending',
          compiledTimestamp: null,
          fileSizeBytes: null,
          totalDistanceMeters: null,
          defectCount: null,
          pdfRelativePath: null,
          backupVerified: false,
        })
      ).rejects.toThrow(/Referenced inspection session.*was not found/);
    });

    it('should create pending report with truthful null file metadata and retrieve it', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Report-Parent-1' });

      const report = await reportRepo.create({
        inspectionId: parent.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
        note: 'Awaiting Stage 11 PDF compiler execution',
      });

      expect(report.id).toBeDefined();
      expect(report.inspectionId).toBe(parent.id);
      expect(report.status).toBe('pending');

      // CRITICAL: Must NEVER fabricate PDF path, size, or completion timestamp
      expect(report.pdfRelativePath).toBeNull();
      expect(report.fileSizeBytes).toBeNull();
      expect(report.compiledTimestamp).toBeNull();
      expect(report.totalDistanceMeters).toBeNull();
      expect(report.defectCount).toBeNull();
      expect(report.backupVerified).toBe(false);

      // Verify no leakage of Mongoose internals
      expect((report as any)._id).toBeUndefined();
      expect((report as any).__v).toBeUndefined();

      const byId = await reportRepo.findById(report.id);
      expect(byId?.id).toBe(report.id);

      const byInspectionId = await reportRepo.findByInspectionId(parent.id);
      expect(byInspectionId?.id).toBe(report.id);
      expect(byInspectionId?.status).toBe('pending');
    });

    it('should list all reports', async () => {
      const p1 = await inspectionRepo.create({ conduitName: 'Report-Line-1' });
      const p2 = await inspectionRepo.create({ conduitName: 'Report-Line-2' });

      await reportRepo.create({
        inspectionId: p1.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      await reportRepo.create({
        inspectionId: p2.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      const list = await reportRepo.findMany();
      expect(list.length).toBe(2);
    });

    it('should update valid report status: pending -> generating -> completed', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Report-Status-Progression' });

      const report = await reportRepo.create({
        inspectionId: parent.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      const generating = await reportRepo.update(report.id, { status: 'generating' });
      expect(generating?.status).toBe('generating');

      const compiledTimestamp = new Date().toISOString();
      const completed = await reportRepo.update(report.id, {
        status: 'completed',
        compiledTimestamp,
        fileSizeBytes: 1048576,
        totalDistanceMeters: 25.4,
        defectCount: 2,
        pdfRelativePath: `reports/${parent.id}/inspection_report.pdf`,
        backupVerified: true,
      });

      expect(completed?.status).toBe('completed');
      expect(completed?.fileSizeBytes).toBe(1048576);
      expect(completed?.totalDistanceMeters).toBe(25.4);
      expect(completed?.defectCount).toBe(2);
      expect(completed?.pdfRelativePath).toBe(`reports/${parent.id}/inspection_report.pdf`);
      expect(completed?.backupVerified).toBe(true);
    });

    it('should reject invalid report status transition from completed to pending with 409', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Terminal-Report-Test' });

      const report = await reportRepo.create({
        inspectionId: parent.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      await reportRepo.update(report.id, { status: 'generating' });
      await reportRepo.update(report.id, { status: 'completed' });

      await expect(reportRepo.update(report.id, { status: 'pending' })).rejects.toThrow(
        /Invalid report status transition/
      );
    });

    it('should reject duplicate reportId with 409 DUPLICATE_IDENTIFIER', async () => {
      const parent = await inspectionRepo.create({ conduitName: 'Dup-Report-Parent' });
      const reportId = 'report-dup-fixed-uuid';

      await reportRepo.create({
        inspectionId: parent.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
        ...({ id: reportId } as any),
      });

      await expect(
        reportRepo.create({
          inspectionId: parent.id,
          status: 'pending',
          compiledTimestamp: null,
          fileSizeBytes: null,
          totalDistanceMeters: null,
          defectCount: null,
          pdfRelativePath: null,
          backupVerified: false,
          ...({ id: reportId } as any),
        })
      ).rejects.toThrow(/already exists/);
    });
  });
});
