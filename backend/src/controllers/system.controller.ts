/**
 * System Health Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.2
 */

import { Request, Response } from 'express';
import { mongoConnectionManager } from '../database/mongo-connection';
import { healthService } from '../services/health.service';
import { sendSuccess } from '../utils/response';

export class SystemController {
  /**
   * GET /healthz
   * Returns process liveness. Does NOT indicate hardware or database readiness.
   */
  public getHealthz(_req: Request, res: Response): void {
    const data = healthService.getHealthzData();
    sendSuccess(res, data, 200);
  }

  /**
   * GET /readyz
   * Returns application readiness probe. Distinguishes liveness from database readiness.
   * Returns 200 when ready, 503 when persistent storage is unavailable.
   */
  public getReadyz(_req: Request, res: Response): void {
    const data = healthService.getReadyzData();
    const statusCode = data.status === 'ready' ? 200 : 503;
    sendSuccess(res, data, statusCode);
  }

  /**
   * GET /api/system/status
   * Returns honest subsystem health status, database ping RTT, and initialization diagnostics.
   */
  public async getSystemStatus(_req: Request, res: Response): Promise<void> {
    const data = healthService.getSystemStatusData();
    const pingMs = await mongoConnectionManager.ping();
    data.subsystems.databasePingMs = pingMs;
    sendSuccess(res, data, 200);
  }
}

export const systemController = new SystemController();
