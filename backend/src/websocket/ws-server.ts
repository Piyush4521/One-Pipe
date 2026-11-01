/**
 * PipeBot WebSocket Server
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 16.2
 *
 * Handles connection upgrades, origin filtering, client authentication,
 * channel subscriptions, heartbeat pings, and structured event routing.
 */

import http from 'http';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import {
  WS_MAX_MESSAGE_PAYLOAD_BYTES,
  WS_PATH,
  WS_TRANSPORT_PING_INTERVAL_MS,
  isPermittedLocalOrigin,
} from '../config/constants';
import { env } from '../config/env';
import { healthService } from '../services/health.service';
import { robotService } from '../services/robot.service';
import { logger } from '../utils/logger';
import {
  createWsEnvelope,
  wsInboundBaseSchema,
  wsPingPayloadSchema,
  wsSubscribePayloadSchema,
  wsUnsubscribePayloadSchema,
} from '../validators/websocket.validator';
import { eventBroadcaster, EventBroadcaster } from './ws-broadcaster';
import { WsClientSession } from './ws-session';
import {
  WsConnectionAckPayload,
  WsErrorPayload,
  WsPongPayload,
  WsSubscriptionAckPayload,
} from '../interfaces/websocket.interface';
import { UNAVAILABLE_TELEMETRY_SNAPSHOT } from '../interfaces/telemetry.interface';

