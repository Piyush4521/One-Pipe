/**
 * Robot State & Safety Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.1, 10.1, 10.2
 */

import { Request, Response } from 'express';
import { robotService } from '../services/robot.service';
import { sendSuccess } from '../utils/response';
import { eventBroadcaster } from '../websocket/ws-broadcaster';

export class RobotController {
  /**
   * GET /api/robot/status
   * Returns truthful hardware connection state.
   */
  public getStatus(_req: Request, res: Response): void {
    const data = robotService.getRobotStatus();
    sendSuccess(res, data, 200);
  }

  /**
   * POST /api/robot/emergency-stop
   * Auxiliary software emergency stop request handler.
   */
  public emergencyStop(_req: Request, res: Response): void {
    const data = robotService.processSoftwareEmergencyStop();
    eventBroadcaster.broadcastEmergencyStopAck(data);
    sendSuccess(res, data, 200);
  }
}

export const robotController = new RobotController();

