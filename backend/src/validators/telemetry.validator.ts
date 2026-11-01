/**
 * Vehicle Telemetry Validation Schemas
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.2
 *
 * Enforces numeric finiteness, structural bounds, and explicit nullability.
 * Distinguishes raw hardware pulses from derived/calibrated metrics.
 * Unread or uncalibrated fields must NEVER be coerced to zero.
 */

import { z } from 'zod';

const finiteNumberOrNull = z
  .number()
  .refine(Number.isFinite, { message: 'Value must be a finite number' })
  .nullable();

const finiteIntOrNull = z
  .number()
  .int('Value must be an integer')
  .refine(Number.isFinite, { message: 'Value must be a finite integer' })
  .nullable();

export const mpu6050Schema = z
  .object({
    accelX: finiteNumberOrNull,
    accelY: finiteNumberOrNull,
    accelZ: finiteNumberOrNull,
    gyroX: finiteNumberOrNull,
    gyroY: finiteNumberOrNull,
    gyroZ: finiteNumberOrNull,
    pitchDegrees: finiteNumberOrNull,
    rollDegrees: finiteNumberOrNull,
    yawDegrees: finiteNumberOrNull,
  })
  .strict()
  .nullable();

export const telemetrySnapshotSchema = z
  .object({
    isAvailable: z.boolean(),
    connectionState: z.enum(['disconnected', 'connecting', 'connected', 'error']),
    captureTimestamp: z
      .string()
      .datetime({ message: 'captureTimestamp must be a valid ISO 8601 UTC string' })
      .nullable(),
    sequenceNumber: finiteIntOrNull,
    leftEncoderCount: finiteIntOrNull,
    rightEncoderCount: finiteIntOrNull,
    leftRpm: finiteNumberOrNull,
    rightRpm: finiteNumberOrNull,
    speedMps: finiteNumberOrNull,
    estimatedDistanceMeters: finiteNumberOrNull,
    mpu6050: mpu6050Schema,
    isStale: z.boolean(),
    notes: z.string().max(500).optional(),
  })
  .strict();

export type ValidatedTelemetrySnapshot = z.infer<typeof telemetrySnapshotSchema>;

export const telemetrySampleDtoSchema = z.object({
  sampleId: z.string().trim().optional(),
  inspectionId: z.string().trim().nullable().optional(),
  captureTimestamp: z
    .string()
    .datetime({ message: 'captureTimestamp must be a valid ISO 8601 string' })
    .optional(),
  sequenceNumber: finiteIntOrNull.optional(),
  isAvailable: z.boolean().optional(),
  connectionState: z.enum(['disconnected', 'connecting', 'connected', 'error']).optional(),
  leftEncoderCount: finiteIntOrNull.optional(),
  rightEncoderCount: finiteIntOrNull.optional(),
  leftRpm: finiteNumberOrNull.optional(),
  rightRpm: finiteNumberOrNull.optional(),
  speedMps: finiteNumberOrNull.optional(),
  estimatedDistanceMeters: finiteNumberOrNull.optional(),
  mpu6050: mpu6050Schema.optional(),
  isStale: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const telemetryBatchDtoSchema = z.object({
  samples: z.array(telemetrySampleDtoSchema).min(1, 'At least one sample is required').max(500, 'Batch size cannot exceed 500 samples'),
});


