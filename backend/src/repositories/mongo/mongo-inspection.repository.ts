/**
 * MongoDB Concrete Inspection Repository Implementation
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.1, 16.4
 *
 * Implements IInspectionRepository using Mongoose InspectionModel.
 * CRITICAL DATA-INTEGRITY CONSTRAINTS:
 * 1. An unknown/uncalibrated distance is NEVER converted from null to 0.
 *    Unknown distance remains strictly null across persistence, domain mapping, and API boundaries.
 * 2. An actual measured distance of zero is preserved as 0.
 * 3. Atomic conditional updates are used for lifecycle transitions to enforce the domain state machine
 *    and prevent invalid concurrent transitions.
 * 4. Internal Mongoose fields (__v, _id) are never leaked to domain callers.
 */

import { randomUUID } from 'crypto';
import { FilterQuery } from 'mongoose';
import {
  CreateInspectionDTO,
  InspectionFilter,
  InspectionLifecycleState,
  InspectionRecord,
  UpdateInspectionDTO,
} from '../../interfaces/inspection.interface';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { IInspectionRepository } from '../../interfaces/repositories';
import { AppError } from '../../middleware/error.middleware';
import { IInspectionDocument, InspectionModel } from '../../models/inspection.model';
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
 * Valid preceding states allowed to transition into a given target state.
 * Enforces Rulebook § 9 invariant rules atomically at the database layer.
 */
const VALID_PRECEDING_STATES: Record<InspectionLifecycleState, readonly InspectionLifecycleState[]> = {
  ready: ['ready', 'recovery_required'],
  running: ['ready', 'paused', 'running'],
  paused: ['running', 'paused'],
  completed: ['running', 'paused', 'recovery_required', 'completed'],
  recovery_required: ['running', 'paused', 'recovery_required'],
};

/**
 * Explicit mapper from Mongoose document to clean domain InspectionRecord.
 * Protects against internal Mongoose leakage and enforces distance nullability.
 */
export function mapInspectionDocumentToRecord(doc: IInspectionDocument): InspectionRecord {
  return {
    id: doc.inspectionId,
    conduitName: doc.conduitName ?? undefined,
    startTimestamp: doc.startTimestamp.toISOString(),
    endTimestamp: doc.endTimestamp ? doc.endTimestamp.toISOString() : undefined,
    durationSeconds: doc.durationSeconds ?? undefined,
    // Preserve null when uncalibrated; preserve actual 0 or positive value when measured.
    // NEVER coerce null to zero.
    totalDistanceMeters: doc.totalDistanceMeters,
    defectCount: doc.defectCount,
    status: doc.status,
    reportGenerated: doc.reportGenerated,
    backupVerified: doc.backupVerified,
    backupStatus: doc.backupStatus,
    backupId: doc.backupId ?? null,
    backupError: doc.backupError ?? null,
    operatorNotes: doc.operatorNotes ?? undefined,
  };
}

export class MongoInspectionRepository implements IInspectionRepository {
  public async findById(id: string): Promise<InspectionRecord | null> {
    assertDatabaseConnected();
    const doc = await InspectionModel.findOne({ inspectionId: id }).lean().exec();
    if (!doc) {
      return null;
    }
    return mapInspectionDocumentToRecord(doc as unknown as IInspectionDocument);
  }