export class PipeBotWsServer {
  private readonly wss: WebSocketServer;
  private readonly broadcaster: EventBroadcaster;
  private pingIntervalTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(broadcaster: EventBroadcaster = eventBroadcaster) {
    this.broadcaster = broadcaster;
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: WS_MAX_MESSAGE_PAYLOAD_BYTES,
    });

    this.wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(socket, req);
    });

    this.startTransportPingLoop();
  }

  /**
   * Attaches WebSocket upgrade listener to the Node.js HTTP server
   */
  public attachToHttpServer(server: http.Server): void {
    server.on('upgrade', (req: http.IncomingMessage, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
  }

  /**
   * Evaluates HTTP Upgrade requests for route matching and Origin allowlisting
   */
  public handleUpgrade(
    req: http.IncomingMessage,
    socket: import('stream').Duplex,
    head: Buffer
  ): void {
    if (this.isShuttingDown) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);

    // Verify WebSocket path
    if (url.pathname !== WS_PATH) {
      logger.warn({ path: url.pathname, expected: WS_PATH }, 'WebSocket upgrade rejected: Invalid path');
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Origin header allowlist validation
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed = env.CORS_ORIGINS.includes(origin) || isPermittedLocalOrigin(origin);
      if (!isAllowed) {
        logger.warn(
          { origin, allowedOrigins: env.CORS_ORIGINS },
          'WebSocket upgrade rejected: Origin not permitted'
        );
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  /**
   * Initializes a connected client session
   */
  private handleConnection(socket: WebSocket, req: http.IncomingMessage): void {
    const origin = req.headers.origin;
    const session = new WsClientSession(socket, origin);
    this.broadcaster.registerClient(session);

    // 1. Send handshake connection acknowledgement
    const ackPayload: WsConnectionAckPayload = {
      clientId: session.id,
      assignedRole: session.role,
      subscribedChannels: Array.from(session.channels),
      isTelemetryProducerAttached: false,
      serverTime: new Date().toISOString(),
      message: 'Connected to PipeBot WebSocket event stream. Telemetry producer is detached in Stage 2.',
    };
    session.sendEnvelope(createWsEnvelope('connection.ack', ackPayload));

    // 2. Transmit truthful initial state snapshots
    session.sendEnvelope(createWsEnvelope('robot.status', robotService.getRobotStatus()));
    session.sendEnvelope(createWsEnvelope('system.status', healthService.getSystemStatusData()));
    session.sendEnvelope(createWsEnvelope('robot.telemetry', UNAVAILABLE_TELEMETRY_SNAPSHOT));

    // 3. Register socket event handlers
    socket.on('pong', () => {
      session.isAlive = true;
    });

    socket.on('message', (data: RawData) => {
      this.handleClientMessage(session, data);
    });

    socket.on('close', (code: number, reason: Buffer) => {
      logger.info(
        { clientId: session.id, code, reason: reason.toString() },
        'WebSocket client disconnected'
      );
      this.broadcaster.unregisterClient(session.id);
    });

    socket.on('error', (err: Error) => {
      logger.error({ clientId: session.id, err }, 'WebSocket client connection error');
      this.broadcaster.unregisterClient(session.id);
    });
  }

  /**
   * Processes inbound client messages with schema validation and access control
   */
  private handleClientMessage(session: WsClientSession, rawData: RawData): void {
    let rawText: string;
    try {
      rawText = rawData.toString();
    } catch {
      this.sendError(session, 'INVALID_PAYLOAD', 'Unable to decode message as UTF-8 string');
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      this.sendError(session, 'INVALID_JSON', 'Message payload must be valid JSON');
      return;
    }

    const envelopeValidation = wsInboundBaseSchema.safeParse(parsedJson);
    if (!envelopeValidation.success) {
      const issue = envelopeValidation.error.issues[0];
      const isVersionError = issue?.path.includes('protocolVersion');
      this.sendError(
        session,
        isVersionError ? 'UNSUPPORTED_PROTOCOL_VERSION' : 'INVALID_MESSAGE_SCHEMA',
        issue?.message || 'Invalid message envelope schema',
        envelopeValidation.error.issues
      );
      return;
    }

    const message = envelopeValidation.data;

    switch (message.type) {
      case 'ping': {
        const pingValidation = wsPingPayloadSchema.safeParse(message.payload);
        const pongPayload: WsPongPayload = {
          clientTimestamp: pingValidation.success ? pingValidation.data?.clientTimestamp : undefined,
          serverTimestamp: new Date().toISOString(),
        };
        session.sendEnvelope(createWsEnvelope('pong', pongPayload, message.messageId));
        break;
      }

      case 'auth': {
        // In-band token auth over WebSocket is strictly disabled
        this.sendError(
          session,
          'FEATURE_DISABLED',
          'In-band WebSocket operator token authentication is disabled. All WebSocket connections remain monitoring-only until secure browser session provisioning is established.'
        );
        break;
      }

      case 'subscribe': {
        const subValidation = wsSubscribePayloadSchema.safeParse(message.payload);
        if (!subValidation.success) {
          this.sendError(session, 'INVALID_SUBSCRIPTION_PAYLOAD', 'Malformed subscription payload', subValidation.error.issues);
          return;
        }

        const requestedChannels = subValidation.data.channels;
        const permittedChannels: import('../interfaces/websocket.interface').WsChannel[] = [];

        for (const channel of requestedChannels) {
          if (channel === 'operator_control') {
            this.sendError(
              session,
              'FEATURE_DISABLED',
              'Privileged channel operator_control is disabled until secure operator session provisioning is established. Connections remain monitoring-only.'
            );
          } else {
            permittedChannels.push(channel);
          }
        }

        session.addChannels(permittedChannels);
        const subAck: WsSubscriptionAckPayload = {
          channels: Array.from(session.channels),
          message: 'Subscription updated',
        };
        session.sendEnvelope(createWsEnvelope('subscription.ack', subAck, message.messageId));
        break;
      }

      case 'unsubscribe': {
        const unsubValidation = wsUnsubscribePayloadSchema.safeParse(message.payload);
        if (!unsubValidation.success) {
          this.sendError(session, 'INVALID_UNSUBSCRIBE_PAYLOAD', 'Malformed unsubscribe payload', unsubValidation.error.issues);
          return;
        }

        session.removeChannels(unsubValidation.data.channels);
        const unsubAck: WsSubscriptionAckPayload = {
          channels: Array.from(session.channels),
          message: 'Subscription updated',
        };
        session.sendEnvelope(createWsEnvelope('subscription.ack', unsubAck, message.messageId));
        break;
      }

      default: {
        this.sendError(
          session,
          'UNKNOWN_MESSAGE_TYPE',
          `Unrecognized message type '${message.type}'`
        );
        break;
      }
    }
  }

  /**
   * Helper to dispatch structured error envelopes
   */
  private sendError(
    session: WsClientSession,
    code: string,
    message: string,
    details?: unknown
  ): void {
    const errorPayload: WsErrorPayload = { code, message, details };
    session.sendEnvelope(createWsEnvelope('error', errorPayload));
  }

  /**
   * Software transport ping loop for detecting dropped TCP connections.
   * NOTE: This is purely a transport-level keepalive and is NOT an ESP32 robot watchdog.
   */
  private startTransportPingLoop(): void {
    this.pingIntervalTimer = setInterval(() => {
      for (const session of this.broadcaster.getAllSessions()) {
        if (!session.isAlive) {
          logger.warn({ clientId: session.id }, 'WebSocket client heartbeat timed out. Terminating connection.');
          session.socket.terminate();
          this.broadcaster.unregisterClient(session.id);
          continue;
        }

        session.isAlive = false;
        try {
          session.socket.ping();
        } catch {
          this.broadcaster.unregisterClient(session.id);
        }
      }
    }, WS_TRANSPORT_PING_INTERVAL_MS);

    // Unref timer so it does not block Node process exit
    this.pingIntervalTimer.unref();
  }

  /**
   * Graceful shutdown of the WebSocket server and all client sessions
   */
  public async close(code = 1001, reason = 'Server shutting down'): Promise<void> {
    this.isShuttingDown = true;

    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }

    this.broadcaster.closeAll(code, reason);

    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        logger.info('WebSocket server closed cleanly');
        resolve();
      });
    });
  }
}

export const wsServer = new PipeBotWsServer();
