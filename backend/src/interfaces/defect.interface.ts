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
  estimatedDistance: number; // Calculated odometry distance in meters from start
  frameId: string;
  frameCaptureTimestamp: string; // ISO 8601
  inferenceTimestamp?: string;   // ISO 8601
  reviewStatus: ReviewStatus;
  evidenceImagePath: string;     // Relative safe storage path
  operatorNotes?: string;
}

export interface UpdateDefectReviewDTO {
  reviewStatus: ReviewStatus;
  operatorNotes?: string;
}

export interface DefectFilter extends PaginationParams {
  inspectionId?: string;
  reviewStatus?: ReviewStatus;
  classId?: number;
}

