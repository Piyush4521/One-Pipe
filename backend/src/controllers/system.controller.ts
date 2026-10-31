/**
 * System Health Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.2
 */

import { Request, Response } from 'express';
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
   * GET /api/system/status
   * Returns honest subsystem health status and initialization diagnostics.
   */
  public getSystemStatus(_req: Request, res: Response): void {
    const data = healthService.getSystemStatusData();
    sendSuccess(res, data, 200);
  }
}

export const systemController = new SystemController();

