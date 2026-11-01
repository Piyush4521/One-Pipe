/**
 * MongoDB Concrete Telemetry Repository Implementation
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.1, 16.4
 *
 * Implements ITelemetryRepository using Mongoose TelemetrySampleModel.
 * CRITICAL DATA-INTEGRITY CONSTRAINTS:
 * 1. Preserves raw sensor readings (leftEncoderCount, rightEncoderCount, mpu6050 axes) as recorded.
 * 2. Missing, unconfigured, or uncalibrated readings MUST remain NULL. Missing readings are NEVER coerced to zero.
 * 3. Derived metrics (RPM, speed, distance) remain null until mechanical calibration is performed.
 * 4. Continuous video is NEVER stored in MongoDB.
 * 5. Deduplication: Samples with duplicate sampleId are safely deduplicated.
 * 6. Internal Mongoose fields (__v, _id) are never leaked to domain callers.
 */

import { randomUUID } from 'crypto';
import { FilterQuery } from 'mongoose';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { ITelemetryRepository } from '../../interfaces/repositories';
import {
  BatchIngestResult,
  PersistedTelemetryRecord,
  TelemetryFilter,
  TelemetrySampleDTO,
  TelemetrySessionSummary,
} from '../../interfaces/telemetry.interface';
import { AppError } from '../../middleware/error.middleware';
import { InspectionModel } from '../../models/inspection.model';
import {
  ITelemetrySampleDocument,
  TelemetrySampleModel,
} from '../../models/telemetry-sample.model';
import { mongoConnectionManager } from '../../database/mongo-connection';

function assertDatabaseConnected(): void {
  if (!mongoConnectionManager.isConnected()) {
    const err: AppError = new Error(
      'Database is currently unavailable. Operation aborted to preserve data integrity.'
    );
    err.statusCode = 503;
    err.code = 'DATABASE_UNAVAILABLE';
    throw err;
  }
}

/**
 * Explicit mapper from Mongoose document to domain PersistedTelemetryRecord.
 */
export function mapTelemetryDocumentToRecord(
  doc: ITelemetrySampleDocument
): PersistedTelemetryRecord {
  return {
    sampleId: doc.sampleId,
    inspectionId: doc.inspectionId ?? null,
    captureTimestamp: doc.captureTimestamp ? doc.captureTimestamp.toISOString() : null,
    sequenceNumber: doc.sequenceNumber ?? null,
    isAvailable: doc.isAvailable,
    connectionState: doc.connectionState,
    leftEncoderCount: doc.leftEncoderCount ?? null,
    rightEncoderCount: doc.rightEncoderCount ?? null,
    mpu6050: doc.mpu6050
      ? {
          accelX: doc.mpu6050.accelX ?? null,
          accelY: doc.mpu6050.accelY ?? null,
          accelZ: doc.mpu6050.accelZ ?? null,
          gyroX: doc.mpu6050.gyroX ?? null,
          gyroY: doc.mpu6050.gyroY ?? null,
          gyroZ: doc.mpu6050.gyroZ ?? null,
          pitchDegrees: doc.mpu6050.pitchDegrees ?? null,
          rollDegrees: doc.mpu6050.rollDegrees ?? null,
          yawDegrees: doc.mpu6050.yawDegrees ?? null,
        }
      : null,
    leftRpm: doc.leftRpm ?? null,
    rightRpm: doc.rightRpm ?? null,
    speedMps: doc.speedMps ?? null,
    estimatedDistanceMeters: doc.estimatedDistanceMeters ?? null,
    isStale: doc.isStale,
    notes: doc.notes ?? undefined,
    createdAt: (doc as any).createdAt ? (doc as any).createdAt.toISOString() : undefined,
  };
}

