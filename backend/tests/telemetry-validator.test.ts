/**
 * Vehicle Telemetry Validation Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.2
 */

import { describe, expect, it } from 'vitest';
import { UNAVAILABLE_TELEMETRY_SNAPSHOT } from '../src/interfaces/telemetry.interface';
import { telemetrySnapshotSchema } from '../src/validators/telemetry.validator';

describe('Telemetry Snapshot Validation (Zod Schema)', () => {
  it('should accept the canonical UNAVAILABLE_TELEMETRY_SNAPSHOT with explicit nulls', () => {
    const result = telemetrySnapshotSchema.safeParse(UNAVAILABLE_TELEMETRY_SNAPSHOT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isAvailable).toBe(false);
      expect(result.data.connectionState).toBe('disconnected');
      expect(result.data.leftEncoderCount).toBeNull();
      expect(result.data.rightEncoderCount).toBeNull();
      expect(result.data.leftRpm).toBeNull();
      expect(result.data.rightRpm).toBeNull();
      expect(result.data.estimatedDistanceMeters).toBeNull();
      expect(result.data.mpu6050).toBeNull();
    }
  });

  it('should accept a valid populated telemetry snapshot with finite numbers', () => {
    const populated = {
      isAvailable: true,
      connectionState: 'connected' as const,
      captureTimestamp: '2026-11-01T01:00:00.000Z',
      sequenceNumber: 142,
      leftEncoderCount: 1540,
      rightEncoderCount: 1538,
      leftRpm: 45.2,
      rightRpm: 45.1,
      speedMps: 0.12,
      estimatedDistanceMeters: 3.45,
      mpu6050: {
        accelX: 0.02,
        accelY: -0.01,
        accelZ: 9.81,
        gyroX: 0.1,
        gyroY: -0.2,
        gyroZ: 0.05,
        pitchDegrees: 1.2,
        rollDegrees: -0.5,
        yawDegrees: null,
      },
      isStale: false,
    };

    const result = telemetrySnapshotSchema.safeParse(populated);
    expect(result.success).toBe(true);
  });

  it('should reject NaN, Infinity, and -Infinity values for numeric fields', () => {
    const withNan = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      leftRpm: Number.NaN,
    };
    expect(telemetrySnapshotSchema.safeParse(withNan).success).toBe(false);

    const withInfinity = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      estimatedDistanceMeters: Number.POSITIVE_INFINITY,
    };
    expect(telemetrySnapshotSchema.safeParse(withInfinity).success).toBe(false);

    const withNegInfinity = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      speedMps: Number.NEGATIVE_INFINITY,
    };
    expect(telemetrySnapshotSchema.safeParse(withNegInfinity).success).toBe(false);
  });

  it('should reject non-integer values for encoder counts and sequence numbers', () => {
    const nonIntEncoder = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      leftEncoderCount: 12.34,
    };
    expect(telemetrySnapshotSchema.safeParse(nonIntEncoder).success).toBe(false);

    const nonIntSeq = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      sequenceNumber: 100.5,
    };
    expect(telemetrySnapshotSchema.safeParse(nonIntSeq).success).toBe(false);
  });

  it('should reject invalid non-ISO datetime captureTimestamp', () => {
    const invalidTimestamp = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      captureTimestamp: 'yesterday-at-noon',
    };
    expect(telemetrySnapshotSchema.safeParse(invalidTimestamp).success).toBe(false);
  });

  it('should reject unrecognized extra keys (strict schema check)', () => {
    const withExtraKey = {
      ...UNAVAILABLE_TELEMETRY_SNAPSHOT,
      fabricatedMotorAmps: 2.5,
    };
    expect(telemetrySnapshotSchema.safeParse(withExtraKey).success).toBe(false);
  });
});

