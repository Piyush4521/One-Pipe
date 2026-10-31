/**
 * Inspection Management Domain Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2
 */

import {
  CreateInspectionDTO,
  InspectionFilter,
  InspectionRecord,
} from '../interfaces/inspection.interface';
import { PaginatedResult } from '../interfaces/pagination.interface';
import { IInspectionRepository } from '../interfaces/repositories';
import { AppError } from '../middleware/error.middleware';
import { InspectionLifecycleService } from './inspection-lifecycle.service';

export class InspectionService {
  private readonly lifecycleService: InspectionLifecycleService;

  constructor(private readonly repository: IInspectionRepository) {
    this.lifecycleService = new InspectionLifecycleService(repository);
  }

  public async createInspection(data: CreateInspectionDTO): Promise<InspectionRecord> {
    return this.repository.create(data);
  }

  public async getInspectionById(id: string): Promise<InspectionRecord> {
    const inspection = await this.repository.findById(id);
    if (!inspection) {
      const err: AppError = new Error(`Inspection session with ID '${id}' was not found.`);
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }
    return inspection;
  }

  public async listInspections(filter: InspectionFilter): Promise<PaginatedResult<InspectionRecord>> {
    return this.repository.findMany(filter);
  }

  public async startInspection(id: string, operatorNotes?: string): Promise<InspectionRecord> {
    return this.lifecycleService.transition(id, 'running', operatorNotes);
  }

  public async pauseInspection(id: string, operatorNotes?: string): Promise<InspectionRecord> {
    return this.lifecycleService.transition(id, 'paused', operatorNotes);
  }

  public async resumeInspection(id: string, operatorNotes?: string): Promise<InspectionRecord> {
    return this.lifecycleService.transition(id, 'running', operatorNotes);
  }

  public async completeInspection(id: string, operatorNotes?: string): Promise<InspectionRecord> {
    return this.lifecycleService.transition(id, 'completed', operatorNotes);
  }
}

