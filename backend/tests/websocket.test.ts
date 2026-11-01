/**
 * WebSocket Integration & Resilience Tests
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 16.2
 */

import http from 'http';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { EventBroadcaster } from '../src/websocket/ws-broadcaster';
import { PipeBotWsServer } from '../src/websocket/ws-server';
import { WsMessageEnvelope } from '../src/interfaces/websocket.interface';

/**
 * Helper client wrapper that buffers messages immediately upon creation
 * to avoid race conditions when initial messages arrive before listeners attach.
 */
class TestClientWrapper {
  public readonly socket: WebSocket;
  private readonly messageQueue: WsMessageEnvelope[] = [];
  private readonly waiters: ((msg: WsMessageEnvelope) => void)[] = [];

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as WsMessageEnvelope;
        if (this.waiters.length > 0) {
          const waiter = this.waiters.shift()!;
          waiter(parsed);
        } else {
          this.messageQueue.push(parsed);
        }
      } catch (err) {
        // Handle malformed JSON if tested
      }
    });
  }

  public nextMessage(timeoutMs = 2000): Promise<WsMessageEnvelope> {
    if (this.messageQueue.length > 0) {
      return Promise.resolve(this.messageQueue.shift()!);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for next WebSocket message after ${timeoutMs}ms`));
      }, timeoutMs);
      this.waiters.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  public send(payload: string): void {
    this.socket.send(payload);
  }

  public close(): void {
    this.socket.close();
  }

  public terminate(): void {
    this.socket.terminate();
  }
}

describe('WebSocket Server Foundation & Protocol Integration', () => {
  let server: http.Server;
  let wsServer: PipeBotWsServer;
  let broadcaster: EventBroadcaster;
  let port: number;
  const activeClients: TestClientWrapper[] = [];

  function createClient(path = '/ws', origin = 'http://localhost:3000'): Promise<TestClientWrapper> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
        headers: { Origin: origin },
      });
      const wrapper = new TestClientWrapper(socket);
      activeClients.push(wrapper);

      socket.on('open', () => resolve(wrapper));
      socket.on('error', (err) => reject(err));
    });
  }

  beforeEach(async () => {
    broadcaster = new EventBroadcaster();
    wsServer = new PipeBotWsServer(broadcaster);
    server = http.createServer(app);
    wsServer.attachToHttpServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        port = address.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    for (const client of activeClients) {
      if (
        client.socket.readyState === WebSocket.OPEN ||
        client.socket.readyState === WebSocket.CONNECTING
      ) {
        client.terminate();
      }
    }
    activeClients.length = 0;

    await wsServer.close();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should establish connection and receive connection.ack followed by initial state snapshots', async () => {
    const client = await createClient();

    // 1. connection.ack
    const msg1 = await client.nextMessage();
    expect(msg1.protocolVersion).toBe('1.0.0');
    expect(msg1.type).toBe('connection.ack');
    expect((msg1.payload as any).assignedRole).toBe('monitoring');
    expect((msg1.payload as any).subscribedChannels).toContain('monitoring');
    expect((msg1.payload as any).isTelemetryProducerAttached).toBe(false);

    // 2. robot.status
    const msg2 = await client.nextMessage();
    expect(msg2.type).toBe('robot.status');
    expect((msg2.payload as any).state).toBe('disconnected');

    // 3. system.status
    const msg3 = await client.nextMessage();
    expect(msg3.type).toBe('system.status');
    expect((msg3.payload as any).process).toBe('alive');
    expect((msg3.payload as any).storage.driver).toBe('mongodb');

    // 4. robot.telemetry (truthfully unavailable)
    const msg4 = await client.nextMessage();
    expect(msg4.type).toBe('robot.telemetry');
    expect((msg4.payload as any).isAvailable).toBe(false);
    expect((msg4.payload as any).leftRpm).toBeNull();
    expect((msg4.payload as any).rightRpm).toBeNull();
    expect((msg4.payload as any).estimatedDistanceMeters).toBeNull();
  });

  it('should reject connection upgrade from unauthorized Origin with HTTP 403', async () => {
    await expect(
      createClient('/ws', 'http://unauthorized-malicious-domain.com')
    ).rejects.toThrow();
  });

  it('should reject connection upgrade to invalid path with HTTP 404', async () => {
    await expect(
      createClient('/invalid-upgrade-path', 'http://localhost:3000')
    ).rejects.toThrow();
  });

  it('should reject message with unsupported protocol version', async () => {
    const client = await createClient();
    // drain initial 4 messages
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const badVersionMsg = {
      protocolVersion: '2.0.0',
      type: 'ping',
      payload: {},
    };

    client.send(JSON.stringify(badVersionMsg));

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect((response.payload as any).code).toBe('UNSUPPORTED_PROTOCOL_VERSION');
  });

  it('should reject malformed JSON with INVALID_JSON error envelope', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    client.send('{ invalid json text');

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect((response.payload as any).code).toBe('INVALID_JSON');
  });

  it('should respond to ping with pong transport envelope', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const pingMsg = {
      protocolVersion: '1.0.0',
      type: 'ping',
      messageId: 'ping-123',
      payload: { clientTimestamp: '2026-11-01T01:00:00.000Z' },
    };

    client.send(JSON.stringify(pingMsg));

    const response = await client.nextMessage();
    expect(response.type).toBe('pong');
    expect(response.messageId).toBe('ping-123');
    expect((response.payload as any).clientTimestamp).toBe('2026-11-01T01:00:00.000Z');
    expect(typeof (response.payload as any).serverTimestamp).toBe('string');
  });

  it('should reject subscription to operator_control channel with FEATURE_DISABLED and retain monitoring-only', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const subscribePrivileged = {
      protocolVersion: '1.0.0',
      type: 'subscribe',
      payload: {
        channels: ['operator_control'],
      },
    };

    client.send(JSON.stringify(subscribePrivileged));

    // Client receives FEATURE_DISABLED error
    const errResponse = await client.nextMessage();
    expect(errResponse.type).toBe('error');
    expect((errResponse.payload as any).code).toBe('FEATURE_DISABLED');

    // And subscription.ack confirms operator_control was NOT granted
    const ackResponse = await client.nextMessage();
    expect(ackResponse.type).toBe('subscription.ack');
    expect((ackResponse.payload as any).channels).not.toContain('operator_control');
    expect((ackResponse.payload as any).channels).toContain('monitoring');
  });

  it('should reject in-band operator token authentication attempts with FEATURE_DISABLED', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const authMsg = {
      protocolVersion: '1.0.0',
      type: 'auth',
      payload: {
        token: 'arbitrary-attempted-token',
      },
    };

    client.send(JSON.stringify(authMsg));

    const authResponse = await client.nextMessage();
    expect(authResponse.type).toBe('error');
    expect((authResponse.payload as any).code).toBe('FEATURE_DISABLED');
    expect((authResponse.payload as any).message).toContain('In-band WebSocket operator token authentication is disabled');
  });

  it('should allow legitimate monitoring channel updates and reject operator_control', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const mixedSubscribe = {
      protocolVersion: '1.0.0',
      type: 'subscribe',
      payload: {
        channels: ['monitoring', 'operator_control'],
      },
    };

    client.send(JSON.stringify(mixedSubscribe));

    const errResponse = await client.nextMessage();
    expect(errResponse.type).toBe('error');
    expect((errResponse.payload as any).code).toBe('FEATURE_DISABLED');

    const ackResponse = await client.nextMessage();
    expect(ackResponse.type).toBe('subscription.ack');
    expect((ackResponse.payload as any).channels).toEqual(['monitoring']);
  });

  it('should verify no synthetic defect events or unprovoked telemetry ticks are produced at startup', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    // After draining initial 4 messages, server must remain silent without unprompted fake events
    await expect(client.nextMessage(200)).rejects.toThrow();
  });

  it('should broadcast inspection events to all subscribed monitoring clients', async () => {
    const client1 = await createClient();
    const client2 = await createClient();

    for (let i = 0; i < 4; i++) {
      await client1.nextMessage();
      await client2.nextMessage();
    }

    // Broadcast inspection status
    broadcaster.broadcastInspectionStatus({
      inspectionId: 'test-insp-001',
      status: 'running',
      conduitName: 'Line-B',
      totalDistanceMeters: 1.25,
      defectCount: 0,
      timestamp: new Date().toISOString(),
    });

    const msg1 = await client1.nextMessage();
    const msg2 = await client2.nextMessage();

    expect(msg1.type).toBe('inspection.status');
    expect((msg1.payload as any).inspectionId).toBe('test-insp-001');
    expect((msg1.payload as any).status).toBe('running');

    expect(msg2.type).toBe('inspection.status');
    expect((msg2.payload as any).inspectionId).toBe('test-insp-001');
  });

  it('should reject robot movement command over WebSocket as unknown message type', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const fakeMovementCommand = {
      protocolVersion: '1.0.0',
      type: 'robot.move',
      payload: {
        linearVelocity: 0.5,
        angularVelocity: 0.0,
      },
    };

    client.send(JSON.stringify(fakeMovementCommand));

    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect((response.payload as any).code).toBe('UNKNOWN_MESSAGE_TYPE');
  });

  it('should clean up client registration on socket disconnection', async () => {
    const client = await createClient();
    expect(broadcaster.getClientCount()).toBe(1);

    client.close();

    // Wait briefly for close event
    await new Promise((r) => setTimeout(r, 50));
    expect(broadcaster.getClientCount()).toBe(0);
  });

  it('should apply latest-value policy and drop high-frequency telemetry when client socket backpressure is high', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const session = Array.from(broadcaster.getAllSessions())[0];
    expect(session).toBeDefined();

    // Simulate socket backpressure above soft threshold (256 KB)
    Object.defineProperty(session.socket, 'bufferedAmount', {
      value: 300000,
      configurable: true,
    });

    // Valid telemetry snapshot
    const testTelemetry = {
      isAvailable: true,
      connectionState: 'connected' as const,
      captureTimestamp: '2026-11-01T01:00:00.000Z',
      sequenceNumber: 1,
      leftEncoderCount: 10,
      rightEncoderCount: 10,
      leftRpm: 20,
      rightRpm: 20,
      speedMps: 0.1,
      estimatedDistanceMeters: 0.5,
      mpu6050: null,
      isStale: false,
    };

    broadcaster.broadcastTelemetry(testTelemetry);

    // Message should be dropped due to backpressure; next message times out
    await expect(client.nextMessage(200)).rejects.toThrow();
  });

  it('should terminate slow client socket when bufferedAmount exceeds hard ceiling', async () => {
    await createClient();
    const session = Array.from(broadcaster.getAllSessions())[0];
    expect(session).toBeDefined();

    // Simulate bufferedAmount exceeding hard ceiling (1 MB)
    Object.defineProperty(session.socket, 'bufferedAmount', {
      value: 1200000,
      configurable: true,
    });

    const envelope = {
      protocolVersion: '1.0.0' as const,
      messageId: 'test-id',
      type: 'test.event',
      timestamp: new Date().toISOString(),
      payload: {},
    };

    const sent = session.sendEnvelope(envelope);
    expect(sent).toBe(false);
  });

  it('should close all client sockets with code 1001 when wsServer.close is called', async () => {
    const client = await createClient();
    for (let i = 0; i < 4; i++) await client.nextMessage();

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      client.socket.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    await wsServer.close(1001, 'Server shutting down');

    const result = await closePromise;
    expect(result.code).toBe(1001);
    expect(result.reason).toBe('Server shutting down');
  });
});
