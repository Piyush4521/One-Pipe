/**
 * PipeBot WebSocket Telemetry & Event Stream Hook
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 11, 16.2
 *
 * Connects to ws://127.0.0.1:3000/ws to receive live telemetry snapshots,
 * system status events, and inspection lifecycle updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  TelemetrySnapshot,
  InspectionLifecycleState,
  SystemStatusSnapshot,
} from '@/types/inspection';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseWebSocketTelemetryOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  reconnectIntervalMs?: number;
  maxReconnectIntervalMs?: number;
  onEmergencyStopAck?: (data: unknown) => void;
}

export interface UseWebSocketTelemetryResult {
  status: WsConnectionStatus;
  telemetry?: TelemetrySnapshot;
  subsystemStatus?: SystemStatusSnapshot;
  inspectionState?: { inspectionId?: string; status: InspectionLifecycleState };
  lastError: string | null;
  reconnect: () => void;
  sendPing: () => void;
}

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:3000/ws';

export function useWebSocketTelemetry(options: UseWebSocketTelemetryOptions = {}): UseWebSocketTelemetryResult {
  const {
    wsUrl = DEFAULT_WS_URL,
    autoConnect = true,
    reconnectIntervalMs = 1500,
    maxReconnectIntervalMs = 10000,
    onEmergencyStopAck,
  } = options;

  const [status, setStatus] = useState<WsConnectionStatus>('disconnected');
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | undefined>(undefined);
  const [subsystemStatus, setSubsystemStatus] = useState<SystemStatusSnapshot | undefined>(undefined);
  const [inspectionState, setInspectionState] = useState<{ inspectionId?: string; status: InspectionLifecycleState } | undefined>(undefined);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef<number>(reconnectIntervalMs);
  const isUnmountedRef = useRef(false);

  const cleanupSocket = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
  }, []);

  const normalizeTelemetry = (raw: Record<string, unknown>): TelemetrySnapshot => {
    const mpu = (raw.mpu6050 as Record<string, unknown>) || {};
    return {
      leftRpm: typeof raw.leftRpm === 'number' ? raw.leftRpm : null,
      rightRpm: typeof raw.rightRpm === 'number' ? raw.rightRpm : null,
      speed: typeof raw.speedMps === 'number' ? raw.speedMps : (typeof raw.speed === 'number' ? raw.speed : null),
      distance: typeof raw.estimatedDistanceMeters === 'number' ? raw.estimatedDistanceMeters : (typeof raw.distance === 'number' ? raw.distance : null),
      leftEncoderCount: typeof raw.leftEncoderCount === 'number' ? raw.leftEncoderCount : null,
      rightEncoderCount: typeof raw.rightEncoderCount === 'number' ? raw.rightEncoderCount : null,
      pitch: typeof mpu.pitchDegrees === 'number' ? mpu.pitchDegrees : (typeof raw.pitch === 'number' ? raw.pitch : null),
      roll: typeof mpu.rollDegrees === 'number' ? mpu.rollDegrees : (typeof raw.roll === 'number' ? raw.roll : null),
      yaw: typeof mpu.yawDegrees === 'number' ? mpu.yawDegrees : (typeof raw.yaw === 'number' ? raw.yaw : null),
      timestamp: typeof raw.captureTimestamp === 'string' ? raw.captureTimestamp : (typeof raw.timestamp === 'string' ? raw.timestamp : null),
      isStale: Boolean(raw.isStale),
      sequenceNumber: typeof raw.sequenceNumber === 'number' ? raw.sequenceNumber : null,
    };
  };

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    cleanupSocket();

    try {
      setStatus('connecting');
      setLastError(null);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setStatus('connected');
        currentIntervalRef.current = reconnectIntervalMs;

        // Subscribe to monitoring channel
        try {
          ws.send(JSON.stringify({
            protocolVersion: '1.0.0',
            type: 'subscribe',
            payload: { channels: ['monitoring'] },
          }));
        } catch {
          // ignore send error
        }

        // Start ping loop
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                protocolVersion: '1.0.0',
                type: 'ping',
                payload: { clientTimestamp: new Date().toISOString() },
              }));
            } catch {
              // ignore
            }
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const envelope = JSON.parse(event.data);
          const type = envelope.type;
          const payload = envelope.payload;

          if (type === 'robot.telemetry' && payload) {
            setTelemetry(normalizeTelemetry(payload));
          } else if (type === 'system.status' && payload?.subsystems) {
            const sub = payload.subsystems;
            setSubsystemStatus({
              esp32: sub.esp32 ?? 'offline',
              camera: sub.camera ?? 'offline',
              aiEngine: sub.aiEngine ?? 'offline',
              database: sub.database ?? 'offline',
              gpuDeviceName: sub.gpuDeviceName ?? undefined,
              isGpuAvailable: Boolean(sub.isGpuAvailable),
              lastChecked: sub.lastChecked,
            });
          } else if (type === 'inspection.status' && payload) {
            setInspectionState({
              inspectionId: payload.inspectionId,
              status: payload.status,
            });
          } else if (type === 'emergency.stop' || type === 'emergency_stop_ack') {
            if (onEmergencyStopAck) {
              onEmergencyStopAck(payload);
            }
          }
        } catch {
          // Non-JSON or unsupported frame, safely ignore
        }
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        setStatus('error');
        setLastError('WebSocket connection error. Backend may be offline or unlinked.');
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setStatus('disconnected');
        cleanupSocket();

        // Schedule reconnect with exponential backoff
        const nextInterval = Math.min(currentIntervalRef.current * 1.5, maxReconnectIntervalMs);
        currentIntervalRef.current = nextInterval;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            connect();
          }
        }, nextInterval);
      };
    } catch (err) {
      if (isUnmountedRef.current) return;
      setStatus('error');
      setLastError(err instanceof Error ? err.message : 'Failed to initialize WebSocket');
    }
  }, [wsUrl, reconnectIntervalMs, maxReconnectIntervalMs, onEmergencyStopAck, cleanupSocket]);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({
          protocolVersion: '1.0.0',
          type: 'ping',
          payload: { clientTimestamp: new Date().toISOString() },
        }));
      } catch {
        // ignore
      }
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    currentIntervalRef.current = reconnectIntervalMs;
    connect();
  }, [connect, reconnectIntervalMs]);

  useEffect(() => {
    isUnmountedRef.current = false;
    if (autoConnect) {
      connect();
    }
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cleanupSocket();
    };
  }, [autoConnect, connect, cleanupSocket]);

  return {
    status,
    telemetry,
    subsystemStatus,
    inspectionState,
    lastError,
    reconnect,
    sendPing,
  };
}

