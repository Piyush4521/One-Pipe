/**
 * PipeBot Backend Application Constants
 * Follows Rules/PipeBot_Build_Rulebook.md § 7, 16
 */

export const APP_NAME = 'pipebot-backend';
export const APP_VERSION = '1.0.0';
export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
export const MAX_JSON_BODY_SIZE = '1mb';
export const STORAGE_DRIVER_MONGODB = 'mongodb';
export const STORAGE_DRIVER_MEMORY = 'memory';
export const ACTIVE_STORAGE_DRIVER = STORAGE_DRIVER_MONGODB;

/**
 * WebSocket Protocol & Transport Constants
 * NOTE: WS transport ping is strictly a software TCP socket keepalive for dead-connection
 * cleanup between client and Node.js. It is NOT an ESP32 robot command watchdog, motor
 * safety cutoff, or hardware heartbeat timeout (Rulebook § 10.1). No robot safety timing
 * value is inferred from this setting.
 */
export const WS_PROTOCOL_VERSION = '1.0.0';
export const WS_PATH = '/ws';
export const WS_TRANSPORT_PING_INTERVAL_MS = 30000;
export const WS_MAX_BUFFERED_AMOUNT_BYTES = 262144; // 256 KB soft limit for telemetry drop
export const WS_HARD_MAX_BUFFERED_AMOUNT_BYTES = 1048576; // 1 MB hard limit for slow-client termination
export const WS_MAX_MESSAGE_PAYLOAD_BYTES = 65536; // 64 KB max incoming frame

/**
 * Helper to validate local-only browser origins.
 * Ensures only local interfaces (127.0.0.1 or localhost) can connect.
 */
export function isPermittedLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}