export class MongoTelemetryRepository implements ITelemetryRepository {
  public async create(sample: TelemetrySampleDTO): Promise<PersistedTelemetryRecord> {
    assertDatabaseConnected();

    if (sample.inspectionId) {
      const inspectionExists = await InspectionModel.exists({
        inspectionId: sample.inspectionId,
      });
      if (!inspectionExists) {
        const err: AppError = new Error(
          `Referenced inspection session '${sample.inspectionId}' was not found.`
        );
        err.statusCode = 404;
        err.code = 'INSPECTION_NOT_FOUND';
        throw err;
      }
    }

    const sampleId = sample.sampleId || randomUUID();
    const captureTimestamp = sample.captureTimestamp
      ? new Date(sample.captureTimestamp)
      : new Date();

    const doc = new TelemetrySampleModel({
      sampleId,
      inspectionId: sample.inspectionId ?? null,
      captureTimestamp,
      sequenceNumber: sample.sequenceNumber !== undefined ? sample.sequenceNumber : null,
      isAvailable: sample.isAvailable ?? true,
      connectionState: sample.connectionState || 'connected',
      leftEncoderCount: sample.leftEncoderCount !== undefined ? sample.leftEncoderCount : null,
      rightEncoderCount: sample.rightEncoderCount !== undefined ? sample.rightEncoderCount : null,
      mpu6050: sample.mpu6050
        ? {
            accelX: sample.mpu6050.accelX ?? null,
            accelY: sample.mpu6050.accelY ?? null,
            accelZ: sample.mpu6050.accelZ ?? null,
            gyroX: sample.mpu6050.gyroX ?? null,
            gyroY: sample.mpu6050.gyroY ?? null,
            gyroZ: sample.mpu6050.gyroZ ?? null,
            pitchDegrees: sample.mpu6050.pitchDegrees ?? null,
            rollDegrees: sample.mpu6050.rollDegrees ?? null,
            yawDegrees: sample.mpu6050.yawDegrees ?? null,
          }
        : null,
      leftRpm: sample.leftRpm !== undefined ? sample.leftRpm : null,
      rightRpm: sample.rightRpm !== undefined ? sample.rightRpm : null,
      speedMps: sample.speedMps !== undefined ? sample.speedMps : null,
      estimatedDistanceMeters:
        sample.estimatedDistanceMeters !== undefined ? sample.estimatedDistanceMeters : null,
      isStale: sample.isStale ?? false,
      notes: sample.notes ?? null,
    });

    try {
      await doc.save();
    } catch (err: any) {
      if (err.code === 11000) {
        const conflictErr: AppError = new Error(
          `Telemetry sample with identifier '${sampleId}' already exists.`
        );
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_IDENTIFIER';
        throw conflictErr;
      }
      throw err;
    }

    return mapTelemetryDocumentToRecord(doc);
  }

  public async createBatch(samples: TelemetrySampleDTO[]): Promise<BatchIngestResult> {
    assertDatabaseConnected();
    if (samples.length === 0) {
      return { insertedCount: 0, duplicateCount: 0 };
    }

    // Process using bulkWrite with ordered: false to allow deduplication
    const operations = samples.map((sample) => {
      const sampleId = sample.sampleId || randomUUID();
      const captureTimestamp = sample.captureTimestamp
        ? new Date(sample.captureTimestamp)
        : new Date();

      return {
        insertOne: {
          document: {
            sampleId,
            inspectionId: sample.inspectionId ?? null,
            captureTimestamp,
            sequenceNumber: sample.sequenceNumber !== undefined ? sample.sequenceNumber : null,
            isAvailable: sample.isAvailable ?? true,
            connectionState: sample.connectionState || 'connected',
            leftEncoderCount:
              sample.leftEncoderCount !== undefined ? sample.leftEncoderCount : null,
            rightEncoderCount:
              sample.rightEncoderCount !== undefined ? sample.rightEncoderCount : null,
            mpu6050: sample.mpu6050
              ? {
                  accelX: sample.mpu6050.accelX ?? null,
                  accelY: sample.mpu6050.accelY ?? null,
                  accelZ: sample.mpu6050.accelZ ?? null,
                  gyroX: sample.mpu6050.gyroX ?? null,
                  gyroY: sample.mpu6050.gyroY ?? null,
                  gyroZ: sample.mpu6050.gyroZ ?? null,
                  pitchDegrees: sample.mpu6050.pitchDegrees ?? null,
                  rollDegrees: sample.mpu6050.rollDegrees ?? null,
                  yawDegrees: sample.mpu6050.yawDegrees ?? null,
                }
              : null,
            leftRpm: sample.leftRpm !== undefined ? sample.leftRpm : null,
            rightRpm: sample.rightRpm !== undefined ? sample.rightRpm : null,
            speedMps: sample.speedMps !== undefined ? sample.speedMps : null,
            estimatedDistanceMeters:
              sample.estimatedDistanceMeters !== undefined ? sample.estimatedDistanceMeters : null,
            isStale: sample.isStale ?? false,
            notes: sample.notes ?? null,
          },
        },
      };
    });

    try {
      const result = await TelemetrySampleModel.bulkWrite(operations, { ordered: false });
      return {
        insertedCount: result.insertedCount,
        duplicateCount: 0,
      };
    } catch (err: any) {
      // bulkWrite error on duplicate keys (code 11000)
      if (err.writeErrors || err.insertedCount !== undefined) {
        const duplicateCount = err.writeErrors
          ? err.writeErrors.filter((e: any) => e.code === 11000).length
          : 0;
        const insertedCount = err.result?.nInserted ?? err.insertedCount ?? 0;
        return {
          insertedCount,
          duplicateCount,
        };
      }
      throw err;
    }
  }

