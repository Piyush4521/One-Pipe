/**
 * Audit Log & System Event Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.1, 16.4
 *
 * Provides centralized audit and diagnostic event recording.
 * CRITICAL SAFETY & SECURITY CONSTRAINTS:
 * 1. Software emergency stop requests MUST ALWAYS have physicalStopConfirmed: false.
 *    Software acknowledgement never certifies physical motor circuit interruption.
 * 2. Sensitive authentication tokens, passwords, and connection credentials are redacted.
 * 3. High-volume sensor telemetry samples are NEVER routed into system audit events.
 * 4. Non-recursive error handling: Audit logging failures are caught and logged to prevent
 *    crashing operational request pipelines.
 */

import { PaginatedResult } from '../interfaces/pagination.interface';
import { ISystemEventRepository } from '../interfaces/repositories';
import {
  CreateSystemEventDTO,
  SystemEventFilter,
  SystemEventRecord,
} from '../interfaces/system-event.interface';
import {
  SystemEventCategory,
  SystemEventSeverity,
} from '../models/system-event.model';
import { logger } from '../utils/logger';

export interface AuditLogResult {
  record: SystemEventRecord | null;
  auditPersisted: boolean;
  isCritical: boolean;
  error?: string;
  id?: string;
  category?: SystemEventCategory;
  subsystem?: string | null;
  severity?: SystemEventSeverity;
  timestamp?: string;
  message?: string;
  physicalStopConfirmed?: boolean;
  details?: Record<string, unknown> | null;
}

export class AuditPersistenceError extends Error {
  public readonly statusCode = 500;
  public readonly code = 'AUDIT_PERSISTENCE_FAILED';
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'AuditPersistenceError';
  }
}

/**
 * Classifies whether an event is critical or an ordinary diagnostic event.
 */
export function isCriticalEvent(
  category: SystemEventCategory,
  severity?: SystemEventSeverity
): boolean {
  if (severity === 'critical') return true;
  return (
    category === 'emergency_stop_request' ||
    category === 'inspection_lifecycle' ||
    category === 'backup' ||
    category === 'storage'
  );
}

const SENSITIVE_KEYS = new Set([
  'token',
  'operatortoken',
  'operator_token',
  'password',
  'secret',
  'authorization',
  'bearer',
  'uri',
  'mongodb_uri',
]);

/**
 * Deep redaction helper for event details objects.
 */
export function sanitizeEventDetails(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact MongoDB connection strings with credentials: mongodb://user:pass@host
    return obj.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1***$3');
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeEventDetails(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeEventDetails(val);
      }
    }
    return sanitized;
  }

  return obj;
}

export class AuditLogService {
  constructor(private readonly eventRepo: ISystemEventRepository) {}

  public async logEvent(dto: CreateSystemEventDTO): Promise<SystemEventRecord | null> {
    const critical = isCriticalEvent(dto.category, dto.severity);
    if (critical) {
      const res = await this.logCriticalEvent(dto);
      return res.record;
    }
    return this.logDiagnosticEvent(dto);
  }

  /**
   * Logs a critical audit event.
   * If persistence fails, records the failure non-recursively and returns auditPersisted: false
   * so callers do not report an un-persisted operation as audited.
   */
  public async logCriticalEvent(dto: CreateSystemEventDTO): Promise<AuditLogResult> {
    const sanitizedDetails = dto.details
      ? (sanitizeEventDetails(dto.details) as Record<string, unknown>)
      : null;

    const physicalStopConfirmed =
      dto.category === 'emergency_stop_request' ? false : (dto.physicalStopConfirmed ?? false);

    try {
      const record = await this.eventRepo.create({
        ...dto,
        details: sanitizedDetails,
        physicalStopConfirmed,
      });

      return {
        ...record,
        record,
        auditPersisted: true,
        isCritical: true,
      };
    } catch (err: any) {
      // Non-recursive error logging: log directly to Pino logger, never recurse
      logger.error('Failed to persist critical audit log event', {
        category: dto.category,
        subsystem: dto.subsystem,
        error: err.message,
      });

      return {
        record: null,
        auditPersisted: false,
        isCritical: true,
        error: err.message,
      };
    }
  }

  /**
   * Logs an ordinary diagnostic event using best-effort delivery.
   * Failures are recorded in logger without failing operational flows.
   */
  public async logDiagnosticEvent(dto: CreateSystemEventDTO): Promise<SystemEventRecord | null> {
    try {
      const sanitizedDetails = dto.details
        ? (sanitizeEventDetails(dto.details) as Record<string, unknown>)
        : null;

      const physicalStopConfirmed =
        dto.category === 'emergency_stop_request' ? false : (dto.physicalStopConfirmed ?? false);

      return await this.eventRepo.create({
        ...dto,
        details: sanitizedDetails,
        physicalStopConfirmed,
      });
    } catch (err: any) {
      logger.warn('Failed to persist ordinary diagnostic event (best-effort)', {
        category: dto.category,
        error: err.message,
      });
      return null;
    }
  }

  public async logEmergencyStop(
    requestedBy: string,
    details?: Record<string, unknown>
  ): Promise<AuditLogResult> {
    return this.logCriticalEvent({
      category: 'emergency_stop_request',
      severity: 'critical',
      subsystem: 'motor_control',
      message: `Emergency stop requested by '${requestedBy}'. Software halt issued.`,
      physicalStopConfirmed: false, // Mandatory safety invariant
      details: {
        requestedBy,
        ...(details || {}),
      },
    });
  }

  public async logSubsystemStatus(
    subsystem: string,
    status: string,
    details?: Record<string, unknown>
  ): Promise<SystemEventRecord | null> {
    return this.logEvent({
      category: 'subsystem_status',
      severity: status === 'error' ? 'critical' : status === 'degraded' ? 'warning' : 'info',
      subsystem,
      message: `Subsystem '${subsystem}' transitioned to status '${status}'.`,
      details,
    });
  }

  public async logSecurityAlert(
    message: string,
    details?: Record<string, unknown>
  ): Promise<SystemEventRecord | null> {
    return this.logEvent({
      category: 'security_alert',
      severity: 'warning',
      subsystem: 'security',
      message,
      details,
    });
  }

  public async getEvents(
    filter: SystemEventFilter = {}
  ): Promise<PaginatedResult<SystemEventRecord>> {
    return this.eventRepo.findMany(filter);
  }
}

