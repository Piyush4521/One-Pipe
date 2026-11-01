/**
 * Defect Mongoose Schema & Database Model
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.4
 *
 * Models localized defect evidence documents in MongoDB 'defects' collection.
 *
 * CRITICAL DOMAIN RULES:
 * 1. 'confidence' is strictly the AI model's detection probability (0.0 to 1.0).
 *    It is NOT physical defect severity. No severity metric is fabricated.
 * 2. 'frameCaptureTimestamp' (camera optical acquisition) is strictly decoupled
 *    from 'inferenceTimestamp' (YOLO model inference completion).
 * 3. 'estimatedDistance' is null if odometry is uncalibrated or unavailable.
 *    Missing distance is NEVER coerced to zero.
 */

import { Document, model, Model, Schema } from 'mongoose';
import { ReviewStatus } from '../interfaces/defect.interface';

export const DEFECT_REVIEW_STATUSES: ReviewStatus[] = [
  'UNREVIEWED',
  'CONFIRMED',
  'FALSE_POSITIVE',
  'NEEDS_VERIFICATION',
];

export interface IBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IDefectDocument extends Document {
  defectId: string;
  inspectionId: string;
  classId: number;
  className: string;
  confidence: number;
  boundingBox: IBoundingBox | null;
  frameId: string;
  frameCaptureTimestamp: Date;
  inferenceTimestamp: Date | null;
  estimatedDistance: number | null;
  reviewStatus: ReviewStatus;
  evidenceImagePath: string;
  evidenceFileSizeBytes: number | null;
  evidenceSha256: string | null;
  evidenceMimeType: string | null;
  operatorNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const boundingBoxSchema = new Schema<IBoundingBox>(
  {
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    width: { type: Number, required: true, min: 0, max: 1 },
    height: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

export const defectSchema = new Schema<IDefectDocument>(
  {
    defectId: {
      type: String,
      required: [true, 'defectId is required'],
      unique: true,
      trim: true,
    },
    inspectionId: {
      type: String,
      required: [true, 'inspectionId reference is required'],
      trim: true,
    },
    classId: {
      type: Number,
      required: [true, 'classId is required'],
      min: [0, 'classId cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'classId must be an integer',
      },
    },
    className: {
      type: String,
      required: [true, 'className is required'],
      trim: true,
      maxlength: [100, 'className cannot exceed 100 characters'],
    },
    confidence: {
      type: Number,
      required: [true, 'confidence is required'],
      min: [0.0, 'confidence cannot be less than 0.0'],
      max: [1.0, 'confidence cannot exceed 1.0'],
      validate: {
        validator: Number.isFinite,
        message: 'confidence must be a finite number',
      },
    },
    boundingBox: {
      type: boundingBoxSchema,
      default: null,
    },
    frameId: {
      type: String,
      required: [true, 'frameId is required'],
      trim: true,
    },
    frameCaptureTimestamp: {
      type: Date,
      required: [true, 'frameCaptureTimestamp is required'],
    },
    inferenceTimestamp: {
      type: Date,
      default: null,
    },
    estimatedDistance: {
      type: Number,
      default: null,
      min: [0, 'estimatedDistance cannot be negative'],
      validate: {
        validator: (val: number | null) => val === null || Number.isFinite(val),
        message: 'estimatedDistance must be a finite number or null',
      },
    },
    reviewStatus: {
      type: String,
      required: [true, 'reviewStatus is required'],
      enum: {
        values: DEFECT_REVIEW_STATUSES,
        message: 'Invalid reviewStatus: {VALUE}',
      },
      default: 'UNREVIEWED',
    },
    evidenceImagePath: {
      type: String,
      required: [true, 'evidenceImagePath is required'],
      trim: true,
      maxlength: [500, 'evidenceImagePath cannot exceed 500 characters'],
    },
    evidenceFileSizeBytes: {
      type: Number,
      default: null,
      min: [0, 'evidenceFileSizeBytes cannot be negative'],
      validate: {
        validator: (val: number | null) => val === null || (Number.isInteger(val) && val >= 0),
        message: 'evidenceFileSizeBytes must be a non-negative integer or null',
      },
    },
    evidenceSha256: {
      type: String,
      default: null,
      trim: true,
      match: [/^[a-f0-9]{64}$/i, 'evidenceSha256 must be a 64-character hex string or null'],
    },
    evidenceMimeType: {
      type: String,
      default: null,
      trim: true,
      maxlength: [50, 'evidenceMimeType cannot exceed 50 characters'],
    },
    operatorNotes: {
      type: String,
      default: null,
      maxlength: [2000, 'operatorNotes cannot exceed 2000 characters'],
    },
  },
  {
    collection: 'defects',
    strict: true,
    timestamps: true,
  }
);

// Indexes for query optimization
defectSchema.index({ inspectionId: 1, reviewStatus: 1 });
defectSchema.index({ inspectionId: 1, estimatedDistance: 1 });
defectSchema.index({ inspectionId: 1, classId: 1 });
defectSchema.index({ frameCaptureTimestamp: -1 });

export const DefectModel: Model<IDefectDocument> =
  model<IDefectDocument>('Defect', defectSchema);
