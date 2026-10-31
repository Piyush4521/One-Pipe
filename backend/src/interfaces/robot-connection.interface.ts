/**
 * Robot Hardware Connection State Contract
 * Strictly separated from inspection session lifecycle.
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.1, 9, 10
 */

export type RobotConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RobotConnectionSnapshot {
  state: RobotConnectionState;
  lastHeartbeat: string | null; // ISO 8601
  ipAddress: string | null;
  reconnectAttempts: number;
  errorMessage?: string;
}

