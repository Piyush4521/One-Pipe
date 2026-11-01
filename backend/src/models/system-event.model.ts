/**
 * System Event Mongoose Schema & Database Model
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.4
 *
 * Models audit and diagnostic events in MongoDB 'system_events' collection.
 *
 * CRITICAL SAFETY RULES:
 * 1. 'physicalStopConfirmed' MUST ALWAYS BE FALSE for software emergency-stop events.
 *    A software emergency stop request acknowledgement does NOT confirm physical motor cutoff.
 * 2. Events represent actual system occurrences; no synthetic startup events are fabricated.
 */

import { Document, model, Model, Schema } from 'mongoose';

export type SystemEventCategory =
  | 'subsystem_status'
  | 'robot_connection'
  | 'emergency_stop_request'
  | 'inspection_lifecycle'
  | 'security_alert'
  | 'system_error'
  | 'storage'
  | 'backup';

export type SystemEventSeverity = 'info' | 'warning' | 'critical';

export const SYSTEM_EVENT_CATEGORIES: SystemEventCategory[] = [
  'subsystem_status',
  'robot_connection',
  'emergency_stop_request',
  'inspection_lifecycle',
  'security_alert',
  'system_error',
  'storage',
  'backup',
];

export const SYSTEM_EVENT_SEVERITIES: SystemEventSeverity[] = [
  'info',
  'warning',
  'critical',
];

export interface ISystemEventDocument extends Document {
  eventId: string;
  category: SystemEventCategory;
  subsystem: string | null;
  severity: SystemEventSeverity;
  timestamp: Date;
  message: string;
  inspectionId: string | null;
  correlationId: string | null;
  details: Record<string, unknown> | null;
  physicalStopConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const systemEventSchema = new Schema<ISystemEventDocument>(
  {
    eventId: {
      type: String,
      required: [true, 'eventId is required'],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'category is required'],
      enum: {
        values: SYSTEM_EVENT_CATEGORIES,
        message: 'Invalid system event category: {VALUE}',
      },
    },
    subsystem: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, 'subsystem name cannot exceed 100 characters'],
    },
    severity: {
      type: String,
      required: [true, 'severity is required'],
      enum: {
        values: SYSTEM_EVENT_SEVERITIES,
        message: 'Invalid system event severity: {VALUE}',
      },
      default: 'info',
    },
    timestamp: {
      type: Date,
      required: [true, 'timestamp is required'],
      default: Date.now,
    },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
      maxlength: [1000, 'message cannot exceed 1000 characters'],
    },
    inspectionId: {
      type: String,
      default: null,
      trim: true,
    },
    correlationId: {
      type: String,
      default: null,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: null,
    },
    physicalStopConfirmed: {
      type: Boolean,
      required: true,
      default: false, // Invariant: software cannot confirm physical motor cutoff
    },
  },
  {
    collection: 'system_events',
    strict: true,
    timestamps: true,
  }
);

// Indexes for chronological and filtered event retrieval
systemEventSchema.index({ category: 1, timestamp: -1 });
systemEventSchema.index({ severity: 1, timestamp: -1 });
systemEventSchema.index({ inspectionId: 1, timestamp: -1 });
systemEventSchema.index({ timestamp: -1 });

export const SystemEventModel: Model<ISystemEventDocument> =
  model<ISystemEventDocument>('SystemEvent', systemEventSchema);
