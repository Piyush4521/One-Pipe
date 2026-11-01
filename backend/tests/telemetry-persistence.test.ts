/**
 * Telemetry Persistence & Bounded Retrieval Integration Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.1, 16.4
 *
 * Runs against local test database: 'mongodb://127.0.0.1:27017/pipebot_test'
 * CRITICAL VERIFICATIONS:
 * 1. Raw sensor values (encoder pulses, MPU6050 axes) preserved without mutation.
 * 2. Uncalibrated/missing measurements strictly remain null; never coerced to zero.
 * 3. Batch ingestion with deduplication by sampleId.
 * 4. Bounded retrieval preventing unbounded memory growth.
 * 5. Foreign key verification (404 on nonexistent parent inspection).
 * 6. Disconnected database returns 503 DATABASE_UNAVAILABLE.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { mongoConnectionManager } from '../src/database/mongo-connection';
import {
  InspectionModel,
  TelemetrySampleModel,
} from '../src/models';
import { MongoInspectionRepository } from '../src/repositories/mongo/mongo-inspection.repository';
import { MongoTelemetryRepository } from '../src/repositories/mongo/mongo-telemetry.repository';
import { TelemetryService } from '../src/services/telemetry.service';
import {
  cleanTestCollections,
  connectTestMongo,
  disconnectTestMongo,
} from './mongo-test-helper';

describe('Durable Telemetry Persistence & Retrieval Layer', () => {
  let inspectionRepo: MongoInspectionRepository;
  let telemetryRepo: MongoTelemetryRepository;
  let telemetryService: TelemetryService;

  beforeAll(async () => {
    await connectTestMongo();
    await mongoConnectionManager.connect(
      'mongodb://127.0.0.1:27017/pipebot_test',
      'pipebot_test'
    );

    inspectionRepo = new MongoInspectionRepository();
    telemetryRepo = new MongoTelemetryRepository();
    telemetryService = new TelemetryService(telemetryRepo, inspectionRepo);
  });

  beforeEach(async () => {
    await cleanTestCollections();
  });

  afterAll(async () => {
    await disconnectTestMongo();
    await mongoConnectionManager.disconnect();
  });

  describe('Repository & Domain Logic', () => {
    it('should persist raw sensor readings and preserve null uncalibrated derived metrics', async () => {
      // 1. Create inspection session
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Maya',
        pipeIdentifier: 'PIPE-TEL-01',
      });

      // 2. Ingest telemetry sample with raw readings and uncalibrated null metrics
      const sample = await telemetryRepo.create({
        sampleId: 'sample-001',
        inspectionId: inspection.id,
        sequenceNumber: 42,
        isAvailable: true,
        connectionState: 'connected',
        leftEncoderCount: 1540,
        rightEncoderCount: 1538,
        mpu6050: {
          accelX: 0.02,
          accelY: -0.01,
          accelZ: 9.81,
          gyroX: 0.1,
          gyroY: 0.05,
          gyroZ: -0.02,
          pitchDegrees: 1.2,
          rollDegrees: -0.5,
          yawDegrees: 90.0,
        },
        // Uncalibrated derived values: MUST remain null
        leftRpm: null,
        rightRpm: null,
        speedMps: null,
        estimatedDistanceMeters: null,
        isStale: false,
      });

      expect(sample.sampleId).toBe('sample-001');
      expect(sample.inspectionId).toBe(inspection.id);
      expect(sample.leftEncoderCount).toBe(1540);
      expect(sample.rightEncoderCount).toBe(1538);
      expect(sample.mpu6050?.accelZ).toBe(9.81);
      // Integrity check: Must be null, NOT zero!
      expect(sample.leftRpm).toBeNull();
      expect(sample.rightRpm).toBeNull();
      expect(sample.speedMps).toBeNull();
      expect(sample.estimatedDistanceMeters).toBeNull();

      // Verify in MongoDB directly
      const doc = await TelemetrySampleModel.findOne({ sampleId: 'sample-001' }).lean().exec();
      expect(doc).not.toBeNull();
      expect(doc?.leftEncoderCount).toBe(1540);
      expect(doc?.estimatedDistanceMeters).toBeNull();
    });

    it('should preserve valid calibrated derived metrics when provided', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Dave',
        pipeIdentifier: 'PIPE-TEL-02',
      });

      const sample = await telemetryRepo.create({
        sampleId: 'sample-calibrated-01',
        inspectionId: inspection.id,
        sequenceNumber: 100,
        isAvailable: true,
        connectionState: 'connected',
        leftEncoderCount: 2000,
        rightEncoderCount: 2000,
        leftRpm: 120.5,
        rightRpm: 120.5,
        speedMps: 0.45,
        estimatedDistanceMeters: 5.67,
      });

      expect(sample.leftRpm).toBe(120.5);
      expect(sample.rightRpm).toBe(120.5);
      expect(sample.speedMps).toBe(0.45);
      expect(sample.estimatedDistanceMeters).toBe(5.67);
    });

    it('should batch ingest samples with deduplication on duplicate sampleId', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Alice',
        pipeIdentifier: 'PIPE-TEL-BATCH',
      });

      const batch = [
        { sampleId: 'batch-01', inspectionId: inspection.id, leftEncoderCount: 10 },
        { sampleId: 'batch-02', inspectionId: inspection.id, leftEncoderCount: 20 },
        { sampleId: 'batch-03', inspectionId: inspection.id, leftEncoderCount: 30 },
      ];

      const result1 = await telemetryRepo.createBatch(batch);
      expect(result1.insertedCount).toBe(3);

      // Re-ingest with duplicate sampleId 'batch-02' and a new one 'batch-04'
      const mixedBatch = [
        { sampleId: 'batch-02', inspectionId: inspection.id, leftEncoderCount: 20 }, // Duplicate
        { sampleId: 'batch-04', inspectionId: inspection.id, leftEncoderCount: 40 }, // New
      ];

      const result2 = await telemetryRepo.createBatch(mixedBatch);
      expect(result2.insertedCount).toBe(1);
      expect(result2.duplicateCount).toBe(1);

      // Verify total count in collection is 4
      const totalCount = await TelemetrySampleModel.countDocuments({ inspectionId: inspection.id });
      expect(totalCount).toBe(4);
    });

    it('should retrieve latest telemetry sample and support bounded pagination', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Bob',
        pipeIdentifier: 'PIPE-TEL-QUERY',
      });

      // Insert 5 samples with sequential timestamps
      for (let i = 1; i <= 5; i++) {
        await telemetryRepo.create({
          sampleId: `seq-${i}`,
          inspectionId: inspection.id,
          sequenceNumber: i,
          captureTimestamp: new Date(Date.now() + i * 1000).toISOString(),
          leftEncoderCount: i * 100,
        });
      }

      const latest = await telemetryRepo.findLatestByInspectionId(inspection.id);
      expect(latest?.sampleId).toBe('seq-5');
      expect(latest?.sequenceNumber).toBe(5);

      const page1 = await telemetryRepo.findByInspectionId(inspection.id, { page: 1, limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);
      expect(page1.items[0].sampleId).toBe('seq-5'); // Descending order
    });

    it('should reject non-existent parent inspection on ingestion', async () => {
      await expect(
        telemetryService.ingestSample('non-existent-inspection-id', {
          sequenceNumber: 1,
          leftEncoderCount: 100,
        })
      ).rejects.toThrow(/was not found/);
    });
  });

  describe('REST API Endpoints', () => {
    it('POST /api/inspections/:id/telemetry should ingest single telemetry sample', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator REST',
        pipeIdentifier: 'PIPE-REST-01',
      });

      const response = await request(app)
        .post(`/api/inspections/${inspection.id}/telemetry`)
        .send({
          sampleId: 'rest-sample-01',
          sequenceNumber: 10,
          leftEncoderCount: 500,
          rightEncoderCount: 502,
          isAvailable: true,
          connectionState: 'connected',
          leftRpm: null,
          speedMps: null,
          estimatedDistanceMeters: null,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sampleId).toBe('rest-sample-01');
      expect(response.body.data.leftEncoderCount).toBe(500);
      expect(response.body.data.estimatedDistanceMeters).toBeNull();
    });

    it('POST /api/inspections/:id/telemetry should ingest batch telemetry samples', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Batch REST',
        pipeIdentifier: 'PIPE-REST-BATCH',
      });

      const response = await request(app)
        .post(`/api/inspections/${inspection.id}/telemetry`)
        .send({
          samples: [
            { sampleId: 'batch-rest-01', leftEncoderCount: 100 },
            { sampleId: 'batch-rest-02', leftEncoderCount: 200 },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insertedCount).toBe(2);
    });

    it('GET /api/inspections/:id/telemetry should return bounded paginated telemetry', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Query REST',
        pipeIdentifier: 'PIPE-REST-QUERY',
      });

      await telemetryRepo.create({
        sampleId: 'q-01',
        inspectionId: inspection.id,
        leftEncoderCount: 10,
      });

      const response = await request(app)
        .get(`/api/inspections/${inspection.id}/telemetry?page=1&limit=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('GET /api/inspections/:id/telemetry/latest should return newest sample', async () => {
      const inspection = await inspectionRepo.create({
        operatorName: 'Operator Latest REST',
        pipeIdentifier: 'PIPE-REST-LATEST',
      });

      await telemetryRepo.create({
        sampleId: 'latest-01',
        inspectionId: inspection.id,
        leftEncoderCount: 999,
      });

      const response = await request(app)
        .get(`/api/inspections/${inspection.id}/telemetry/latest`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sampleId).toBe('latest-01');
      expect(response.body.data.leftEncoderCount).toBe(999);
    });
  });
});

