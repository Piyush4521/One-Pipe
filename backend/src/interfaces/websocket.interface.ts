/**
 * WebSocket Protocol & Message Envelope Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 16.2
 *
 * All messages are versioned and strictly structured.
 */

import { InspectionLifecycleState } from './inspection.interface';

export type WsProtocolVersion = '1.0.0';

/**
 * Client Roles:
 * In Stage 2, all WebSocket connections are strictly 'monitoring'.
 * Privileged 'operator' role over WebSocket is disabled until secure browser
 * session provisioning and storage mechanisms are established.
 */
export type WsClientRole = 'monitoring';

/**
 * WebSocket Channels:
 * 'monitoring': Public read-only telemetry, inspection lifecycle, defect alerts, and system health.
 * 'operator_control': Privileged operator channel, disabled in Stage 2 pending secure session provisioning.
 */
export type WsChannel = 'monitoring' | 'operator_control';

/**
 * Standard WebSocket Message Envelope (Server-to-Client & Client-to-Server)
 */
export interface WsMessageEnvelope<T = unknown> {
  protocolVersion: WsProtocolVersion;
  messageId: string;
  type: string;
  timestamp: string; // ISO 8601 UTC
  payload: T;
}

/**
 * Handshake Acknowledgement Payload (Server -> Client)
 */
export interface WsConnectionAckPayload {
  clientId: string;
  assignedRole: WsClientRole;
  subscribedChannels: WsChannel[];
  isTelemetryProducerAttached: false;
  serverTime: string;
  message: string;
}

/**
 * Inspection Lifecycle Change Event Payload (Server -> Client)
 */
export interface InspectionStatusEventPayload {
  inspectionId: string;
  status: InspectionLifecycleState;
  previousStatus?: InspectionLifecycleState;
  conduitName?: string;
  totalDistanceMeters: number | null;
  defectCount: number;
  timestamp: string;
}

/**
 * Defect Detection Event Payload (Server -> Client)
 * PROVISIONAL APPLICATION CONTRACT (Stage 4 Integration Target):
 * - No AI inference producer is attached in Stage 2 (reserved for Stage 4).
 * - No fabricated defect events are emitted at runtime.
 * - 'confidence' represents the object detection model classification probability (0.0 to 1.0);
 *   it is strictly NOT physical defect severity (Rulebook § 14.5).
 * - 'frameCaptureTimestamp' is the camera optical acquisition timestamp and is strictly
 *   separated from 'inferenceTimestamp' (when the YOLO model completed inference).
 */
export interface DefectDetectedEventPayload {
  id: string;
  inspectionId: string;
  classId: number;
  className: string;
  confidence: number;            // Detection probability 0.0 to 1.0; NOT physical defect severity (§ 14.5)
  estimatedDistance: number;     // Calibrated odometry distance in meters
  frameId: string;
  frameCaptureTimestamp: string; // ISO 8601 camera frame acquisition timestamp
  inferenceTimestamp?: string;   // ISO 8601 AI model inference completion timestamp
  evidenceImagePath: string;     // Filesystem relative storage path
  reviewStatus: string;          // Human review state (defaults to UNREVIEWED)
}

/**
 * Client Authentication Request Payload (Client -> Server)
 * NOTE: In-band WebSocket operator token authentication is DISABLED in Stage 2.
 * Privileged subscriptions remain unavailable until secure operator session
 * provisioning is established.
 */
export interface WsAuthRequestPayload {
  token?: string;
}

/**
 * Authentication Acknowledgement Payload (Server -> Client)
 */
export interface WsAuthAckPayload {
  success: boolean;
  role: WsClientRole;
  message: string;
}

/**
 * Channel Subscription Request Payload (Client -> Server)
 */
export interface WsSubscriptionPayload {
  channels: WsChannel[];
}

/**
 * Channel Subscription Acknowledgement Payload (Server -> Client)
 */
export interface WsSubscriptionAckPayload {
  channels: WsChannel[];
  message: string;
}

/**
 * Protocol Error Payload (Server -> Client)
 */
export interface WsErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Transport Ping Payload (Client -> Server)
 */
export interface WsPingPayload {
  clientTimestamp?: string;
}

/**
 * Transport Pong Payload (Server -> Client)
 */
export interface WsPongPayload {
  clientTimestamp?: string;
  serverTimestamp: string;
}
