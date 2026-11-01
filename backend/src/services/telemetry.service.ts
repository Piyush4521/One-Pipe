/**
 * Telemetry Ingestion & Retrieval Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.1, 16.4
 *
 * Coordinates durable telemetry persistence, inspection linkage, and bounded retrieval.
 * CRITICAL DOMAIN RULES:
 * 1. Preserves raw encoder pulse counts and inertial measurement units without modification.
 * 2. Uncalibrated/unavailable measurements must strictly remain NULL. Never coerced to zero.
 * 3. Bounded pagination prevents memory exhaustion during long inspection sessions.
 */

import { PaginatedResult } from '../interfaces/pagination.interface';
import { IInspectionRepository, ITelemetryRepository } from '../interfaces/repositories';
import {
  BatchIngestResult,
  PersistedTelemetryRecord,
  TelemetryFilter,
  TelemetrySampleDTO,
  TelemetrySessionSummary,
} from '../interfaces/telemetry.interface';
import { AppError } from '../middleware/error.middleware';
import {
  telemetryBatchDtoSchema,
  telemetrySampleDtoSchema,
} from '../validators/telemetry.validator';

export class TelemetryService {
  constructor(
    private readonly telemetryRepo: ITelemetryRepository,
    private readonly inspectionRepo: IInspectionRepository
  ) {}

  public async ingestSample(
    inspectionId: string,
    rawSample: unknown
  ): Promise<PersistedTelemetryRecord> {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      const err: AppError = new Error(
        `Inspection session '${inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    const parsed = telemetrySampleDtoSchema.safeParse(rawSample);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      const err: AppError = new Error(`Invalid telemetry sample: ${issues}`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const sampleDTO: TelemetrySampleDTO = {
      ...parsed.data,
      inspectionId,
    };

    return this.telemetryRepo.create(sampleDTO);
  }

  public async ingestBatch(
    inspectionId: string,
    rawBatch: unknown
  ): Promise<BatchIngestResult> {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      const err: AppError = new Error(
        `Inspection session '${inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    // Accept either { samples: [...] } or direct array [...]
    let samplesArray: unknown[];
    if (Array.isArray(rawBatch)) {
      samplesArray = rawBatch;
    } else if (rawBatch && typeof rawBatch === 'object' && Array.isArray((rawBatch as any).samples)) {
      samplesArray = (rawBatch as any).samples;
    } else {
      const err: AppError = new Error('Batch payload must be an array of samples or an object with a samples array.');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const parsed = telemetryBatchDtoSchema.safeParse({ samples: samplesArray });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      const err: AppError = new Error(`Invalid telemetry batch: ${issues}`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const samplesWithInspection = parsed.data.samples.map((s) => ({
      ...s,
      inspectionId,
    }));

    return this.telemetryRepo.createBatch(samplesWithInspection);
  }

  public async getTelemetry(
    inspectionId: string,
    filter: TelemetryFilter = {}
  ): Promise<PaginatedResult<PersistedTelemetryRecord>> {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      const err: AppError = new Error(
        `Inspection session '${inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    return this.telemetryRepo.findByInspectionId(inspectionId, filter);
  }

  public async getLatestTelemetry(
    inspectionId: string
  ): Promise<PersistedTelemetryRecord | null> {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      const err: AppError = new Error(
        `Inspection session '${inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    return this.telemetryRepo.findLatestByInspectionId(inspectionId);
  }

  public async getTelemetrySummary(
    inspectionId: string
  ): Promise<TelemetrySessionSummary | null> {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      const err: AppError = new Error(
        `Inspection session '${inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    return this.telemetryRepo.getSummary(inspectionId);
  }
}