  public async findMany(filter: InspectionFilter = {}): Promise<PaginatedResult<InspectionRecord>> {
    assertDatabaseConnected();
    const query: FilterQuery<IInspectionDocument> = {};

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      query.startTimestamp = {};
      if (filter.startDate) {
        query.startTimestamp.$gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        query.startTimestamp.$lte = new Date(filter.endDate);
      }
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));

    const total = await InspectionModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;

    const docs = await InspectionModel.find(query)
      .sort({ startTimestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    return {
      items: docs.map((doc) => mapInspectionDocumentToRecord(doc as unknown as IInspectionDocument)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async create(data: CreateInspectionDTO): Promise<InspectionRecord> {
    assertDatabaseConnected();
    // Support testing explicit ID or generate clean UUID
    const inspectionId = (data as any).id || (data as any).inspectionId || randomUUID();

    const doc = new InspectionModel({
      inspectionId,
      conduitName: data.conduitName ?? null,
      operatorNotes: data.operatorNotes ?? null,
      startTimestamp: new Date(),
      endTimestamp: null,
      durationSeconds: null,
      totalDistanceMeters: null, // Initial distance is null (uncalibrated)
      defectCount: 0,
      status: 'ready',
      reportGenerated: false,
      backupVerified: false,
    });

    try {
      await doc.save();
    } catch (err: any) {
      if (err.code === 11000) {
        const conflictErr: AppError = new Error(
          `Inspection session with identifier '${inspectionId}' already exists.`
        );
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_IDENTIFIER';
        throw conflictErr;
      }
      throw err;
    }

    return mapInspectionDocumentToRecord(doc);
  }

  public async update(id: string, data: UpdateInspectionDTO): Promise<InspectionRecord | null> {
    assertDatabaseConnected();
    const updateFields: Record<string, unknown> = {};

    if (data.conduitName !== undefined) {
      updateFields.conduitName = data.conduitName;
    }
    if (data.operatorNotes !== undefined) {
      updateFields.operatorNotes = data.operatorNotes;
    }
    if (data.totalDistanceMeters !== undefined) {
      // Preserves explicit null or valid numeric value (including 0)
      updateFields.totalDistanceMeters = data.totalDistanceMeters;
    }
    if (data.defectCount !== undefined) {
      updateFields.defectCount = data.defectCount;
    }
    if (data.endTimestamp !== undefined) {
      updateFields.endTimestamp = data.endTimestamp ? new Date(data.endTimestamp) : null;
    }
    if (data.durationSeconds !== undefined) {
      updateFields.durationSeconds = data.durationSeconds;
    }
    if (data.reportGenerated !== undefined) {
      updateFields.reportGenerated = data.reportGenerated;
    }
    if (data.backupVerified !== undefined) {
      updateFields.backupVerified = data.backupVerified;
    }
    if (data.backupStatus !== undefined) {
      updateFields.backupStatus = data.backupStatus;
    }
    if (data.backupId !== undefined) {
      updateFields.backupId = data.backupId;
    }
    if (data.backupError !== undefined) {
      updateFields.backupError = data.backupError;
    }

    // If lifecycle status transition is requested via update
    if ((data as any).status !== undefined) {
      const targetStatus = (data as any).status as InspectionLifecycleState;
      const validPrecedings = VALID_PRECEDING_STATES[targetStatus];

      const doc = await InspectionModel.findOneAndUpdate(
        { inspectionId: id, status: { $in: validPrecedings } },
        { $set: { ...updateFields, status: targetStatus } },
        { new: true, runValidators: true }
      )
        .lean()
        .exec();

      if (doc) {
        return mapInspectionDocumentToRecord(doc as unknown as IInspectionDocument);
      }

      // Check if document exists with invalid transition
      const existing = await InspectionModel.findOne({ inspectionId: id }).lean().exec();
      if (!existing) {
        return null;
      }

      const err: AppError = new Error(
        `Invalid lifecycle transition: Cannot transition inspection from '${existing.status}' to '${targetStatus}'.`
      );
      err.statusCode = 409;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    // Normal non-status field updates
    const doc = await InspectionModel.findOneAndUpdate(
      { inspectionId: id },
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();

    if (!doc) {
      return null;
    }

    return mapInspectionDocumentToRecord(doc as unknown as IInspectionDocument);
  }

  public async updateStatus(
    id: string,
    status: InspectionLifecycleState
  ): Promise<InspectionRecord | null> {
    assertDatabaseConnected();
    const validPrecedings = VALID_PRECEDING_STATES[status];

    // Atomic conditional update preventing concurrent or illegal lifecycle jumps
    const doc = await InspectionModel.findOneAndUpdate(
      { inspectionId: id, status: { $in: validPrecedings } },
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();

    if (doc) {
      return mapInspectionDocumentToRecord(doc as unknown as IInspectionDocument);
    }

    // Check if inspection exists to distinguish 404 from 409
    const existing = await InspectionModel.findOne({ inspectionId: id }).lean().exec();
    if (!existing) {
      return null;
    }

    const err: AppError = new Error(
      `Invalid lifecycle transition: Cannot transition inspection from '${existing.status}' to '${status}'.`
    );
    err.statusCode = 409;
    err.code = 'INVALID_STATE_TRANSITION';
    throw err;
  }
}

