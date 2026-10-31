/**
 * Data Access Repository Interfaces
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1, 16.4
 * Abstract repository contracts decoupling domain services from underlying storage engine (Stage 3).
 */

import { DefectFilter, DefectRecord, UpdateDefectReviewDTO } from './defect.interface';
import {
  CreateInspectionDTO,
  InspectionFilter,
  InspectionLifecycleState,
  InspectionRecord,
  UpdateInspectionDTO,
} from './inspection.interface';
import { PaginatedResult } from './pagination.interface';
import { ReportRecord } from './report.interface';

export interface IInspectionRepository {
  findById(id: string): Promise<InspectionRecord | null>;
  findMany(filter?: InspectionFilter): Promise<PaginatedResult<InspectionRecord>>;
  create(data: CreateInspectionDTO): Promise<InspectionRecord>;
  update(id: string, data: UpdateInspectionDTO): Promise<InspectionRecord | null>;
  updateStatus(id: string, status: InspectionLifecycleState): Promise<InspectionRecord | null>;
}

export interface IDefectRepository {
  findById(id: string): Promise<DefectRecord | null>;
  findMany(filter?: DefectFilter): Promise<PaginatedResult<DefectRecord>>;
  create(data: Omit<DefectRecord, 'id'>): Promise<DefectRecord>;
  updateReview(id: string, data: UpdateDefectReviewDTO): Promise<DefectRecord | null>;
}

export interface IReportRepository {
  findById(id: string): Promise<ReportRecord | null>;
  findByInspectionId(inspectionId: string): Promise<ReportRecord | null>;
  findMany(): Promise<ReportRecord[]>;
  create(data: Omit<ReportRecord, 'id'>): Promise<ReportRecord>;
  update(id: string, data: Partial<ReportRecord>): Promise<ReportRecord | null>;
}
