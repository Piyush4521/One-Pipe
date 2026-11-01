/**
 * Inspection Mongoose Schema & Database Model
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.4
 *
 * Models canonical inspection session documents in MongoDB 'inspections' collection.
 * Strictly decoupled from robot connection states (disconnected is NOT a lifecycle state).
 */

import { Document, model, Model, Schema } from 'mongoose';
import { InspectionLifecycleState } from '../interfaces/inspection.interface';

export const INSPECTION_LIFECYCLE_STATES: InspectionLifecycleState[] = [
  'ready',
  'running',
  'paused',
  'completed',
  'recovery_required',
];

export interface IInspectionDocument extends Document {
  inspectionId: string;
  conduitName: string | null;
  startTimestamp: Date;
  endTimestamp: Date | null;
  durationSeconds: number | null;
  totalDistanceMeters: number | null;
  defectCount: number;
  status: InspectionLifecycleState;
  reportGenerated: boolean;
  backupVerified: boolean;
  backupStatus: 'not_started' | 'pending' | 'running' | 'completed' | 'failed';
  backupId: string | null;
  backupError: string | null;
  operatorNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const inspectionSchema = new Schema<IInspectionDocument>(
  {
    inspectionId: {
      type: String,
      required: [true, 'inspectionId is required'],
      unique: true,
      trim: true,
    },
    conduitName: {
      type: String,
      default: null,
      trim: true,
      maxlength: [200, 'conduitName cannot exceed 200 characters'],
    },
    startTimestamp: {
      type: Date,
      required: [true, 'startTimestamp is required'],
      default: Date.now,
    },
    endTimestamp: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: [0, 'durationSeconds cannot be negative'],
    },
    totalDistanceMeters: {
      type: Number,
      default: null,
      min: [0, 'totalDistanceMeters cannot be negative'],
      validate: {
        validator: (val: number | null) => val === null || (Number.isFinite(val) && val >= 0),
        message: 'totalDistanceMeters must be a non-negative finite number or null',
      },
    },
    defectCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'defectCount cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'defectCount must be an integer',
      },
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: INSPECTION_LIFECYCLE_STATES,
        message: 'Invalid inspection lifecycle status: {VALUE}',
      },
      default: 'ready',
    },
    reportGenerated: {
      type: Boolean,
      required: true,
      default: false,
    },
    backupVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    backupStatus: {
      type: String,
      enum: ['not_started', 'pending', 'running', 'completed', 'failed'],
      default: 'not_started',
    },
    backupId: {
      type: String,
      default: null,
      trim: true,
    },
    backupError: {
      type: String,
      default: null,
      maxlength: [2000, 'backupError cannot exceed 2000 characters'],
    },
    operatorNotes: {
      type: String,
      default: null,
      maxlength: [2000, 'operatorNotes cannot exceed 2000 characters'],
    },
  },
  {
    collection: 'inspections',
    strict: true,
    timestamps: true,
  }
);

// Indexes for query optimization
inspectionSchema.index({ status: 1, startTimestamp: -1 });
inspectionSchema.index({ startTimestamp: -1 });

export const InspectionModel: Model<IInspectionDocument> =
  model<IInspectionDocument>('Inspection', inspectionSchema);
