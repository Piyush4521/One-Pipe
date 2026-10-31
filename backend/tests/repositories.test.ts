import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryDefectRepository } from '../src/repositories/memory/memory-defect.repository';
import { MemoryInspectionRepository } from '../src/repositories/memory/memory-inspection.repository';
import { MemoryReportRepository } from '../src/repositories/memory/memory-report.repository';

describe('Test-Only In-Memory Repositories', () => {
  describe('MemoryInspectionRepository', () => {
    let repo: MemoryInspectionRepository;

    beforeEach(() => {
      repo = new MemoryInspectionRepository();
    });

    it('should create and retrieve an inspection by ID', async () => {
      const created = await repo.create({ conduitName: 'Conduit-Alpha' });
      expect(created.id).toBeDefined();
      expect(created.conduitName).toBe('Conduit-Alpha');
      expect(created.status).toBe('ready');

      const found = await repo.findById(created.id);
      expect(found).toEqual(created);
    });

    it('should filter and paginate inspections', async () => {
      for (let i = 1; i <= 25; i++) {
        await repo.create({ conduitName: `Line-${i}` });
      }

      const page1 = await repo.findMany({ page: 1, limit: 10 });
      expect(page1.items.length).toBe(10);
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(3);

      const page3 = await repo.findMany({ page: 3, limit: 10 });
      expect(page3.items.length).toBe(5);
    });

    it('should update inspection fields and status', async () => {
      const created = await repo.create({ conduitName: 'Line-B' });
      const updated = await repo.update(created.id, { totalDistanceMeters: 14.5, defectCount: 2 });
      expect(updated?.totalDistanceMeters).toBe(14.5);
      expect(updated?.defectCount).toBe(2);

      const statusUpdated = await repo.updateStatus(created.id, 'running');
      expect(statusUpdated?.status).toBe('running');
    });
  });

  describe('MemoryDefectRepository', () => {
    let repo: MemoryDefectRepository;

    beforeEach(() => {
      repo = new MemoryDefectRepository();
    });

    it('should create and retrieve defect records with review status', async () => {
      const defect = await repo.create({
        inspectionId: 'insp-123',
        classId: 1,
        className: 'crack',
        confidence: 0.94,
        estimatedDistance: 3.42,
        frameId: 'frm-001',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'inspections/insp-123/defects/frm-001.jpg',
      });

      expect(defect.id).toBeDefined();
      expect(defect.reviewStatus).toBe('UNREVIEWED');

      const updated = await repo.updateReview(defect.id, {
        reviewStatus: 'CONFIRMED',
        operatorNotes: 'Verified longitudinal crack',
      });

      expect(updated?.reviewStatus).toBe('CONFIRMED');
      expect(updated?.operatorNotes).toBe('Verified longitudinal crack');
    });

    it('should filter defects by inspectionId and reviewStatus', async () => {
      await repo.create({
        inspectionId: 'insp-A',
        classId: 1,
        className: 'crack',
        confidence: 0.88,
        estimatedDistance: 1.2,
        frameId: 'f1',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'path1',
      });

      await repo.create({
        inspectionId: 'insp-A',
        classId: 2,
        className: 'joint_displacement',
        confidence: 0.92,
        estimatedDistance: 2.5,
        frameId: 'f2',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'CONFIRMED',
        evidenceImagePath: 'path2',
      });

      const unreviewed = await repo.findMany({ inspectionId: 'insp-A', reviewStatus: 'UNREVIEWED' });
      expect(unreviewed.items.length).toBe(1);
      expect(unreviewed.items[0]?.className).toBe('crack');
    });
  });

  describe('MemoryReportRepository', () => {
    let repo: MemoryReportRepository;

    beforeEach(() => {
      repo = new MemoryReportRepository();
    });

    it('should create and find report by inspectionId with truthful initial nulls', async () => {
      const report = await repo.create({
        inspectionId: 'insp-999',
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      expect(report.id).toBeDefined();
      const found = await repo.findByInspectionId('insp-999');
      expect(found?.inspectionId).toBe('insp-999');
      expect(found?.pdfRelativePath).toBeNull();
      expect(found?.fileSizeBytes).toBeNull();
    });
  });
});
