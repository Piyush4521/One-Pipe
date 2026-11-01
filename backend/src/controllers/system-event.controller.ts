/**
 * System Event & Audit Log REST Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.1
 */

import { NextFunction, Request, Response } from 'express';
import {
  SystemEventCategory,
  SystemEventSeverity,
} from '../models/system-event.model';
import { AuditLogService } from '../services/audit-log.service';

export class SystemEventController {
  constructor(private readonly auditLogService: AuditLogService) {}

  public getEvents = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const category = req.query.category as SystemEventCategory | undefined;
      const severity = req.query.severity as SystemEventSeverity | undefined;
      const inspectionId = req.query.inspectionId as string | undefined;
      const fromTimestamp = req.query.fromTimestamp as string | undefined;
      const toTimestamp = req.query.toTimestamp as string | undefined;

      const result = await this.auditLogService.getEvents({
        page,
        limit,
        category,
        severity,
        inspectionId,
        fromTimestamp,
        toTimestamp,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public recordEvent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { category, subsystem, severity, message, inspectionId, correlationId, details } =
        req.body;

      if (!category || !message) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: "Fields 'category' and 'message' are required.",
          },
        });
        return;
      }

      const record = await this.auditLogService.logEvent({
        category,
        subsystem,
        severity,
        message,
        inspectionId,
        correlationId,
        details,
      });

      res.status(201).json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  };
}

