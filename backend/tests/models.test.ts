/**
 * Mongoose Schemas & Database Models Isolated Unit Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 11, 14, 16.4, 17
 *
 * NOTE: These tests validate Mongoose schema rules, validation constraints,
 * enums, nullability, and invariants in-memory WITHOUT requiring an active MongoDB daemon.
 */

import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  DefectModel,
  InspectionModel,
  ReportModel,
  SystemEventModel,
  TelemetrySampleModel,
} from '../src/models';

describe('Mongoose Schemas & Database Models Unit Tests', () => {
  describe('InspectionModel Schema Validation', () => {
    it('should validate a complete, valid inspection session document', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-001',
        conduitName: 'North-Pipe-Line-A',
        startTimestamp: new Date('2026-11-01T00:00:00.000Z'),
        endTimestamp: new Date('2026-11-01T00:30:00.000Z'),
        durationSeconds: 1800,
        totalDistanceMeters: 25.4,
        defectCount: 2,
        status: 'running',
        reportGenerated: false,
        backupVerified: false,
        operatorNotes: 'Routine conduit inspection',
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.status).toBe('running');
      expect(doc.totalDistanceMeters).toBe(25.4);
    });

    it('should populate default values when optional fields are omitted', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-002',
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.status).toBe('ready');
      expect(doc.totalDistanceMeters).toBeNull(); // Defaults to null when odometry is uncalibrated
      expect(doc.defectCount).toBe(0);
      expect(doc.reportGenerated).toBe(false);
      expect(doc.backupVerified).toBe(false);
      expect(doc.conduitName).toBeNull();
      expect(doc.endTimestamp).toBeNull();
      expect(doc.durationSeconds).toBeNull();
      expect(doc.operatorNotes).toBeNull();
      expect(doc.startTimestamp).toBeInstanceOf(Date);
    });

    it('should preserve explicit null for totalDistanceMeters without converting to zero', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-002b',
        totalDistanceMeters: null,
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.totalDistanceMeters).toBeNull();
      expect(doc.totalDistanceMeters).not.toBe(0);
    });

    it('should preserve a valid calibrated zero as zero without converting to null', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-002c',
        totalDistanceMeters: 0,
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.totalDistanceMeters).toBe(0);
      expect(doc.totalDistanceMeters).not.toBeNull();
    });

    it('should preserve a valid positive calibrated distance', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-002d',
        totalDistanceMeters: 42.15,
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.totalDistanceMeters).toBe(42.15);
    });

    it('should reject invalid negative or non-finite totalDistanceMeters', () => {
      const docNegative = new InspectionModel({
        inspectionId: 'insp-uuid-neg',
        totalDistanceMeters: -0.01,
      });
      const errNeg = docNegative.validateSync();
      expect(errNeg?.errors['totalDistanceMeters']).toBeDefined();

      const docNaN = new InspectionModel({
        inspectionId: 'insp-uuid-nan',
        totalDistanceMeters: Number.NaN,
      });
      const errNaN = docNaN.validateSync();
      expect(errNaN?.errors['totalDistanceMeters']).toBeDefined();

      const docInf = new InspectionModel({
        inspectionId: 'insp-uuid-inf',
        totalDistanceMeters: Number.POSITIVE_INFINITY,
      });
      const errInf = docInf.validateSync();
      expect(errInf?.errors['totalDistanceMeters']).toBeDefined();
    });

    it('should fail validation when inspectionId is missing', () => {
      const doc = new InspectionModel({});
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['inspectionId']).toBeDefined();
      expect(err?.errors['inspectionId'].message).toContain('inspectionId is required');
    });

    it('should reject invalid lifecycle status values, including "disconnected"', () => {
      // Disconnected is a robot hardware connection state, NOT an inspection lifecycle state
      const docWithDisconnected = new InspectionModel({
        inspectionId: 'insp-uuid-003',
        status: 'disconnected' as any,
      });
      const err1 = docWithDisconnected.validateSync();
      expect(err1).toBeDefined();
      expect(err1?.errors['status']).toBeDefined();

      const docWithInvalid = new InspectionModel({
        inspectionId: 'insp-uuid-004',
        status: 'unknown_status' as any,
      });
      const err2 = docWithInvalid.validateSync();
      expect(err2).toBeDefined();
      expect(err2?.errors['status']).toBeDefined();
    });

    it('should reject negative totalDistanceMeters and negative durationSeconds', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-005',
        totalDistanceMeters: -5.0,
        durationSeconds: -10,
      });
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['totalDistanceMeters']).toBeDefined();
      expect(err?.errors['durationSeconds']).toBeDefined();
    });

    it('should reject non-integer defectCount', () => {
      const doc = new InspectionModel({
        inspectionId: 'insp-uuid-006',
        defectCount: 3.5,
      });
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['defectCount']).toBeDefined();
      expect(err?.errors['defectCount'].message).toContain('defectCount must be an integer');
    });
  });

  describe('DefectModel Schema Validation', () => {
    it('should validate a complete, valid defect document with bounding box', () => {
      const doc = new DefectModel({
        defectId: 'defect-uuid-001',
        inspectionId: 'insp-uuid-001',
        classId: 0,
        className: 'crack_longitudinal',
        confidence: 0.94,
        boundingBox: {
          x: 0.25,
          y: 0.3,
          width: 0.4,
          height: 0.2,
        },
        frameId: 'frame-00142',
        frameCaptureTimestamp: new Date('2026-11-01T00:15:30.000Z'),
        inferenceTimestamp: new Date('2026-11-01T00:15:30.120Z'),
        estimatedDistance: 12.35,
        reviewStatus: 'UNREVIEWED',
        evidenceImagePath: 'storage/inspections/insp-uuid-001/defects/def_001.jpg',
        operatorNotes: 'Visible hairline fissure on crown',
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.confidence).toBe(0.94);
      expect(doc.reviewStatus).toBe('UNREVIEWED');
      expect(doc.boundingBox?.width).toBe(0.4);
    });

    it('should enforce that confidence is bounded between 0.0 and 1.0', () => {
      const docNegative = new DefectModel({
        defectId: 'def-002',
        inspectionId: 'insp-001',
        classId: 1,
        className: 'joint_displacement',
        confidence: -0.05,
        frameId: 'f-1',
        frameCaptureTimestamp: new Date(),
        evidenceImagePath: 'def.jpg',
      });
      expect(docNegative.validateSync()?.errors['confidence']).toBeDefined();

      const docExceeded = new DefectModel({
        defectId: 'def-003',
        inspectionId: 'insp-001',
        classId: 1,
        className: 'joint_displacement',
        confidence: 1.05,
        frameId: 'f-1',
        frameCaptureTimestamp: new Date(),
        evidenceImagePath: 'def.jpg',
      });
      expect(docExceeded.validateSync()?.errors['confidence']).toBeDefined();

      const docValidMin = new DefectModel({
        defectId: 'def-004',
        inspectionId: 'insp-001',
        classId: 1,
        className: 'joint_displacement',
        confidence: 0.0,
        frameId: 'f-1',
        frameCaptureTimestamp: new Date(),
        evidenceImagePath: 'def.jpg',
      });
      expect(docValidMin.validateSync()).toBeUndefined();

      const docValidMax = new DefectModel({
        defectId: 'def-005',
        inspectionId: 'insp-001',
        classId: 1,
        className: 'joint_displacement',
        confidence: 1.0,
        frameId: 'f-1',
        frameCaptureTimestamp: new Date(),
        evidenceImagePath: 'def.jpg',
      });
      expect(docValidMax.validateSync()).toBeUndefined();
    });

    it('should confirm that schema contains no fabricated severity field', () => {
      // Rulebook § 14.5: Model confidence is NOT physical defect severity.
      expect(DefectModel.schema.path('severity')).toBeUndefined();
      expect(DefectModel.schema.path('defectSeverity')).toBeUndefined();
    });

    it('should preserve optical frame capture time separate from AI inference time', () => {
      const captureTime = new Date('2026-11-01T00:10:00.000Z');
      const inferenceTime = new Date('2026-11-01T00:10:00.085Z');

      const doc = new DefectModel({
        defectId: 'def-006',
        inspectionId: 'insp-001',
        classId: 2,
        className: 'debris_silt',
        confidence: 0.88,
        frameId: 'f-2',
        frameCaptureTimestamp: captureTime,
        inferenceTimestamp: inferenceTime,
        evidenceImagePath: 'path.jpg',
      });

      expect(doc.validateSync()).toBeUndefined();
      expect(doc.frameCaptureTimestamp.getTime()).toBe(captureTime.getTime());
      expect(doc.inferenceTimestamp?.getTime()).toBe(inferenceTime.getTime());
      expect(doc.frameCaptureTimestamp.getTime()).not.toBe(doc.inferenceTimestamp?.getTime());
    });

    it('should keep uncalibrated estimatedDistance as null without coercing to zero', () => {
      const doc = new DefectModel({
        defectId: 'def-007',
        inspectionId: 'insp-001',
        classId: 3,
        className: 'root_intrusion',
        confidence: 0.76,
        frameId: 'f-3',
        frameCaptureTimestamp: new Date(),
        evidenceImagePath: 'root.jpg',
      });

      expect(doc.validateSync()).toBeUndefined();
      expect(doc.estimatedDistance).toBeNull();
      expect(doc.estimatedDistance).not.toBe(0);
    });

    it('should reject invalid reviewStatus enums', () => {
      const doc = new DefectModel({
        defectId: 'def-008',
        inspectionId: 'insp-001',
        classId: 0,
        className: 'crack',
        confidence: 0.8,
        frameId: 'f-4',
        frameCaptureTimestamp: new Date(),
        evidenceImagePath: 'c.jpg',
        reviewStatus: 'APPROVED' as any, // Not an approved review status
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['reviewStatus']).toBeDefined();
    });
  });

  describe('ReportModel Schema Validation', () => {
    it('should validate a pending report record with truthful null file metrics', () => {
      const doc = new ReportModel({
        reportId: 'rep-uuid-001',
        inspectionId: 'insp-uuid-001',
        status: 'pending',
        backupVerified: false,
        note: 'Report compilation queued',
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.status).toBe('pending');
      expect(doc.compiledTimestamp).toBeNull();
      expect(doc.fileSizeBytes).toBeNull();
      expect(doc.totalDistanceMeters).toBeNull();
      expect(doc.defectCount).toBeNull();
      expect(doc.pdfRelativePath).toBeNull();
      expect(doc.backupVerified).toBe(false);
    });

    it('should validate a completed report record with valid compiled values', () => {
      const doc = new ReportModel({
        reportId: 'rep-uuid-002',
        inspectionId: 'insp-uuid-001',
        status: 'completed',
        compiledTimestamp: new Date('2026-11-01T01:00:00.000Z'),
        fileSizeBytes: 245760,
        totalDistanceMeters: 42.1,
        defectCount: 3,
        pdfRelativePath: 'storage/reports/insp-uuid-001/report.pdf',
        backupVerified: true,
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.fileSizeBytes).toBe(245760);
      expect(doc.pdfRelativePath).toBe('storage/reports/insp-uuid-001/report.pdf');
    });

    it('should fail validation when reportId or inspectionId is missing', () => {
      const doc = new ReportModel({});
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['reportId']).toBeDefined();
      expect(err?.errors['inspectionId']).toBeDefined();
    });

    it('should reject invalid report status values', () => {
      const doc = new ReportModel({
        reportId: 'rep-003',
        inspectionId: 'insp-001',
        status: 'published' as any,
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['status']).toBeDefined();
    });

    it('should reject negative or non-integer fileSizeBytes and defectCount', () => {
      const docNegative = new ReportModel({
        reportId: 'rep-004',
        inspectionId: 'insp-001',
        fileSizeBytes: -500,
        defectCount: -1,
      });
      const err1 = docNegative.validateSync();
      expect(err1?.errors['fileSizeBytes']).toBeDefined();
      expect(err1?.errors['defectCount']).toBeDefined();

      const docFloat = new ReportModel({
        reportId: 'rep-005',
        inspectionId: 'insp-001',
        fileSizeBytes: 1024.5,
      });
      const err2 = docFloat.validateSync();
      expect(err2?.errors['fileSizeBytes']).toBeDefined();
    });
  });

  describe('SystemEventModel Schema Validation', () => {
    it('should validate a standard system status change event', () => {
      const doc = new SystemEventModel({
        eventId: 'event-001',
        category: 'subsystem_status',
        subsystem: 'esp32',
        severity: 'warning',
        timestamp: new Date('2026-11-01T01:10:00.000Z'),
        message: 'ESP32 heartbeat dropped; link state is disconnected',
        details: { reconnectAttempts: 3 },
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.category).toBe('subsystem_status');
      expect(doc.physicalStopConfirmed).toBe(false);
    });

    it('should enforce that physicalStopConfirmed is strictly false for software emergency stop events', () => {
      const doc = new SystemEventModel({
        eventId: 'event-002',
        category: 'emergency_stop_request',
        subsystem: 'robot',
        severity: 'critical',
        message: 'Auxiliary software emergency stop request accepted by backend',
        details: { requestedBy: 'local_dashboard' },
        physicalStopConfirmed: false,
      });

      expect(doc.validateSync()).toBeUndefined();
      expect(doc.physicalStopConfirmed).toBe(false);
    });

    it('should fail validation when eventId, category, or message is missing', () => {
      const doc = new SystemEventModel({});
      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['eventId']).toBeDefined();
      expect(err?.errors['category']).toBeDefined();
      expect(err?.errors['message']).toBeDefined();
    });

    it('should reject invalid category or severity enums', () => {
      const doc = new SystemEventModel({
        eventId: 'event-003',
        category: 'unapproved_category' as any,
        severity: 'extreme' as any,
        message: 'Test message',
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['category']).toBeDefined();
      expect(err?.errors['severity']).toBeDefined();
    });
  });

  describe('TelemetrySampleModel Schema Validation', () => {
    it('should validate a complete, valid telemetry sample with raw and derived fields', () => {
      const doc = new TelemetrySampleModel({
        sampleId: 'telem-001',
        inspectionId: 'insp-001',
        captureTimestamp: new Date('2026-11-01T00:05:00.000Z'),
        sequenceNumber: 42,
        isAvailable: true,
        connectionState: 'connected',
        leftEncoderCount: 1250,
        rightEncoderCount: 1248,
        mpu6050: {
          accelX: 0.05,
          accelY: -0.02,
          accelZ: 9.81,
          gyroX: 0.1,
          gyroY: -0.1,
          gyroZ: 0.0,
          pitchDegrees: 1.5,
          rollDegrees: -0.4,
          yawDegrees: null,
        },
        leftRpm: 45.0,
        rightRpm: 44.8,
        speedMps: 0.15,
        estimatedDistanceMeters: 4.82,
        isStale: false,
        notes: 'Continuous straight crawl',
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.leftEncoderCount).toBe(1250);
      expect(doc.mpu6050?.accelZ).toBe(9.81);
      expect(doc.isAvailable).toBe(true);
    });

    it('should validate an unavailable telemetry sample with explicit nulls', () => {
      const doc = new TelemetrySampleModel({
        sampleId: 'telem-002',
        isAvailable: false,
        connectionState: 'disconnected',
        isStale: true,
        notes: 'Hardware telemetry producer detached in Stage 2/3',
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      // Ensure missing sensor measurements remain strictly null, not converted to 0
      expect(doc.leftEncoderCount).toBeNull();
      expect(doc.rightEncoderCount).toBeNull();
      expect(doc.leftRpm).toBeNull();
      expect(doc.rightRpm).toBeNull();
      expect(doc.speedMps).toBeNull();
      expect(doc.estimatedDistanceMeters).toBeNull();
      expect(doc.mpu6050).toBeNull();
    });

    it('should reject non-integer encoder pulse counts', () => {
      const doc = new TelemetrySampleModel({
        sampleId: 'telem-003',
        isAvailable: true,
        connectionState: 'connected',
        leftEncoderCount: 150.75, // Fractional pulse count is physically invalid
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['leftEncoderCount']).toBeDefined();
      expect(err?.errors['leftEncoderCount'].message).toContain('must be an integer or null');
    });

    it('should reject invalid connectionState enum', () => {
      const doc = new TelemetrySampleModel({
        sampleId: 'telem-004',
        connectionState: 'online' as any, // Not an approved connection state
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors['connectionState']).toBeDefined();
    });
  });

  describe('Model Registration & Isolation', () => {
    it('should register all 5 models without duplicate model naming collisions', () => {
      const registered = mongoose.modelNames();
      expect(registered).toContain('Inspection');
      expect(registered).toContain('Defect');
      expect(registered).toContain('Report');
      expect(registered).toContain('SystemEvent');
      expect(registered).toContain('TelemetrySample');
    });

    it('should confirm that models operate in strict schema mode', () => {
      expect(InspectionModel.schema.get('strict')).toBe(true);
      expect(DefectModel.schema.get('strict')).toBe(true);
      expect(ReportModel.schema.get('strict')).toBe(true);
      expect(SystemEventModel.schema.get('strict')).toBe(true);
      expect(TelemetrySampleModel.schema.get('strict')).toBe(true);
    });

    it('should confirm that timestamps option is enabled on all models', () => {
      expect(InspectionModel.schema.get('timestamps')).toBe(true);
      expect(DefectModel.schema.get('timestamps')).toBe(true);
      expect(ReportModel.schema.get('timestamps')).toBe(true);
      expect(SystemEventModel.schema.get('timestamps')).toBe(true);
      expect(TelemetrySampleModel.schema.get('timestamps')).toBe(true);
    });
  });
});

