/**
 * TEST-ONLY In-Memory Defect Repository
 * NOTE: For Stage 2 automated testing and verification only.
 * Resets on process restart. NOT persistent storage (Stage 3).
 */

import { randomUUID } from 'crypto';
import {
  DefectFilter,
  DefectRecord,
  UpdateDefectReviewDTO,
} from '../../interfaces/defect.interface';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { IDefectRepository } from '../../interfaces/repositories';

export class MemoryDefectRepository implements IDefectRepository {
  private records: Map<string, DefectRecord> = new Map();

  public async findById(id: string): Promise<DefectRecord | null> {
    return this.records.get(id) || null;
  }

  public async findMany(filter: DefectFilter = {}): Promise<PaginatedResult<DefectRecord>> {
    let items = Array.from(this.records.values());

    if (filter.inspectionId) {
      items = items.filter((item) => item.inspectionId === filter.inspectionId);
    }
    if (filter.reviewStatus) {
      items = items.filter((item) => item.reviewStatus === filter.reviewStatus);
    }
    if (filter.classId !== undefined) {
      items = items.filter((item) => item.classId === filter.classId);
    }

    // Sort by estimatedDistance ascending
    items.sort((a, b) => a.estimatedDistance - b.estimatedDistance);

    const total = items.length;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const totalPages = Math.ceil(total / limit) || 1;

    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async create(data: Omit<DefectRecord, 'id'>): Promise<DefectRecord> {
    const id = randomUUID();
    const record: DefectRecord = {
      ...data,
      id,
    };

    this.records.set(id, record);
    return record;
  }

  public async updateReview(id: string, data: UpdateDefectReviewDTO): Promise<DefectRecord | null> {
    const existing = this.records.get(id);
    if (!existing) {
      return null;
    }

    const updated: DefectRecord = {
      ...existing,
      reviewStatus: data.reviewStatus,
      ...(data.operatorNotes !== undefined ? { operatorNotes: data.operatorNotes } : {}),
    };

    this.records.set(id, updated);
    return updated;
  }

  public clear(): void {
    this.records.clear();
  }
}

