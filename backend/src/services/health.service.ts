/**
 * System Health & Diagnostics Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.2
 */

import { ACTIVE_STORAGE_DRIVER, APP_VERSION } from '../config/constants';
import { env } from '../config/env';
import { HealthzData, SystemStatusData } from '../interfaces/system-status.interface';

export class HealthService {
  /**
   * Evaluates Node.js backend process liveness.
   * NOTE: This indicates process liveness only, NOT subsystem or robot readiness.
   */
  public getHealthzData(): HealthzData {
    return {
      status: 'alive',
      uptimeSeconds: Math.floor(process.uptime() * 100) / 100,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      environment: env.NODE_ENV,
    };
  }

  /**
   * Returns honest status placeholders for all PipeBot subsystems.
   * Subsystem communication has not been initialized in Stage 2 (Backend Scaffolding).
   */
  public getSystemStatusData(): SystemStatusData {
    const timestamp = new Date().toISOString();

    return {
      process: 'alive',
      uptimeSeconds: Math.floor(process.uptime() * 100) / 100,
      subsystems: {
        esp32: 'offline',
        camera: 'offline',
        aiEngine: 'offline',
        database: 'offline',
        gpuDeviceName: null,
        isGpuAvailable: false,
        lastChecked: timestamp,
      },
      storage: {
        driver: ACTIVE_STORAGE_DRIVER,
        isPersistent: false,
        limitation:
          'Data is stored exclusively in process memory and resets on server restart. Persistent local MongoDB integration is scheduled for Stage 3.',
      },
      details: {
        esp32: 'Hardware communication not initialized (Stage 5)',
        camera: 'Camera stream receiver not initialized (Stage 5)',
        aiEngine: 'Inference engine not initialized (Stage 4)',
        database: 'Local MongoDB integration not configured (Stage 3). Volatile in-memory testbed is active.',
        gpu: 'GPU detection is not performed by Node.js backend (managed by Python inference service in Stage 4)',
      },
    };
  }
}

export const healthService = new HealthService();
