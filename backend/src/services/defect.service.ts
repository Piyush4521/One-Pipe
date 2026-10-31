/**
 * Defect Evidence Domain Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.2
 */

import {
  DefectFilter,
  DefectRecord,
  UpdateDefectReviewDTO,
} from '../interfaces/defect.interface';
import { PaginatedResult } from '../interfaces/pagination.interface';
import { IDefectRepository } from '../interfaces/repositories';
import { AppError } from '../middleware/error.middleware';

export class DefectService {
  constructor(private readonly repository: IDefectRepository) {}

  public async getDefectById(id: string): Promise<DefectRecord> {
    const defect = await this.repository.findById(id);
    if (!defect) {
      const err: AppError = new Error(`Defect record with ID '${id}' was not found.`);
      err.statusCode = 404;
      err.code = 'DEFECT_NOT_FOUND';
      throw err;
    }
    return defect;
  }

  public async listDefects(filter: DefectFilter): Promise<PaginatedResult<DefectRecord>> {
    return this.repository.findMany(filter);
  }

  public async updateReview(id: string, data: UpdateDefectReviewDTO): Promise<DefectRecord> {
    const updated = await this.repository.updateReview(id, data);
    if (!updated) {
      const err: AppError = new Error(`Defect record with ID '${id}' was not found.`);
      err.statusCode = 404;
      err.code = 'DEFECT_NOT_FOUND';
      throw err;
    }
    return updated;
  }
}

