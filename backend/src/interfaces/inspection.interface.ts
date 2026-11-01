/**
 * Inspection Domain Models & DTO Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2, 16.4
 *
 * NOTE: Inspection lifecycle state is strictly decoupled from robot connection state.
 */

import { PaginationParams } from './pagination.interface';

/**
 * Canonical Inspection Lifecycle State
 * Strictly models the inspection session state.
 * Does NOT contain robot connection states (e.g. 'disconnected').
 */
export type InspectionLifecycleState =
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'recovery_required';

export interface InspectionRecord {
  id: string;
  conduitName?: string;
  startTimestamp: string; // ISO 8601
  endTimestamp?: string;   // ISO 8601
  durationSeconds?: number;
  totalDistanceMeters: number | null; // null when odometry is uncalibrated/unmeasured
  defectCount: number;
  status: InspectionLifecycleState;
  reportGenerated: boolean;
  backupVerified: boolean;
  backupStatus?: 'not_started' | 'pending' | 'running' | 'completed' | 'failed';
  backupId?: string | null;
  backupError?: string | null;
  operatorNotes?: string;
}

export interface CreateInspectionDTO {
  conduitName?: string;
  operatorNotes?: string;
}

export interface UpdateInspectionDTO {
  conduitName?: string;
  operatorNotes?: string;
  totalDistanceMeters?: number | null;
  defectCount?: number;
  endTimestamp?: string;
  durationSeconds?: number;
  reportGenerated?: boolean;
  backupVerified?: boolean;
  backupStatus?: 'not_started' | 'pending' | 'running' | 'completed' | 'failed';
  backupId?: string | null;
  backupError?: string | null;
}

export interface InspectionFilter extends PaginationParams {
  status?: InspectionLifecycleState;
  startDate?: string;
  endDate?: string;
}
