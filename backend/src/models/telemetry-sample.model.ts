/**
 * Telemetry Sample Mongoose Schema & Database Model
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.4
 *
 * Models periodically sampled vehicle telemetry in MongoDB 'telemetry' collection.
 *
 * CRITICAL DOMAIN RULES:
 * 1. Raw sensor readings (encoder pulse counts, MPU6050 axes) are preserved as raw values.
 * 2. Missing, unconfigured, or uncalibrated readings MUST remain NULL.
 *    Missing sensor readings are NEVER coerced to zero.
 * 3. Derived metrics (RPM, speed, distance) are provisional and require mechanical
 *    calibration in Stage 5. No conversion constants or PPR values are invented.
 * 4. Continuous video is NEVER stored in MongoDB.
 */

import { Document, model, Model, Schema } from 'mongoose';
import { RobotConnectionState } from '../interfaces/robot-connection.interface';

export const ROBOT_CONNECTION_STATES: RobotConnectionState[] = [
  'disconnected',
  'connecting',
  'connected',
  'error',
];

export interface IMpu6050Subdocument {
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  pitchDegrees: number | null;
  rollDegrees: number | null;
  yawDegrees: number | null;
}

export interface ITelemetrySampleDocument extends Document {
  sampleId: string;
  inspectionId: string | null;
  captureTimestamp: Date;
  sequenceNumber: number | null;
  isAvailable: boolean;
  connectionState: RobotConnectionState;
  leftEncoderCount: number | null;
  rightEncoderCount: number | null;
  mpu6050: IMpu6050Subdocument | null;
  leftRpm: number | null;
  rightRpm: number | null;
  speedMps: number | null;
  estimatedDistanceMeters: number | null;
  isStale: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const mpu6050SubSchema = new Schema<IMpu6050Subdocument>(
  {
    accelX: { type: Number, default: null },
    accelY: { type: Number, default: null },
    accelZ: { type: Number, default: null },
    gyroX: { type: Number, default: null },
    gyroY: { type: Number, default: null },
    gyroZ: { type: Number, default: null },
    pitchDegrees: { type: Number, default: null },
    rollDegrees: { type: Number, default: null },
    yawDegrees: { type: Number, default: null },
  },
  { _id: false }
);

export const telemetrySampleSchema = new Schema<ITelemetrySampleDocument>(
  {
    sampleId: {
      type: String,
      required: [true, 'sampleId is required'],
      unique: true,
      trim: true,
    },
    inspectionId: {
      type: String,
      default: null,
      trim: true,
    },
    captureTimestamp: {
      type: Date,
      required: [true, 'captureTimestamp is required'],
      default: Date.now,
    },
    sequenceNumber: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isInteger(val),
        message: 'sequenceNumber must be an integer or null',
      },
    },
    isAvailable: {
      type: Boolean,
      required: true,
      default: false,
    },
    connectionState: {
      type: String,
      required: [true, 'connectionState is required'],
      enum: {
        values: ROBOT_CONNECTION_STATES,
        message: 'Invalid robot connectionState: {VALUE}',
      },
      default: 'disconnected',
    },
    // Raw Sensor Readings
    leftEncoderCount: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isInteger(val),
        message: 'leftEncoderCount must be an integer or null',
      },
    },
    rightEncoderCount: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isInteger(val),
        message: 'rightEncoderCount must be an integer or null',
      },
    },
    mpu6050: {
      type: mpu6050SubSchema,
      default: null,
    },
    // Derived & Calibrated Measurements (Provisional)
    leftRpm: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isFinite(val),
        message: 'leftRpm must be a finite number or null',
      },
    },
    rightRpm: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isFinite(val),
        message: 'rightRpm must be a finite number or null',
      },
    },
    speedMps: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isFinite(val),
        message: 'speedMps must be a finite number or null',
      },
    },
    estimatedDistanceMeters: {
      type: Number,
      default: null,
      validate: {
        validator: (val: number | null) => val === null || Number.isFinite(val),
        message: 'estimatedDistanceMeters must be a finite number or null',
      },
    },
    isStale: {
      type: Boolean,
      required: true,
      default: false,
    },
    notes: {
      type: String,
      default: null,
      maxlength: [1000, 'notes cannot exceed 1000 characters'],
    },
  },
  {
    collection: 'telemetry',
    strict: true,
    timestamps: true,
  }
);

// Indexes for temporal and inspection-scoped telemetry retrieval
telemetrySampleSchema.index({ inspectionId: 1, captureTimestamp: -1 });
telemetrySampleSchema.index({ captureTimestamp: -1 });

export const TelemetrySampleModel: Model<ITelemetrySampleDocument> =
  model<ITelemetrySampleDocument>('TelemetrySample', telemetrySampleSchema);
