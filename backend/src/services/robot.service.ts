/**
 * Robot State & Safety Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.1, 10.1, 10.2
 *
 * NOTE: Strictly models truthful hardware connection state.
 * Movement commands are locked out in Stage 2 pending Stage 5.
 */

import { RobotConnectionSnapshot } from '../interfaces/robot-connection.interface';
import { SoftwareEmergencyStopResponse } from '../interfaces/robot.interface';

export { SoftwareEmergencyStopResponse };

export class RobotService {
  /**
   * Returns honest robot hardware connection status.
   * Telemetry and hardware links are NOT simulated.
   */
  public getRobotStatus(): RobotConnectionSnapshot {
    return {
      state: 'disconnected',
      lastHeartbeat: null,
      ipAddress: null,
      reconnectAttempts: 0,
      errorMessage: 'ESP32 communication not initialized (Stage 5)',
    };
  }

  /**
   * Processes an auxiliary software emergency stop request.
   * Clearly states that physical stop is NOT confirmed by software alone.
   */
  public processSoftwareEmergencyStop(): SoftwareEmergencyStopResponse {
    return {
      status: 'REQUEST_ACCEPTED',
      physicalStopConfirmed: false,
      timestamp: new Date().toISOString(),
      message: 'Software emergency stop request has been accepted and logged by the backend.',
      safetyNotice:
        'PHYSICAL STOP NOT CONFIRMED: A software stop request is an auxiliary request and does not verify motor cutoff. The dedicated physical emergency stop button on the robot chassis is the primary, independent hardware safety mechanism.',
    };
  }
}

export const robotService = new RobotService();
