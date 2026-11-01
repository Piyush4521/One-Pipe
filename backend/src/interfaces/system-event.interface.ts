/**
 * System Event & Audit Log Domain Contracts
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.4
 */

import {
  SystemEventCategory,
  SystemEventSeverity,
} from '../models/system-event.model';
import { PaginationParams } from './pagination.interface';

export interface SystemEventRecord {
  id: string;
  category: SystemEventCategory;
  subsystem: string | null;
  severity: SystemEventSeverity;
  timestamp: string; // ISO 8601
  message: string;
  inspectionId: string | null;
  correlationId: string | null;
  details: Record<string, unknown> | null;
  physicalStopConfirmed: boolean; // Software E-stop cannot confirm physical cutoff
  createdAt?: string;
}

export interface CreateSystemEventDTO {
  eventId?: string;
  category: SystemEventCategory;
  subsystem?: string | null;
  severity?: SystemEventSeverity;
  timestamp?: string | Date;
  message: string;
  inspectionId?: string | null;
  correlationId?: string | null;
  details?: Record<string, unknown> | null;
  physicalStopConfirmed?: boolean;
}

export interface SystemEventFilter extends PaginationParams {
  category?: SystemEventCategory;
  severity?: SystemEventSeverity;
  inspectionId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
}

