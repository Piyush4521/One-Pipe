/**
 * MongoDB Concrete Report Metadata Repository Implementation
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1, 16.2, 16.4, 17
 *
 * Implements IReportRepository using Mongoose ReportModel.
 * CRITICAL DATA-INTEGRITY CONSTRAINTS:
 * 1. Initial pending reports must have strictly null file metadata (pdfRelativePath, fileSizeBytes,
 *    compiledTimestamp, totalDistanceMeters, defectCount). No paths or metrics are fabricated.
 * 2. Parent inspection references are verified against existing inspection sessions.
 * 3. Status updates follow valid transitions (pending -> generating -> completed/failed).
 *    Completed reports are terminal and cannot revert to pending.
 * 4. Internal Mongoose fields (__v, _id) are never leaked to domain callers.
 */

import { randomUUID } from 'crypto';
import { ReportRecord, ReportStatus } from '../../interfaces/report.interface';
import { IReportRepository } from '../../interfaces/repositories';
import { AppError } from '../../middleware/error.middleware';
import { InspectionModel } from '../../models/inspection.model';
import { IReportDocument, ReportModel } from '../../models/report.model';
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
 * Valid preceding states allowed to transition into a given report status.
 */
const VALID_REPORT_PRECEDING_STATES: Record<ReportStatus, readonly ReportStatus[]> = {
  pending: ['pending'],
  generating: ['pending', 'failed', 'generating'],
  completed: ['generating', 'completed'],
  failed: ['pending', 'generating', 'failed'],
};

/**
 * Explicit mapper from Mongoose document to clean domain ReportRecord.
 */
export function mapReportDocumentToRecord(doc: IReportDocument): ReportRecord {
  return {
    id: doc.reportId,
    inspectionId: doc.inspectionId,
    status: doc.status,
    compiledTimestamp: doc.compiledTimestamp ? doc.compiledTimestamp.toISOString() : null,
    fileSizeBytes: doc.fileSizeBytes,
    totalDistanceMeters: doc.totalDistanceMeters, // null until verified PDF compilation
    defectCount: doc.defectCount,                 // null until verified PDF compilation
    pdfRelativePath: doc.pdfRelativePath,         // null until verified on disk
    pdfSha256: doc.pdfSha256 ?? null,
    backupVerified: doc.backupVerified,
    errorMessage: doc.errorMessage ?? undefined,
    note: doc.note ?? undefined,
  };
}

export class MongoReportRepository implements IReportRepository {
  public async findById(id: string): Promise<ReportRecord | null> {
    assertDatabaseConnected();
    const doc = await ReportModel.findOne({ reportId: id }).lean().exec();
    if (!doc) {
      return null;
    }
    return mapReportDocumentToRecord(doc as unknown as IReportDocument);
  }

  public async findByInspectionId(inspectionId: string): Promise<ReportRecord | null> {
    assertDatabaseConnected();
    const doc = await ReportModel.findOne({ inspectionId }).lean().exec();
    if (!doc) {
      return null;
    }
    return mapReportDocumentToRecord(doc as unknown as IReportDocument);
  }

  public async findMany(): Promise<ReportRecord[]> {
    assertDatabaseConnected();
    const docs = await ReportModel.find().sort({ createdAt: -1 }).lean().exec();
    return docs.map((doc) => mapReportDocumentToRecord(doc as unknown as IReportDocument));
  }

