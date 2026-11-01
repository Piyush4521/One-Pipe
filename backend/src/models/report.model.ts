/**
 * Report Mongoose Schema & Database Model
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 17
 *
 * Models inspection report generation metadata documents in MongoDB 'reports' collection.
 *
 * CRITICAL DOMAIN RULES:
 * 1. A report begins in 'pending' state.
 * 2. 'pdfRelativePath', 'fileSizeBytes', 'compiledTimestamp', 'totalDistanceMeters',
 *    and 'defectCount' are strictly NULL until a verified PDF is compiled on disk.
 * 3. File existence, file size, and paths are NEVER fabricated.
 */

import { Document, model, Model, Schema } from 'mongoose';
import { ReportStatus } from '../interfaces/report.interface';

export const REPORT_STATUSES: ReportStatus[] = [
  'pending',
  'generating',
  'completed',
  'failed',
];

export interface IReportDocument extends Document {
  reportId: string;
  inspectionId: string;
  status: ReportStatus;
  compiledTimestamp: Date | null;
  fileSizeBytes: number | null;
  totalDistanceMeters: number | null;
  defectCount: number | null;
  pdfRelativePath: string | null;
  pdfSha256: string | null;
  backupVerified: boolean;
  errorMessage: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const reportSchema = new Schema<IReportDocument>(
  {
    reportId: {
      type: String,
      required: [true, 'reportId is required'],
      unique: true,
      trim: true,
    },
    inspectionId: {
      type: String,
      required: [true, 'inspectionId reference is required'],
      trim: true,
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: REPORT_STATUSES,
        message: 'Invalid report status: {VALUE}',
      },
      default: 'pending',
    },
    compiledTimestamp: {
      type: Date,
      default: null,
    },
    fileSizeBytes: {
      type: Number,
      default: null,
      min: [0, 'fileSizeBytes cannot be negative'],
      validate: {
        validator: (val: number | null) => val === null || (Number.isInteger(val) && val >= 0),
        message: 'fileSizeBytes must be a non-negative integer or null',
      },
    },
    totalDistanceMeters: {
      type: Number,
      default: null,
      min: [0, 'totalDistanceMeters cannot be negative'],
    },
    defectCount: {
      type: Number,
      default: null,
      min: [0, 'defectCount cannot be negative'],
      validate: {
        validator: (val: number | null) => val === null || (Number.isInteger(val) && val >= 0),
        message: 'defectCount must be a non-negative integer or null',
      },
    },
    pdfRelativePath: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'pdfRelativePath cannot exceed 500 characters'],
    },
    pdfSha256: {
      type: String,
      default: null,
      trim: true,
      match: [/^[a-f0-9]{64}$/i, 'pdfSha256 must be a 64-character hex string or null'],
    },
    backupVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    errorMessage: {
      type: String,
      default: null,
      maxlength: [2000, 'errorMessage cannot exceed 2000 characters'],
    },
    note: {
      type: String,
      default: null,
      maxlength: [2000, 'note cannot exceed 2000 characters'],
    },
  },
  {
    collection: 'reports',
    strict: true,
    timestamps: true,
  }
);

// Indexes for query optimization
reportSchema.index({ inspectionId: 1, status: 1 });
reportSchema.index({ status: 1 });

export const ReportModel: Model<IReportDocument> =
  model<IReportDocument>('Report', reportSchema);
