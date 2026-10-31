/**
 * Report Metadata Domain Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 17
 *
 * NOTE: PDF document generation and file storage are NOT implemented in Stage 2.
 * This service handles metadata request validation and tracking only.
 * No fabricated PDF path, distance, defect count, or file size is returned.
 */

import { ReportRecord } from '../interfaces/report.interface';
import { IInspectionRepository, IReportRepository } from '../interfaces/repositories';
import { AppError } from '../middleware/error.middleware';

export class ReportService {
  constructor(
    private readonly reportRepo: IReportRepository,
    private readonly inspectionRepo: IInspectionRepository
  ) {}

  public async listReports(): Promise<ReportRecord[]> {
    return this.reportRepo.findMany();
  }

  public async getReportById(id: string): Promise<ReportRecord> {
    const report = await this.reportRepo.findById(id);
    if (!report) {
      const err: AppError = new Error(`Report record with ID '${id}' was not found.`);
      err.statusCode = 404;
      err.code = 'REPORT_NOT_FOUND';
      throw err;
    }
    return report;
  }

  public async requestReport(inspectionId: string): Promise<ReportRecord> {
    const inspection = await this.inspectionRepo.findById(inspectionId);
    if (!inspection) {
      const err: AppError = new Error(
        `Referenced inspection session '${inspectionId}' was not found.`
      );
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    if (inspection.status !== 'completed') {
      const err: AppError = new Error(
        `Cannot request report: Inspection session '${inspectionId}' is in '${inspection.status}' state. Reports can only be generated for 'completed' inspections.`
      );
      err.statusCode = 409;
      err.code = 'INSPECTION_NOT_COMPLETED';
      throw err;
    }

    // Check if report request already exists for this inspection
    const existing = await this.reportRepo.findByInspectionId(inspectionId);
    if (existing) {
      return existing;
    }

    // Create truthful pending report metadata record without fabricating PDF existence or metrics
    const newReport = await this.reportRepo.create({
      inspectionId,
      status: 'pending',
      compiledTimestamp: null,
      fileSizeBytes: null,
      totalDistanceMeters: null,
      defectCount: null,
      pdfRelativePath: null,
      backupVerified: false,
      note: 'Report request registered in pending state. PDF compilation engine and filesystem storage are scheduled for Stage 3 / Stage 11.',
    });

    return newReport;
  }
}
