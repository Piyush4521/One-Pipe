/**
 * MongoDB Concrete Defect Repository Implementation
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.1, 16.4
 *
 * Implements IDefectRepository using Mongoose DefectModel.
 * CRITICAL DATA-INTEGRITY CONSTRAINTS:
 * 1. Confidence represents AI detection probability (0.0 to 1.0); never physical severity.
 * 2. Optical acquisition (frameCaptureTimestamp) is strictly separated from inferenceTimestamp.
 * 3. Estimated distance remains null until odometry calibration is completed.
 * 4. Parent inspection references are verified to ensure foreign-key integrity.
 * 5. Review status updates update ONLY reviewStatus and operatorNotes; detection evidence is immutable.
 * 6. Internal Mongoose fields (__v, _id) are never leaked to domain callers.
 */

import { randomUUID } from 'crypto';
import { FilterQuery } from 'mongoose';
import {
  DefectFilter,
  DefectRecord,
  DefectStats,
  UpdateDefectReviewDTO,
} from '../../interfaces/defect.interface';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { IDefectRepository } from '../../interfaces/repositories';
import { AppError } from '../../middleware/error.middleware';
import { DefectModel, IDefectDocument } from '../../models/defect.model';
import { InspectionModel } from '../../models/inspection.model';
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
 * Explicit mapper from Mongoose document to clean domain DefectRecord.
 */
export function mapDefectDocumentToRecord(doc: IDefectDocument): DefectRecord {
  return {
    id: doc.defectId,
    inspectionId: doc.inspectionId,
    classId: doc.classId,
    className: doc.className,
    confidence: doc.confidence,
    estimatedDistance: doc.estimatedDistance, // Preserves null when uncalibrated; preserves number when calibrated
    frameId: doc.frameId,
    frameCaptureTimestamp: doc.frameCaptureTimestamp.toISOString(),
    inferenceTimestamp: doc.inferenceTimestamp ? doc.inferenceTimestamp.toISOString() : undefined,
    reviewStatus: doc.reviewStatus,
    evidenceImagePath: doc.evidenceImagePath,
    evidenceFileSizeBytes: doc.evidenceFileSizeBytes ?? null,
    evidenceSha256: doc.evidenceSha256 ?? null,
    evidenceMimeType: doc.evidenceMimeType ?? null,
    operatorNotes: doc.operatorNotes ?? undefined,
    boundingBox: doc.boundingBox
      ? {
          x: doc.boundingBox.x,
          y: doc.boundingBox.y,
          width: doc.boundingBox.width,
          height: doc.boundingBox.height,
        }
      : null,
  };
}

export class MongoDefectRepository implements IDefectRepository {
  public async findById(id: string): Promise<DefectRecord | null> {
    assertDatabaseConnected();
    const doc = await DefectModel.findOne({ defectId: id }).lean().exec();
    if (!doc) {
      return null;
    }
    return mapDefectDocumentToRecord(doc as unknown as IDefectDocument);
  }

  public async findMany(filter: DefectFilter = {}): Promise<PaginatedResult<DefectRecord>> {
    assertDatabaseConnected();
    const query: FilterQuery<IDefectDocument> = {};

    if (filter.inspectionId) {
      query.inspectionId = filter.inspectionId;
    }
    if (filter.reviewStatus) {
      query.reviewStatus = filter.reviewStatus;
    }
    if (filter.classId !== undefined) {
      query.classId = filter.classId;
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));

    const total = await DefectModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;

    // Sort by estimatedDistance ascending; nulls last, then frameCaptureTimestamp
    const docs = await DefectModel.find(query)
      .sort({ estimatedDistance: 1, frameCaptureTimestamp: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    return {
      items: docs.map((doc) => mapDefectDocumentToRecord(doc as unknown as IDefectDocument)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async create(data: Omit<DefectRecord, 'id'>): Promise<DefectRecord> {
    assertDatabaseConnected();
    // 1. Verify parent inspection reference exists
    const inspectionExists = await InspectionModel.exists({ inspectionId: data.inspectionId });
    if (!inspectionExists) {
      const err: AppError = new Error(
        `Referenced parent inspection session '${data.inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    const defectId = (data as any).id || (data as any).defectId || randomUUID();

    const doc = new DefectModel({
      defectId,
      inspectionId: data.inspectionId,
      classId: data.classId,
      className: data.className,
      confidence: data.confidence,
      estimatedDistance: data.estimatedDistance !== undefined ? data.estimatedDistance : null,
      frameId: data.frameId,
      frameCaptureTimestamp: new Date(data.frameCaptureTimestamp),
      inferenceTimestamp: data.inferenceTimestamp ? new Date(data.inferenceTimestamp) : null,
      reviewStatus: data.reviewStatus || 'UNREVIEWED',
      evidenceImagePath: data.evidenceImagePath,
      evidenceFileSizeBytes: data.evidenceFileSizeBytes ?? null,
      evidenceSha256: data.evidenceSha256 ?? null,
      evidenceMimeType: data.evidenceMimeType ?? null,
      operatorNotes: data.operatorNotes ?? null,
      boundingBox: data.boundingBox ?? null,
    });

    try {
      await doc.save();
    } catch (err: any) {
      if (err.code === 11000) {
        const conflictErr: AppError = new Error(
          `Defect record with identifier '${defectId}' already exists.`
        );
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_IDENTIFIER';
        throw conflictErr;
      }
      throw err;
    }

    return mapDefectDocumentToRecord(doc);
  }

  public async updateReview(
    id: string,
    data: UpdateDefectReviewDTO
  ): Promise<DefectRecord | null> {
    assertDatabaseConnected();
    // Enforce immutable detection evidence: update only reviewStatus and operatorNotes
    const updateFields: Record<string, unknown> = {
      reviewStatus: data.reviewStatus,
    };

    if (data.operatorNotes !== undefined) {
      updateFields.operatorNotes = data.operatorNotes;
    }

    const doc = await DefectModel.findOneAndUpdate(
      { defectId: id },
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();

    if (!doc) {
      return null;
    }

    return mapDefectDocumentToRecord(doc as unknown as IDefectDocument);
  }

  public async updateEvidenceMetadata(
    id: string,
    metadata: {
      evidenceImagePath: string;
      evidenceFileSizeBytes: number;
      evidenceSha256: string;
      evidenceMimeType: string;
    }
  ): Promise<DefectRecord | null> {
    assertDatabaseConnected();
    const doc = await DefectModel.findOneAndUpdate(
      { defectId: id },
      {
        $set: {
          evidenceImagePath: metadata.evidenceImagePath,
          evidenceFileSizeBytes: metadata.evidenceFileSizeBytes,
          evidenceSha256: metadata.evidenceSha256,
          evidenceMimeType: metadata.evidenceMimeType,
        },
      },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();

    if (!doc) {
      return null;
    }

    return mapDefectDocumentToRecord(doc as unknown as IDefectDocument);
  }

  public async getStats(): Promise<DefectStats> {
    assertDatabaseConnected();
    const [total, unreviewed, confirmed, falsePositive, needsVerification] = await Promise.all([
      DefectModel.countDocuments({}),
      DefectModel.countDocuments({ reviewStatus: 'UNREVIEWED' }),
      DefectModel.countDocuments({ reviewStatus: 'CONFIRMED' }),
      DefectModel.countDocuments({ reviewStatus: 'FALSE_POSITIVE' }),
      DefectModel.countDocuments({ reviewStatus: 'NEEDS_VERIFICATION' }),
    ]);

    return {
      total,
      unreviewed,
      confirmed,
      falsePositive,
      needsVerification,
    };
  }
}

