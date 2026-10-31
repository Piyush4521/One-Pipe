/**
 * WebSocket Client Session
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 16.2
 *
 * Manages individual client connection state, authorization role,
 * subscribed channels, backpressure, and safe transmission.
 */

import crypto from 'crypto';
import type { WebSocket } from 'ws';
import {
  WS_HARD_MAX_BUFFERED_AMOUNT_BYTES,
  WS_MAX_BUFFERED_AMOUNT_BYTES,
} from '../config/constants';
import {
  WsChannel,
  WsClientRole,
  WsMessageEnvelope,
} from '../interfaces/websocket.interface';
import { logger } from '../utils/logger';

export class WsClientSession {
  public readonly id: string;
  public readonly socket: WebSocket;
  public readonly origin: string | undefined;
  public readonly connectedAt: Date;
  public isAlive: boolean;
  public role: WsClientRole;
  public readonly channels: Set<WsChannel>;

  constructor(socket: WebSocket, origin: string | undefined) {
    this.id = crypto.randomUUID();
    this.socket = socket;
    this.origin = origin;
    this.connectedAt = new Date();
    this.isAlive = true;
    this.role = 'monitoring'; // Default role is strictly monitoring-only
    this.channels = new Set<WsChannel>(['monitoring']); // Default channel subscription
  }

  /**
   * Evaluates if this client is subscribed to the specified channel
   */
  public hasChannel(channel: WsChannel): boolean {
    return this.channels.has(channel);
  }

  /**
   * Subscribes to channels
   */
  public addChannels(channels: WsChannel[]): void {
    for (const channel of channels) {
      this.channels.add(channel);
    }
  }

  /**
   * Unsubscribes from channels
   */
  public removeChannels(channels: WsChannel[]): void {
    for (const channel of channels) {
      this.channels.delete(channel);
    }
  }

  /**
   * Sets client authorization role
   */
  public setRole(role: WsClientRole): void {
    this.role = role;
  }

  /**
   * Safely sends a versioned envelope to the client.
   * Implements latest-value dropping on backpressure for high-frequency telemetry
   * and terminates sockets that exceed hard buffer ceilings.
   */
  public sendEnvelope<T>(envelope: WsMessageEnvelope<T>, isHighFrequencyTelemetry = false): boolean {
    if (this.socket.readyState !== 1 /* WebSocket.OPEN */) {
      return false;
    }

    const buffered = this.socket.bufferedAmount;

    // Hard ceiling check: terminate persistently blocked slow clients to protect process memory
    if (buffered > WS_HARD_MAX_BUFFERED_AMOUNT_BYTES) {
      logger.warn(
        { clientId: this.id, bufferedBytes: buffered, limit: WS_HARD_MAX_BUFFERED_AMOUNT_BYTES },
        'Client socket bufferedAmount exceeded hard ceiling. Terminating slow client to protect server memory.'
      );
      try {
        this.socket.close(1008, 'Slow client buffer exceeded ceiling');
      } catch (err) {
        logger.error({ clientId: this.id, err }, 'Failed to cleanly close slow client socket');
      }
      return false;
    }

    // Soft threshold check: apply latest-value policy by dropping high-frequency telemetry
    if (buffered > WS_MAX_BUFFERED_AMOUNT_BYTES && isHighFrequencyTelemetry) {
      logger.debug(
        { clientId: this.id, bufferedBytes: buffered, limit: WS_MAX_BUFFERED_AMOUNT_BYTES },
        'Dropping stale high-frequency telemetry frame for slow client (latest-value policy)'
      );
      return false;
    }

    try {
      this.socket.send(JSON.stringify(envelope));
      return true;
    } catch (err) {
      logger.error({ clientId: this.id, err }, 'Unexpected socket.send error');
      return false;
    }
  }

  /**
   * Closes the underlying socket connection safely
   */
  public close(code = 1000, reason = 'Normal closure'): void {
    try {
      if (this.socket.readyState === 1 /* WebSocket.OPEN */ || this.socket.readyState === 0 /* CONNECTING */) {
        this.socket.close(code, reason);
      }
    } catch (err) {
      logger.error({ clientId: this.id, err }, 'Error closing client socket');
    }
  }
}

