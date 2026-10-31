/**
 * PipeBot Inspection & Telemetry Data Contracts
 * Defined in accordance with Rules/PipeBot_Build_Rulebook.md § 11, 12, 14, 16, 17
 *
 * NOTE: These types define frontend presentation interfaces and planned Stage 2 API contracts.
 * No mock services or fake API calls are implemented in Stage 1.
 */

/**
 * Inspection Session Lifecycle States (Rulebook § 9)
 */
export type InspectionLifecycleState =
  | 'disconnected'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'recovery_required';

/**
 * Subsystem Health States (Rulebook § 8.4)
 */
export type SubsystemStatus = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface SystemStatusSnapshot {
  esp32: SubsystemStatus;
  camera: SubsystemStatus;
  aiEngine: SubsystemStatus;
  database: SubsystemStatus;
  gpuDeviceName?: string;
  isGpuAvailable: boolean;
  lastChecked?: string;
}

/**
 * AI Bounding Box Reticle (Rulebook § 12.3, 14.3)
 */
export interface DetectionBox {
  id: string;
  classId: number;
  className: string;
  confidence: number; // Model detection probability (0.0 to 1.0); NOT physical defect severity (§ 14.5)
  // Normalized 0.0 to 1.0 relative to video dimensions
  x: number;
  y: number;
  width: number;
  height: number;
  frameId?: string;
  captureTimestamp?: string;
}

/**
 * High-Frequency Vehicle Telemetry Snapshot (Rulebook § 11)
 */
export interface TelemetrySnapshot {
  leftRpm: number | null;
  rightRpm: number | null;
  speed: number | null; // m/s linear translational velocity
  distance: number | null; // Calibrated distance in meters from start
  leftEncoderCount: number | null; // Raw interrupt counts
  rightEncoderCount: number | null;
  pitch: number | null; // MPU6050 degrees
  roll: number | null;
  yaw: number | null;
  timestamp: string | null;
  isStale: boolean;
  sequenceNumber?: number | null;
}

/**
 * Longitudinal Conduit Timeline Defect Marker (Rulebook § 11.3)
 */
export interface TimelineDefectMarker {
  id: string;
  estimatedDistance: number; // meters from inspection start
  className: string;
  confidence: number;
  timestamp?: string;
}

/**
 * Defect Evidence Record Document (Rulebook § 14.3, 16.4)
 * Maps to future MongoDB `defects` collection
 */
export interface DefectEvidenceRecord {
  id: string;
  inspectionId: string;
  classId: number;
  className: string;
  confidence: number;
  estimatedDistance: number; // Estimated from frame capture time and encoder sync
  frameId: string;
  frameCaptureTimestamp: string;
  inferenceTimestamp?: string;
  reviewStatus: 'UNREVIEWED' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'NEEDS_VERIFICATION';
  evidenceImagePath: string;
  operatorNotes?: string;
}

/**
 * Inspection Session Document (Rulebook § 9, 16.4)
 * Maps to future MongoDB `inspections` collection
 */
export interface InspectionSessionRecord {
  id: string;
  conduitName?: string;
  startTimestamp: string;
  endTimestamp?: string;
  durationSeconds?: number;
  totalDistanceMeters: number;
  defectCount: number;
  status: InspectionLifecycleState;
  reportGenerated: boolean;
  backupVerified: boolean;
  operatorNotes?: string;
}

/**
 * Consolidated PDF Report Document (Rulebook § 17)
 */
export interface ConsolidatedReportRecord {
  id: string;
  inspectionId: string;
  compiledTimestamp: string;
  fileSizeBytes: number;
  totalDistanceMeters: number;
  defectCount: number;
  pdfRelativePath: string;
  backupVerified: boolean;
}