  public async findByInspectionId(
    inspectionId: string,
    filter: TelemetryFilter = {}
  ): Promise<PaginatedResult<PersistedTelemetryRecord>> {
    assertDatabaseConnected();
    const query: FilterQuery<ITelemetrySampleDocument> = { inspectionId };

    if (filter.fromTimestamp || filter.toTimestamp) {
      query.captureTimestamp = {};
      if (filter.fromTimestamp) {
        query.captureTimestamp.$gte = new Date(filter.fromTimestamp);
      }
      if (filter.toTimestamp) {
        query.captureTimestamp.$lte = new Date(filter.toTimestamp);
      }
    }

    const page = Math.max(1, filter.page || 1);
    // Bounded retrieval: max 1000, default 100
    const limit = Math.max(1, Math.min(1000, filter.limit || 100));

    const total = await TelemetrySampleModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;

    const docs = await TelemetrySampleModel.find(query)
      .sort({ captureTimestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    return {
      items: docs.map((doc) =>
        mapTelemetryDocumentToRecord(doc as unknown as ITelemetrySampleDocument)
      ),
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async findLatestByInspectionId(
    inspectionId: string
  ): Promise<PersistedTelemetryRecord | null> {
    assertDatabaseConnected();
    const doc = await TelemetrySampleModel.findOne({ inspectionId })
      .sort({ captureTimestamp: -1 })
      .lean()
      .exec();

    if (!doc) {
      return null;
    }

    return mapTelemetryDocumentToRecord(doc as unknown as ITelemetrySampleDocument);
  }

  public async getSummary(inspectionId: string): Promise<TelemetrySessionSummary | null> {
    assertDatabaseConnected();
    const count = await TelemetrySampleModel.countDocuments({ inspectionId });
    if (count === 0) {
      return null;
    }

    const [firstDoc, lastDoc, aggResult] = await Promise.all([
      TelemetrySampleModel.findOne({ inspectionId }).sort({ captureTimestamp: 1 }).lean().exec(),
      TelemetrySampleModel.findOne({ inspectionId }).sort({ captureTimestamp: -1 }).lean().exec(),
      TelemetrySampleModel.aggregate([
        { $match: { inspectionId } },
        {
          $group: {
            _id: null,
            maxDistance: { $max: '$estimatedDistanceMeters' },
            maxSpeed: { $max: '$speedMps' },
            avgSpeed: { $avg: '$speedMps' },
            maxPitch: { $max: '$mpu6050.pitchDegrees' },
            minPitch: { $min: '$mpu6050.pitchDegrees' },
            maxRoll: { $max: '$mpu6050.rollDegrees' },
            minRoll: { $min: '$mpu6050.rollDegrees' },
          },
        },
      ]),
    ]);

    const stats = aggResult[0] || {};

    return {
      inspectionId,
      sampleCount: count,
      totalDistanceMeters: stats.maxDistance ?? null,
      maxSpeedMps: stats.maxSpeed ?? null,
      avgSpeedMps: stats.avgSpeed ?? null,
      maxPitchDeg: stats.maxPitch ?? null,
      minPitchDeg: stats.minPitch ?? null,
      maxRollDeg: stats.maxRoll ?? null,
      minRollDeg: stats.minRoll ?? null,
      startTimestamp: firstDoc?.captureTimestamp
        ? new Date(firstDoc.captureTimestamp).toISOString()
        : null,
      endTimestamp: lastDoc?.captureTimestamp
        ? new Date(lastDoc.captureTimestamp).toISOString()
        : null,
    };
  }
}

