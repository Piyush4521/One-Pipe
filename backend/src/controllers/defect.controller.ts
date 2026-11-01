/**
 * Defect Evidence Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.2
 */

import { NextFunction, Request, Response } from 'express';
import { defectService } from '../services/container';
import { sendSuccess } from '../utils/response';

export class DefectController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await defectService.listDefects(req.query as any);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await defectService.getStats();
      sendSuccess(res, stats, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const defect = await defectService.getDefectById(req.params.id as string);
      sendSuccess(res, defect, 200);
    } catch (err) {
      next(err);
    }
  }

  public async updateReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await defectService.updateReview(req.params.id as string, req.body);
      sendSuccess(res, updated, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const defectController = new DefectController();

