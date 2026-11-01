/**
 * System Health & Diagnostics Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.2
 */

import { APP_VERSION } from '../config/constants';
import { env } from '../config/env';
import { mongoConnectionManager } from '../database/mongo-connection';
import {
  HealthzData,
  ReadyzData,
  SubsystemStatus,
  SystemStatusData,
} from '../interfaces/system-status.interface';

export class HealthService {
  /**
   * Evaluates Node.js backend process liveness.
   * NOTE: This indicates process liveness only, NOT subsystem or database readiness.
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
   * Evaluates application readiness.
   * Distinguishes liveness from database readiness.
   */
  public getReadyzData(): ReadyzData {
    const isDbConnected = mongoConnectionManager.isConnected();
    const timestamp = new Date().toISOString();

    if (env.STORAGE_DRIVER === 'mongodb') {
      return {
        status: isDbConnected ? 'ready' : 'not_ready',
        database: isDbConnected ? 'connected' : 'disconnected',
        storageDriver: 'mongodb',
        timestamp,
      };
    }

    return {
      status: 'ready',
      database: 'unconfigured',
      storageDriver: 'memory',
      timestamp,
    };
  }

  /**
   * Returns honest status for all PipeBot subsystems and persistence driver.
   * Truthfully reports live MongoDB state when configured.
   */
  public getSystemStatusData(): SystemStatusData {
    const timestamp = new Date().toISOString();
    const isDbConnected = mongoConnectionManager.isConnected();
    const dbState = mongoConnectionManager.getConnectionState();

    let dbSubsystemStatus: SubsystemStatus = 'offline';
    if (env.STORAGE_DRIVER === 'mongodb') {
      if (dbState === 'connected') {
        dbSubsystemStatus = 'healthy';
      } else if (dbState === 'connecting') {
        dbSubsystemStatus = 'unknown';
      } else if (dbState === 'error') {
        dbSubsystemStatus = 'critical';
      } else {
        dbSubsystemStatus = 'offline';
      }
    } else {
      dbSubsystemStatus = 'offline';
    }

    const isStoragePersistent = env.STORAGE_DRIVER === 'mongodb' && isDbConnected;

    let storageLimitation = '';
    if (env.STORAGE_DRIVER === 'mongodb') {
      if (isDbConnected) {
        storageLimitation = `Persistent local MongoDB database active on 127.0.0.1:27017 (${env.MONGODB_DB_NAME}).`;
      } else {
        storageLimitation = `Persistent local MongoDB configured (${env.MONGODB_DB_NAME}) but currently disconnected. Database operations unavailable.`;
      }
    } else {
      storageLimitation =
        'Data is stored exclusively in process memory and resets on server restart. In-memory testbed is active.';
    }

    let databaseDetail = '';
    if (env.STORAGE_DRIVER === 'mongodb') {
      if (isDbConnected) {
        databaseDetail = `Connected to local MongoDB database '${env.MONGODB_DB_NAME}' on 127.0.0.1:27017.`;
      } else {
        databaseDetail = `Disconnected from local MongoDB '${env.MONGODB_DB_NAME}'. Database operations will return 503 DATABASE_UNAVAILABLE.`;
      }
    } else {
      databaseDetail = 'In-memory testbed storage active. Local MongoDB not connected.';
    }

    return {
      process: 'alive',
      uptimeSeconds: Math.floor(process.uptime() * 100) / 100,
      subsystems: {
        esp32: 'offline',
        camera: 'offline',
        aiEngine: 'offline',
        database: dbSubsystemStatus,
        databasePingMs: null,
        gpuDeviceName: null,
        isGpuAvailable: false,
        lastChecked: timestamp,
      },
      storage: {
        driver: env.STORAGE_DRIVER,
        isPersistent: isStoragePersistent,
        limitation: storageLimitation,
        storageRoot: env.STORAGE_ROOT,
      },
      details: {
        esp32: 'Hardware communication not initialized (Stage 5)',
        camera: 'Camera stream receiver not initialized (Stage 5)',
        aiEngine: 'Inference engine not initialized (Stage 4)',
        database: databaseDetail,
        gpu: 'GPU detection is not performed by Node.js backend (managed by Python inference service in Stage 4)',
      },
    };
  }
}

export const healthService = new HealthService();