  public async create(data: Omit<ReportRecord, 'id'>): Promise<ReportRecord> {
    assertDatabaseConnected();
    // 1. Verify referenced parent inspection exists
    const inspectionExists = await InspectionModel.exists({ inspectionId: data.inspectionId });
    if (!inspectionExists) {
      const err: AppError = new Error(
        `Referenced inspection session '${data.inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    const reportId = (data as any).id || (data as any).reportId || randomUUID();

    const doc = new ReportModel({
      reportId,
      inspectionId: data.inspectionId,
      status: data.status || 'pending',
      compiledTimestamp: data.compiledTimestamp ? new Date(data.compiledTimestamp) : null,
      fileSizeBytes: data.fileSizeBytes ?? null,
      totalDistanceMeters: data.totalDistanceMeters ?? null,
      defectCount: data.defectCount ?? null,
      pdfRelativePath: data.pdfRelativePath ?? null,
      backupVerified: data.backupVerified ?? false,
      errorMessage: data.errorMessage ?? null,
      note: data.note ?? null,
    });

    try {
      await doc.save();
    } catch (err: any) {
      if (err.code === 11000) {
        const conflictErr: AppError = new Error(
          `Report record with identifier '${reportId}' already exists.`
        );
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_IDENTIFIER';
        throw conflictErr;
      }
      throw err;
    }

    return mapReportDocumentToRecord(doc);
  }

  public async update(id: string, data: Partial<ReportRecord>): Promise<ReportRecord | null> {
    assertDatabaseConnected();
    const updateFields: Record<string, unknown> = {};

    if (data.status !== undefined) {
      const targetStatus = data.status;
      const validPrecedings = VALID_REPORT_PRECEDING_STATES[targetStatus];

      if (data.compiledTimestamp !== undefined) {
        updateFields.compiledTimestamp = data.compiledTimestamp
          ? new Date(data.compiledTimestamp)
          : null;
      }
      if (data.fileSizeBytes !== undefined) {
        updateFields.fileSizeBytes = data.fileSizeBytes;
      }
      if (data.totalDistanceMeters !== undefined) {
        updateFields.totalDistanceMeters = data.totalDistanceMeters;
      }
      if (data.defectCount !== undefined) {
        updateFields.defectCount = data.defectCount;
      }
      if (data.pdfRelativePath !== undefined) {
        updateFields.pdfRelativePath = data.pdfRelativePath;
      }
      if (data.backupVerified !== undefined) {
        updateFields.backupVerified = data.backupVerified;
      }
      if (data.errorMessage !== undefined) {
        updateFields.errorMessage = data.errorMessage;
      }
      if (data.note !== undefined) {
        updateFields.note = data.note;
      }

      const doc = await ReportModel.findOneAndUpdate(
        { reportId: id, status: { $in: validPrecedings } },
        { $set: { ...updateFields, status: targetStatus } },
        { new: true, runValidators: true }
      )
        .lean()
        .exec();

      if (doc) {
        return mapReportDocumentToRecord(doc as unknown as IReportDocument);
      }

      // Check if report exists
      const existing = await ReportModel.findOne({ reportId: id }).lean().exec();
      if (!existing) {
        return null;
      }

      const err: AppError = new Error(
        `Invalid report status transition: Cannot transition report from '${existing.status}' to '${targetStatus}'.`
      );
      err.statusCode = 409;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    // Normal non-status updates
    if (data.compiledTimestamp !== undefined) {
      updateFields.compiledTimestamp = data.compiledTimestamp
        ? new Date(data.compiledTimestamp)
        : null;
    }
    if (data.fileSizeBytes !== undefined) {
      updateFields.fileSizeBytes = data.fileSizeBytes;
    }
    if (data.totalDistanceMeters !== undefined) {
      updateFields.totalDistanceMeters = data.totalDistanceMeters;
    }
    if (data.defectCount !== undefined) {
      updateFields.defectCount = data.defectCount;
    }
    if (data.pdfRelativePath !== undefined) {
      updateFields.pdfRelativePath = data.pdfRelativePath;
    }
    if (data.pdfSha256 !== undefined) {
      updateFields.pdfSha256 = data.pdfSha256;
    }
    if (data.backupVerified !== undefined) {
      updateFields.backupVerified = data.backupVerified;
    }
    if (data.errorMessage !== undefined) {
      updateFields.errorMessage = data.errorMessage;
    }
    if (data.note !== undefined) {
      updateFields.note = data.note;
    }

    const doc = await ReportModel.findOneAndUpdate(
      { reportId: id },
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();

    if (!doc) {
      return null;
    }

    return mapReportDocumentToRecord(doc as unknown as IReportDocument);
  }
}

