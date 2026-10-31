/**
 * Bounded In-Process Event Broadcaster
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 16.2
 *
 * Dispatches validated versioned envelopes to subscribed WebSocket clients.
 * Enforces bounded queues, channel scoping, and latest-value dropping.
 */

import { DefectDetectedEventPayload, InspectionStatusEventPayload, WsChannel, WsMessageEnvelope } from '../interfaces/websocket.interface';
import { RobotConnectionSnapshot } from '../interfaces/robot-connection.interface';
import { SoftwareEmergencyStopResponse } from '../interfaces/robot.interface';
import { SystemStatusData } from '../interfaces/system-status.interface';
import { TelemetrySnapshot } from '../interfaces/telemetry.interface';
import { telemetrySnapshotSchema } from '../validators/telemetry.validator';
import { createWsEnvelope } from '../validators/websocket.validator';
import { logger } from '../utils/logger';
import { WsClientSession } from './ws-session';

export class EventBroadcaster {
  private readonly clients = new Map<string, WsClientSession>();

  /**
   * Registers a connected client session
   */
  public registerClient(session: WsClientSession): void {
    this.clients.set(session.id, session);
    logger.info(
      { clientId: session.id, role: session.role, totalClients: this.clients.size },
      'Registered WebSocket client session'
    );
  }

  /**
   * Unregisters a client session and cleans up resources
   */
  public unregisterClient(clientId: string): void {
    const session = this.clients.get(clientId);
    if (session) {
      this.clients.delete(clientId);
      logger.info(
        { clientId, totalClients: this.clients.size },
        'Unregistered WebSocket client session'
      );
    }
  }

  /**
   * Returns current active client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Retrieves a client session by ID
   */
  public getClient(clientId: string): WsClientSession | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Returns an iterator over all active client sessions
   */
  public getAllSessions(): IterableIterator<WsClientSession> {
    return this.clients.values();
  }

  /**
   * Sends an envelope directly to a specific client
   */
  public sendToClient<T>(clientId: string, envelope: WsMessageEnvelope<T>): boolean {
    const session = this.clients.get(clientId);
    if (!session) {
      return false;
    }
    return session.sendEnvelope(envelope);
  }

  /**
   * Broadcasts an envelope to all clients subscribed to a given channel
   */
  public broadcastToChannel<T>(
    channel: WsChannel,
    envelope: WsMessageEnvelope<T>,
    isHighFrequencyTelemetry = false
  ): void {
    const staleClients: string[] = [];

    for (const [clientId, session] of this.clients.entries()) {
      if (session.hasChannel(channel)) {
        if (session.socket.readyState !== 1 /* WebSocket.OPEN */) {
          staleClients.push(clientId);
          continue;
        }
        session.sendEnvelope(envelope, isHighFrequencyTelemetry);
      }
    }

    // Clean up stale disconnected clients encountered during broadcast
    for (const staleId of staleClients) {
      this.unregisterClient(staleId);
    }
  }

  /**
   * Broadcasts an envelope to all active clients regardless of channel
   */
  public broadcastAll<T>(envelope: WsMessageEnvelope<T>): void {
    for (const session of this.clients.values()) {
      session.sendEnvelope(envelope);
    }
  }

  // Domain-Specific Broadcast Helpers

  /**
   * Broadcasts robot hardware connection status
   */
  public broadcastRobotStatus(snapshot: RobotConnectionSnapshot): void {
    const envelope = createWsEnvelope('robot.status', snapshot);
    this.broadcastToChannel('monitoring', envelope);
  }

  /**
   * Broadcasts telemetry snapshot.
   * Validates snapshot against strict schema before broadcast.
   */
  public broadcastTelemetry(snapshot: TelemetrySnapshot): void {
    const validation = telemetrySnapshotSchema.safeParse(snapshot);
    if (!validation.success) {
      logger.error(
        { errors: validation.error.issues },
        'Cannot broadcast telemetry snapshot: Validation failed'
      );
      return;
    }

    const envelope = createWsEnvelope('robot.telemetry', validation.data);
    this.broadcastToChannel('monitoring', envelope, true);
  }

  /**
   * Broadcasts inspection lifecycle state change
   */
  public broadcastInspectionStatus(payload: InspectionStatusEventPayload): void {
    const envelope = createWsEnvelope('inspection.status', payload);
    this.broadcastToChannel('monitoring', envelope);
  }

  /**
   * Broadcasts defect detection event
   */
  public broadcastDefectDetected(payload: DefectDetectedEventPayload): void {
    const envelope = createWsEnvelope('defect.detected', payload);
    this.broadcastToChannel('monitoring', envelope);
  }

  /**
   * Broadcasts system subsystem status change
   */
  public broadcastSystemStatus(payload: SystemStatusData): void {
    const envelope = createWsEnvelope('system.status', payload);
    this.broadcastToChannel('monitoring', envelope);
  }

  /**
   * Broadcasts software emergency stop acknowledgement.
   * NOTE: Does NOT claim physical stop confirmation.
   */
  public broadcastEmergencyStopAck(payload: SoftwareEmergencyStopResponse): void {
    const envelope = createWsEnvelope('robot.emergency_stop_ack', payload);
    this.broadcastToChannel('monitoring', envelope);
  }

  /**
   * Closes all active client sessions cleanly
   */
  public closeAll(code = 1001, reason = 'Server shutting down'): void {
    for (const session of this.clients.values()) {
      session.close(code, reason);
    }
    this.clients.clear();
  }
}

export const eventBroadcaster = new EventBroadcaster();
