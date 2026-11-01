/**
 * Vehicle Telemetry Data Interfaces
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.2
 *
 * MEASUREMENT SEMANTICS & CALIBRATION DEPENDENCIES:
 * 1. Raw Sensor Readings:
 *    - leftEncoderCount, rightEncoderCount: Raw integer interrupt pulse counts from ESP32 ISR.
 *    - mpu6050: Direct digital motion processor / accelerometer / gyro samples.
 * 2. Derived & Calibrated Measurements (PROVISIONAL):
 *    - leftRpm, rightRpm: Provisional rotational velocity. Dependent on hardware sample period
 *      and encoder pulses-per-revolution (PPR) calibration.
 *    - speedMps: Provisional linear velocity. Dependent on wheel diameter, slip ratio, and gear ratio.
 *    - estimatedDistanceMeters: Provisional longitudinal distance. Dependent on physical wheel
 *      circumference, mechanical mounting, and physical track calibration.
 *    NOTE: Derived fields are NOT physically meaningful until hardware calibration is performed in Stage 5.
 *    All uncalibrated or unavailable measurements must strictly remain null.
 * 3. Strict Prohibitions:
 *    - Missing sensor values must NEVER be silently coerced to zero.
 *    - Hardware constants (PPR, wheel circumference, RPM limits, sample rates) are NOT invented here.
 */

import { RobotConnectionState } from './robot-connection.interface';
import { PaginationParams } from './pagination.interface';

export interface Mpu6050Readings {
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

export interface TelemetrySnapshot {
  isAvailable: boolean;                  // false when telemetry producer is unattached
  connectionState: RobotConnectionState;
  captureTimestamp: string | null;       // ISO 8601 when sensor readings sampled
  sequenceNumber: number | null;         // Hardware sample/packet sequence counter

  // --- RAW SENSOR READINGS ---
  leftEncoderCount: number | null;       // Raw hardware pulse count (null if unread)
  rightEncoderCount: number | null;      // Raw hardware pulse count (null if unread)
  mpu6050: Mpu6050Readings | null;       // Raw inertial measurement readings

  // --- DERIVED / CALIBRATED MEASUREMENTS (Provisional - Calibration Dependent) ---
  leftRpm: number | null;                // Calibrated RPM (null until sample period & PPR calibrated)
  rightRpm: number | null;               // Calibrated RPM (null until sample period & PPR calibrated)
  speedMps: number | null;               // Calibrated linear velocity (null until wheel diameter calibrated)
  estimatedDistanceMeters: number | null;// Calibrated longitudinal distance (null until wheel circumference calibrated)

  isStale: boolean;
  notes?: string;
}

/**
 * Default telemetry snapshot when no hardware producer is attached.
 * Truthfully exposes unavailable hardware readings as null.
 */
export const UNAVAILABLE_TELEMETRY_SNAPSHOT: TelemetrySnapshot = {
  isAvailable: false,
  connectionState: 'disconnected',
  captureTimestamp: null,
  sequenceNumber: null,
  leftEncoderCount: null,
  rightEncoderCount: null,
  leftRpm: null,
  rightRpm: null,
  speedMps: null,
  estimatedDistanceMeters: null,
  mpu6050: null,
  isStale: true,
  notes: 'No hardware telemetry producer is attached. Derived values require mechanical calibration in Stage 5.',
};

export interface PersistedTelemetryRecord extends TelemetrySnapshot {
  sampleId: string;
  inspectionId: string | null;
  createdAt?: string;
}

export interface TelemetrySampleDTO {
  sampleId?: string;
  inspectionId?: string | null;
  captureTimestamp?: string | Date;
  sequenceNumber?: number | null;
  isAvailable?: boolean;
  connectionState?: RobotConnectionState;
  leftEncoderCount?: number | null;
  rightEncoderCount?: number | null;
  mpu6050?: Mpu6050Readings | null;
  leftRpm?: number | null;
  rightRpm?: number | null;
  speedMps?: number | null;
  estimatedDistanceMeters?: number | null;
  isStale?: boolean;
  notes?: string | null;
}

export interface TelemetryFilter extends PaginationParams {
  inspectionId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
}

export interface BatchIngestResult {
  insertedCount: number;
  duplicateCount: number;
}

export interface TelemetrySessionSummary {
  inspectionId: string;
  sampleCount: number;
  totalDistanceMeters: number | null;
  maxSpeedMps: number | null;
  avgSpeedMps: number | null;
  maxPitchDeg: number | null;
  minPitchDeg: number | null;
  maxRollDeg: number | null;
  minRollDeg: number | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
}

