/**
 * Robot Domain Types & Response Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.1, 10.1, 10.2
 */

export interface SoftwareEmergencyStopResponse {
  status: 'REQUEST_ACCEPTED';
  physicalStopConfirmed: false;
  timestamp: string;
  message: string;
  safetyNotice: string;
}

