/**
 * Defect Evidence Domain Models & DTO Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.4
 * Aligned with frontend DefectEvidenceRecord in frontend/src/types/inspection.ts
 */

import { PaginationParams } from './pagination.interface';

/**
 * Review status values confirmed by human operator.
 */
export type ReviewStatus = 'UNREVIEWED' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'NEEDS_VERIFICATION';

export interface DefectRecord {
  id: string;
  inspectionId: string;
  classId: number;
  className: string;
  confidence: number; // Detection probability 0.0 to 1.0; NOT physical defect severity (Rulebook § 14.5)
  estimatedDistance: number | null; // Calculated odometry distance in meters; null when uncalibrated
  frameId: string;
  frameCaptureTimestamp: string; // ISO 8601
  inferenceTimestamp?: string;   // ISO 8601
  reviewStatus: ReviewStatus;
  evidenceImagePath: string;     // Relative safe storage path
  evidenceFileSizeBytes?: number | null; // Size in bytes on disk; null if not yet uploaded
  evidenceSha256?: string | null;        // SHA-256 digest of stored evidence file
  evidenceMimeType?: string | null;      // Verified MIME type (image/jpeg or image/png)
  operatorNotes?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface UpdateDefectReviewDTO {
  reviewStatus: ReviewStatus;
  operatorNotes?: string;
}

export interface DefectStats {
  total: number;
  unreviewed: number;
  confirmed: number;
  falsePositive: number;
  needsVerification: number;
}

export interface DefectFilter extends PaginationParams {
  inspectionId?: string;
  reviewStatus?: ReviewStatus;
  classId?: number;
}

