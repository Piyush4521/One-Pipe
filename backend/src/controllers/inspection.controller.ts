/**
 * Inspection Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2
 */

import { NextFunction, Request, Response } from 'express';
import { inspectionService } from '../services/container';
import { sendSuccess } from '../utils/response';
import { eventBroadcaster } from '../websocket/ws-broadcaster';

export class InspectionController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await inspectionService.createInspection(req.body);
      eventBroadcaster.broadcastInspectionStatus({
        inspectionId: inspection.id,
        status: inspection.status,
        conduitName: inspection.conduitName,
        totalDistanceMeters: inspection.totalDistanceMeters,
        defectCount: inspection.defectCount,
        timestamp: new Date().toISOString(),
      });
      sendSuccess(res, inspection, 201);
    } catch (err) {
      next(err);
    }
  }

  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await inspectionService.listInspections(req.query as any);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await inspectionService.getInspectionById(req.params.id as string);
      sendSuccess(res, inspection, 200);
    } catch (err) {
      next(err);
    }
  }

  public async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await inspectionService.startInspection(
        req.params.id as string,
        req.body?.operatorNotes
      );
      eventBroadcaster.broadcastInspectionStatus({
        inspectionId: inspection.id,
        status: inspection.status,
        conduitName: inspection.conduitName,
        totalDistanceMeters: inspection.totalDistanceMeters,
        defectCount: inspection.defectCount,
        timestamp: new Date().toISOString(),
      });
      sendSuccess(res, inspection, 200);
    } catch (err) {
      next(err);
    }
  }

  public async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await inspectionService.pauseInspection(
        req.params.id as string,
        req.body?.operatorNotes
      );
      eventBroadcaster.broadcastInspectionStatus({
        inspectionId: inspection.id,
        status: inspection.status,
        conduitName: inspection.conduitName,
        totalDistanceMeters: inspection.totalDistanceMeters,
        defectCount: inspection.defectCount,
        timestamp: new Date().toISOString(),
      });
      sendSuccess(res, inspection, 200);
    } catch (err) {
      next(err);
    }
  }

  public async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await inspectionService.resumeInspection(
        req.params.id as string,
        req.body?.operatorNotes
      );
      eventBroadcaster.broadcastInspectionStatus({
        inspectionId: inspection.id,
        status: inspection.status,
        conduitName: inspection.conduitName,
        totalDistanceMeters: inspection.totalDistanceMeters,
        defectCount: inspection.defectCount,
        timestamp: new Date().toISOString(),
      });
      sendSuccess(res, inspection, 200);
    } catch (err) {
      next(err);
    }
  }

  public async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await inspectionService.completeInspection(
        req.params.id as string,
        req.body?.operatorNotes
      );
      eventBroadcaster.broadcastInspectionStatus({
        inspectionId: inspection.id,
        status: inspection.status,
        conduitName: inspection.conduitName,
        totalDistanceMeters: inspection.totalDistanceMeters,
        defectCount: inspection.defectCount,
        timestamp: new Date().toISOString(),
      });
      sendSuccess(res, inspection, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const inspectionController = new InspectionController();

