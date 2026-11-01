/**
 * TEST-ONLY In-Memory Telemetry Repository
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.1
 * NOTE: For automated testing only. Resets on process restart.
 */

import { randomUUID } from 'crypto';
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

export class MemoryTelemetryRepository implements ITelemetryRepository {
  private records: Map<string, PersistedTelemetryRecord> = new Map();

  public async create(sample: TelemetrySampleDTO): Promise<PersistedTelemetryRecord> {
    const sampleId = sample.sampleId || randomUUID();
    if (this.records.has(sampleId)) {
      const conflictErr: AppError = new Error(
        `Telemetry sample with identifier '${sampleId}' already exists.`
      );
      conflictErr.statusCode = 409;
      conflictErr.code = 'DUPLICATE_IDENTIFIER';
      throw conflictErr;
    }

    const record: PersistedTelemetryRecord = {
      sampleId,
      inspectionId: sample.inspectionId ?? null,
      captureTimestamp: sample.captureTimestamp
        ? new Date(sample.captureTimestamp).toISOString()
        : new Date().toISOString(),
      sequenceNumber: sample.sequenceNumber ?? null,
      isAvailable: sample.isAvailable ?? true,
      connectionState: sample.connectionState || 'connected',
      leftEncoderCount: sample.leftEncoderCount ?? null,
      rightEncoderCount: sample.rightEncoderCount ?? null,
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
      leftRpm: sample.leftRpm ?? null,
      rightRpm: sample.rightRpm ?? null,
      speedMps: sample.speedMps ?? null,
      estimatedDistanceMeters: sample.estimatedDistanceMeters ?? null,
      isStale: sample.isStale ?? false,
      notes: sample.notes ?? undefined,
      createdAt: new Date().toISOString(),
    };

    this.records.set(sampleId, record);
    return record;
  }

  public async createBatch(samples: TelemetrySampleDTO[]): Promise<BatchIngestResult> {
    let insertedCount = 0;
    let duplicateCount = 0;

    for (const sample of samples) {
      const sampleId = sample.sampleId || randomUUID();
      if (this.records.has(sampleId)) {
        duplicateCount++;
        continue;
      }

      const record: PersistedTelemetryRecord = {
        sampleId,
        inspectionId: sample.inspectionId ?? null,
        captureTimestamp: sample.captureTimestamp
          ? new Date(sample.captureTimestamp).toISOString()
          : new Date().toISOString(),
        sequenceNumber: sample.sequenceNumber ?? null,
        isAvailable: sample.isAvailable ?? true,
        connectionState: sample.connectionState || 'connected',
        leftEncoderCount: sample.leftEncoderCount ?? null,
        rightEncoderCount: sample.rightEncoderCount ?? null,
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
        leftRpm: sample.leftRpm ?? null,
        rightRpm: sample.rightRpm ?? null,
        speedMps: sample.speedMps ?? null,
        estimatedDistanceMeters: sample.estimatedDistanceMeters ?? null,
        isStale: sample.isStale ?? false,
        notes: sample.notes ?? undefined,
        createdAt: new Date().toISOString(),
      };

      this.records.set(sampleId, record);
      insertedCount++;
    }

    return { insertedCount, duplicateCount };
  }

  public async findByInspectionId(
    inspectionId: string,
    filter: TelemetryFilter = {}
  ): Promise<PaginatedResult<PersistedTelemetryRecord>> {
    let items = Array.from(this.records.values()).filter(
      (item) => item.inspectionId === inspectionId
    );

    if (filter.fromTimestamp) {
      const fromTime = new Date(filter.fromTimestamp).getTime();
      items = items.filter(
        (item) => item.captureTimestamp && new Date(item.captureTimestamp).getTime() >= fromTime
      );
    }
    if (filter.toTimestamp) {
      const toTime = new Date(filter.toTimestamp).getTime();
      items = items.filter(
        (item) => item.captureTimestamp && new Date(item.captureTimestamp).getTime() <= toTime
      );
    }

    // Sort descending by captureTimestamp
    items.sort((a, b) => {
      const timeA = a.captureTimestamp ? new Date(a.captureTimestamp).getTime() : 0;
      const timeB = b.captureTimestamp ? new Date(b.captureTimestamp).getTime() : 0;
      return timeB - timeA;
    });

    const total = items.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(1000, filter.limit || 100));
    const totalPages = Math.ceil(total / limit) || 1;

    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async findLatestByInspectionId(
    inspectionId: string
  ): Promise<PersistedTelemetryRecord | null> {
    const items = Array.from(this.records.values())
      .filter((item) => item.inspectionId === inspectionId)
      .sort((a, b) => {
        const timeA = a.captureTimestamp ? new Date(a.captureTimestamp).getTime() : 0;
        const timeB = b.captureTimestamp ? new Date(b.captureTimestamp).getTime() : 0;
        return timeB - timeA;
      });

    return items[0] || null;
  }

  public async getSummary(inspectionId: string): Promise<TelemetrySessionSummary | null> {
    const items = Array.from(this.records.values()).filter(
      (item) => item.inspectionId === inspectionId
    );

    if (items.length === 0) {
      return null;
    }

    const speeds = items.map((i) => i.speedMps).filter((v): v is number => v !== null);
    const distances = items
      .map((i) => i.estimatedDistanceMeters)
      .filter((v): v is number => v !== null);
    const pitches = items
      .map((i) => i.mpu6050?.pitchDegrees)
      .filter((v): v is number => v !== null && v !== undefined);
    const rolls = items
      .map((i) => i.mpu6050?.rollDegrees)
      .filter((v): v is number => v !== null && v !== undefined);

    const timestamps = items
      .map((i) => i.captureTimestamp)
      .filter((t): t is string => Boolean(t))
      .sort();

    return {
      inspectionId,
      sampleCount: items.length,
      totalDistanceMeters: distances.length > 0 ? Math.max(...distances) : null,
      maxSpeedMps: speeds.length > 0 ? Math.max(...speeds) : null,
      avgSpeedMps:
        speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
      maxPitchDeg: pitches.length > 0 ? Math.max(...pitches) : null,
      minPitchDeg: pitches.length > 0 ? Math.min(...pitches) : null,
      maxRollDeg: rolls.length > 0 ? Math.max(...rolls) : null,
      minRollDeg: rolls.length > 0 ? Math.min(...rolls) : null,
      startTimestamp: timestamps[0] || null,
      endTimestamp: timestamps[timestamps.length - 1] || null,
    };
  }

  public clear(): void {
    this.records.clear();
  }
}

