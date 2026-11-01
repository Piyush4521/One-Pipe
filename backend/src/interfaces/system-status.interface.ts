/**
 * System Status & Health Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.2
 * Aligned with frontend SystemStatusSnapshot in frontend/src/types/inspection.ts
 */

export type SubsystemStatus = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface SubsystemStatusSnapshot {
  esp32: SubsystemStatus;
  camera: SubsystemStatus;
  aiEngine: SubsystemStatus;
  database: SubsystemStatus;
  databasePingMs?: number | null;
  gpuDeviceName: string | null;
  isGpuAvailable: boolean;
  lastChecked: string;
}

export interface StorageEngineInfo {
  driver: string;
  isPersistent: boolean;
  limitation: string;
  storageRoot?: string;
}

export interface SubsystemDetails {
  esp32: string;
  camera: string;
  aiEngine: string;
  database: string;
  gpu: string;
}

export interface SystemStatusData {
  process: 'alive' | 'degraded';
  uptimeSeconds: number;
  subsystems: SubsystemStatusSnapshot;
  storage: StorageEngineInfo;
  details: SubsystemDetails;
}

export interface HealthzData {
  status: 'alive';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  environment: string;
}

export interface ReadyzData {
  status: 'ready' | 'not_ready';
  database: 'connected' | 'disconnected' | 'unconfigured';
  storageDriver: string;
  timestamp: string;
}
