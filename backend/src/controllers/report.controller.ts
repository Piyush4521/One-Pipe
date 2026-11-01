/**
 * Report Metadata Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 17
 */

import { NextFunction, Request, Response } from 'express';
import { reportService, reportStorageService } from '../services/container';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/error.middleware';

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

  public async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await reportService.getReportById(req.params.id as string);
      if (!report.pdfRelativePath || report.status !== 'completed') {
        const err: AppError = new Error(
          `Report PDF document for '${req.params.id}' has not been compiled or is not yet available.`
        );
        err.statusCode = 404;
        err.code = 'REPORT_FILE_NOT_READY';
        throw err;
      }

      const { buffer, sha256 } = await reportStorageService.getReportFile(report.pdfRelativePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="PipeBot-Report-${report.inspectionId}.pdf"`
      );
      res.setHeader('ETag', `"${sha256}"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();

