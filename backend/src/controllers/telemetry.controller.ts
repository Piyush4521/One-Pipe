/**
 * Telemetry REST API Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.1, 16.2
 */

import { NextFunction, Request, Response } from 'express';
import { TelemetryFilter } from '../interfaces/telemetry.interface';
import { TelemetryService } from '../services/telemetry.service';

export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  public ingest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const inspectionId = req.params.id as string;
      const isBatch =
        Array.isArray(req.body) ||
        (req.body && typeof req.body === 'object' && Array.isArray(req.body.samples));

      if (isBatch) {
        const result = await this.telemetryService.ingestBatch(inspectionId, req.body);
        res.status(201).json({
          success: true,
          data: result,
        });
      } else {
        const result = await this.telemetryService.ingestSample(inspectionId, req.body);
        res.status(201).json({
          success: true,
          data: result,
        });
      }
    } catch (err) {
      next(err);
    }
  };

  public getTelemetry = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const inspectionId = req.params.id as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const fromTimestamp = req.query.fromTimestamp as string | undefined;
      const toTimestamp = req.query.toTimestamp as string | undefined;

      const filter: TelemetryFilter = {
        page,
        limit,
        fromTimestamp,
        toTimestamp,
      };

      const result = await this.telemetryService.getTelemetry(inspectionId, filter);
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

  public getLatest = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const inspectionId = req.params.id as string;
      const result = await this.telemetryService.getLatestTelemetry(inspectionId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  public getSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const inspectionId = req.params.id as string;
      const result = await this.telemetryService.getTelemetrySummary(inspectionId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
