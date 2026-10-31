/**
 * Report Metadata Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 17
 */

import { NextFunction, Request, Response } from 'express';
import { reportService } from '../services/container';
import { sendSuccess } from '../utils/response';

export class ReportController {
  public async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reports = await reportService.listReports();
      sendSuccess(res, reports, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await reportService.getReportById(req.params.id as string);
      sendSuccess(res, report, 200);
    } catch (err) {
      next(err);
    }
  }

  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await reportService.requestReport(req.body.inspectionId);
      sendSuccess(res, report, 201);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();

