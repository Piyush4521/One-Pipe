/**
 * Service & Repository Dependency Container
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1
 *
 * NOTE: Stage 2 testbed container. Uses test-only in-memory repositories.
 * Concrete MongoDB repositories will be integrated in Stage 3.
 */

import { MemoryDefectRepository } from '../repositories/memory/memory-defect.repository';
import { MemoryInspectionRepository } from '../repositories/memory/memory-inspection.repository';
import { MemoryReportRepository } from '../repositories/memory/memory-report.repository';
import { DefectService } from './defect.service';
import { InspectionService } from './inspection.service';
import { ReportService } from './report.service';

export const inspectionRepository = new MemoryInspectionRepository();
export const defectRepository = new MemoryDefectRepository();
export const reportRepository = new MemoryReportRepository();

export const inspectionService = new InspectionService(inspectionRepository);
export const defectService = new DefectService(defectRepository);
export const reportService = new ReportService(reportRepository, inspectionRepository);

