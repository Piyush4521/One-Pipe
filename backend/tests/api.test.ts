import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import {
  defectRepository,
  inspectionRepository,
  reportRepository,
} from '../src/services/container';

const OPERATOR_TOKEN = env.OPERATOR_TOKEN;

describe('Stage 2 REST API Implementation Tests', () => {
  beforeEach(() => {
    inspectionRepository.clear();
    defectRepository.clear();
    reportRepository.clear();
  });

  describe('Robot & Safety Endpoints', () => {
    it('GET /api/robot/status should return truthful disconnected hardware state', async () => {
      const res = await request(app).get('/api/robot/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.state).toBe('disconnected');
      expect(res.body.data.lastHeartbeat).toBeNull();
      expect(res.body.data.ipAddress).toBeNull();
      expect(res.body.data.reconnectAttempts).toBe(0);
      expect(res.body.data.errorMessage).toContain('Stage 5');
    });

    it('POST /api/robot/commands should reject requests without operator token (403)', async () => {
      const res = await request(app)
        .post('/api/robot/commands')
        .send({ linearVelocity: 0.5, angularVelocity: 0.0, durationMs: 100 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROLE_UNAUTHORIZED');
    });

    it('POST /api/robot/commands should block movement commands with 503 in Stage 2 even with valid token', async () => {
      const res = await request(app)
        .post('/api/robot/commands')
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ linearVelocity: 0.5, angularVelocity: 0.0, durationMs: 100 });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FEATURE_DISABLED');
      expect(res.body.error.message).toContain('Stage 5');
    });

    it('POST /api/robot/emergency-stop should acknowledge software request without claiming physical stop', async () => {
      const res = await request(app).post('/api/robot/emergency-stop');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REQUEST_ACCEPTED');
      expect(res.body.data.physicalStopConfirmed).toBe(false);
      expect(res.body.data.safetyNotice).toContain('PHYSICAL STOP NOT CONFIRMED');
      expect(res.body.data.safetyNotice).toContain('dedicated physical emergency stop button');
    });
  });

  describe('Inspection Lifecycle APIs', () => {
    it('POST /api/inspections should reject requests without operator authority', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .send({ conduitName: 'Storm Drain A-1' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ROLE_UNAUTHORIZED');
    });

    it('POST /api/inspections should reject invalid payloads with 400', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ conduitName: '', unknownField: 123 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/inspections should create new session in ready state with operator authority', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ conduitName: 'Storm Drain A-1', operatorNotes: 'Pre-shift test' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.conduitName).toBe('Storm Drain A-1');
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.totalDistanceMeters).toBe(0);
      expect(res.body.data.defectCount).toBe(0);
    });

    it('GET /api/inspections should list inspections with pagination', async () => {
      await inspectionRepository.create({ conduitName: 'Line 1' });
      await inspectionRepository.create({ conduitName: 'Line 2' });

      const res = await request(app).get('/api/inspections?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.page).toBe(1);
    });

    it('GET /api/inspections/:id should retrieve single inspection or 404', async () => {
      const created = await inspectionRepository.create({ conduitName: 'Line X' });

      const res = await request(app).get(`/api/inspections/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.id);

      const notFound = await request(app).get('/api/inspections/non-existent-id');
      expect(notFound.status).toBe(404);
      expect(notFound.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });

    it('should execute complete lifecycle sequence: ready -> running -> paused -> running -> completed', async () => {
      const created = await inspectionRepository.create({ conduitName: 'Sequence-Line' });

      // 1. Start inspection (ready -> running)
      const startRes = await request(app)
        .post(`/api/inspections/${created.id}/start`)
        .set('x-operator-token', OPERATOR_TOKEN);
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.status).toBe('running');

      // 2. Pause inspection (running -> paused)
      const pauseRes = await request(app)
        .post(`/api/inspections/${created.id}/pause`)
        .set('x-operator-token', OPERATOR_TOKEN);
      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.status).toBe('paused');

      // 3. Resume inspection (paused -> running)
      const resumeRes = await request(app)
        .post(`/api/inspections/${created.id}/resume`)
        .set('x-operator-token', OPERATOR_TOKEN);
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.data.status).toBe('running');

      // 4. Complete inspection (running -> completed)
      const completeRes = await request(app)
        .post(`/api/inspections/${created.id}/complete`)
        .set('x-operator-token', OPERATOR_TOKEN);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
      expect(completeRes.body.data.endTimestamp).toBeDefined();

      // 5. Illegal transition after terminal state (completed -> running) must return 409
      const illegalRes = await request(app)
        .post(`/api/inspections/${created.id}/start`)
        .set('x-operator-token', OPERATOR_TOKEN);
      expect(illegalRes.status).toBe(409);
      expect(illegalRes.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });
  });

  describe('Defect Evidence APIs', () => {
    it('GET /api/defects should list defects with filter validation', async () => {
      await defectRepository.create({
        inspectionId: 'insp-1',
        classId: 1,
        className: 'crack',
        confidence: 0.95,
        estimatedDistance: 2.3,
        frameId: 'frm-1',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'inspections/insp-1/defects/frm-1.jpg',
      });

      const res = await request(app).get('/api/defects?inspectionId=insp-1');
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].className).toBe('crack');
      expect(res.body.data.items[0].confidence).toBe(0.95);
    });

    it('GET /api/defects/:id should retrieve single defect or return 404', async () => {
      const created = await defectRepository.create({
        inspectionId: 'insp-1',
        classId: 2,
        className: 'offset',
        confidence: 0.89,
        estimatedDistance: 4.1,
        frameId: 'frm-2',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'path',
      });

      const res = await request(app).get(`/api/defects/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.id);

      const notFound = await request(app).get('/api/defects/non-existent-defect-id');
      expect(notFound.status).toBe(404);
      expect(notFound.body.error.code).toBe('DEFECT_NOT_FOUND');
    });

    it('PATCH /api/defects/:id/review should require operator authority and update review status', async () => {
      const created = await defectRepository.create({
        inspectionId: 'insp-1',
        classId: 1,
        className: 'crack',
        confidence: 0.91,
        estimatedDistance: 5.6,
        frameId: 'frm-3',
        frameCaptureTimestamp: new Date().toISOString(),
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'path',
      });

      // 1. Without operator token -> 403
      const unauth = await request(app)
        .patch(`/api/defects/${created.id}/review`)
        .send({ reviewStatus: 'CONFIRMED' });
      expect(unauth.status).toBe(403);

      // 2. Invalid review enum -> 400
      const invalid = await request(app)
        .patch(`/api/defects/${created.id}/review`)
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ reviewStatus: 'INVALID_ENUM_STATUS' });
      expect(invalid.status).toBe(400);

      // 3. Valid update -> 200
      const updated = await request(app)
        .patch(`/api/defects/${created.id}/review`)
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ reviewStatus: 'CONFIRMED', operatorNotes: 'Operator visually verified' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.reviewStatus).toBe('CONFIRMED');
      expect(updated.body.data.operatorNotes).toBe('Operator visually verified');
    });
  });

  describe('Report Metadata APIs', () => {
    it('POST /api/reports should reject request if referenced inspection does not exist (404)', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ inspectionId: 'missing-inspection-id' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSPECTION_NOT_FOUND');
    });

    it('POST /api/reports should reject report request if inspection is not completed (409)', async () => {
      const inspection = await inspectionRepository.create({ conduitName: 'Uncompleted Line' });
      expect(inspection.status).toBe('ready');

      const res = await request(app)
        .post('/api/reports')
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ inspectionId: inspection.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INSPECTION_NOT_COMPLETED');
    });

    it('POST /api/reports should register pending report metadata without fabricating PDF path or metrics (201)', async () => {
      const inspection = await inspectionRepository.create({ conduitName: 'Completed Line' });
      await inspectionRepository.updateStatus(inspection.id, 'completed');

      const res = await request(app)
        .post('/api/reports')
        .set('x-operator-token', OPERATOR_TOKEN)
        .send({ inspectionId: inspection.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.inspectionId).toBe(inspection.id);
      expect(res.body.data.status).toBe('pending');
      // Must NOT fabricate PDF file path or file size before real generation
      expect(res.body.data.pdfRelativePath).toBeNull();
      expect(res.body.data.fileSizeBytes).toBeNull();
      expect(res.body.data.totalDistanceMeters).toBeNull();
      expect(res.body.data.defectCount).toBeNull();
      expect(res.body.data.compiledTimestamp).toBeNull();
      expect(res.body.data.note).toContain('Stage 3');
    });

    it('GET /api/reports should list all report metadata records', async () => {
      const inspection = await inspectionRepository.create({ conduitName: 'Line' });
      await inspectionRepository.updateStatus(inspection.id, 'completed');
      await reportRepository.create({
        inspectionId: inspection.id,
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      const res = await request(app).get('/api/reports');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('GET /api/reports/:id should retrieve single report metadata or 404', async () => {
      const created = await reportRepository.create({
        inspectionId: 'insp-123',
        status: 'pending',
        compiledTimestamp: null,
        fileSizeBytes: null,
        totalDistanceMeters: null,
        defectCount: null,
        pdfRelativePath: null,
        backupVerified: false,
      });

      const res = await request(app).get(`/api/reports/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.id);

      const notFound = await request(app).get('/api/reports/non-existent-report-id');
      expect(notFound.status).toBe(404);
      expect(notFound.body.error.code).toBe('REPORT_NOT_FOUND');
    });
  });
});
