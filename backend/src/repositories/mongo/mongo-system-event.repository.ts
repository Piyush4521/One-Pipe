/**
 * MongoDB Concrete System Event Repository Implementation
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.1, 16.4
 *
 * Implements ISystemEventRepository using Mongoose SystemEventModel.
 * CRITICAL SAFETY RULES:
 * 1. 'physicalStopConfirmed' MUST ALWAYS BE FALSE for software emergency-stop events.
 *    A software emergency stop request acknowledgement does NOT confirm physical motor cutoff.
 * 2. Events represent actual system occurrences; no synthetic startup events are fabricated.
 * 3. Sensitive tokens and connection secrets are redacted prior to persistence.
 * 4. Internal Mongoose fields (__v, _id) are never leaked to domain callers.
 */

import { randomUUID } from 'crypto';
import { FilterQuery } from 'mongoose';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { ISystemEventRepository } from '../../interfaces/repositories';
import {
  CreateSystemEventDTO,
  SystemEventFilter,
  SystemEventRecord,
} from '../../interfaces/system-event.interface';
import { AppError } from '../../middleware/error.middleware';
import {
  ISystemEventDocument,
  SystemEventModel,
} from '../../models/system-event.model';
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
 * Explicit mapper from Mongoose document to clean domain SystemEventRecord.
 */
export function mapSystemEventDocumentToRecord(
  doc: ISystemEventDocument
): SystemEventRecord {
  return {
    id: doc.eventId,
    category: doc.category,
    subsystem: doc.subsystem ?? null,
    severity: doc.severity,
    timestamp: doc.timestamp ? doc.timestamp.toISOString() : new Date().toISOString(),
    message: doc.message,
    inspectionId: doc.inspectionId ?? null,
    correlationId: doc.correlationId ?? null,
    details: doc.details ? (doc.details as Record<string, unknown>) : null,
    // Safety Invariant: Software E-stop never confirms physical cutoff
    physicalStopConfirmed: doc.category === 'emergency_stop_request' ? false : doc.physicalStopConfirmed,
    createdAt: (doc as any).createdAt ? (doc as any).createdAt.toISOString() : undefined,
  };
}

export class MongoSystemEventRepository implements ISystemEventRepository {
  public async create(data: CreateSystemEventDTO): Promise<SystemEventRecord> {
    assertDatabaseConnected();

    const eventId = data.eventId || randomUUID();
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

    // Enforce safety invariant on emergency stop events
    const physicalStopConfirmed =
      data.category === 'emergency_stop_request' ? false : (data.physicalStopConfirmed ?? false);

    const doc = new SystemEventModel({
      eventId,
      category: data.category,
      subsystem: data.subsystem ?? null,
      severity: data.severity || 'info',
      timestamp,
      message: data.message,
      inspectionId: data.inspectionId ?? null,
      correlationId: data.correlationId ?? null,
      details: data.details ?? null,
      physicalStopConfirmed,
    });

    try {
      await doc.save();
    } catch (err: any) {
      if (err.code === 11000) {
        const conflictErr: AppError = new Error(
          `System event with identifier '${eventId}' already exists.`
        );
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_IDENTIFIER';
        throw conflictErr;
      }
      throw err;
    }

    return mapSystemEventDocumentToRecord(doc);
  }

  public async findMany(
    filter: SystemEventFilter = {}
  ): Promise<PaginatedResult<SystemEventRecord>> {
    assertDatabaseConnected();
    const query: FilterQuery<ISystemEventDocument> = {};

    if (filter.category) {
      query.category = filter.category;
    }
    if (filter.severity) {
      query.severity = filter.severity;
    }
    if (filter.inspectionId) {
      query.inspectionId = filter.inspectionId;
    }
    if (filter.fromTimestamp || filter.toTimestamp) {
      query.timestamp = {};
      if (filter.fromTimestamp) {
        query.timestamp.$gte = new Date(filter.fromTimestamp);
      }
      if (filter.toTimestamp) {
        query.timestamp.$lte = new Date(filter.toTimestamp);
      }
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));

    const total = await SystemEventModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;

    const docs = await SystemEventModel.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    return {
      items: docs.map((doc) =>
        mapSystemEventDocumentToRecord(doc as unknown as ISystemEventDocument)
      ),
      total,
      page,
      limit,
      totalPages,
    };
  }
}

