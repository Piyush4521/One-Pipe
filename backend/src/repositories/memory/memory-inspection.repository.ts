/**
 * TEST-ONLY In-Memory Inspection Repository
 * NOTE: For Stage 2 automated testing and verification only.
 * Resets on process restart. NOT persistent storage (Stage 3).
 */

import { randomUUID } from 'crypto';
import {
  CreateInspectionDTO,
  InspectionFilter,
  InspectionLifecycleState,
  InspectionRecord,
  UpdateInspectionDTO,
} from '../../interfaces/inspection.interface';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { IInspectionRepository } from '../../interfaces/repositories';

export class MemoryInspectionRepository implements IInspectionRepository {
  private records: Map<string, InspectionRecord> = new Map();

  public async findById(id: string): Promise<InspectionRecord | null> {
    return this.records.get(id) || null;
  }

  public async findMany(filter: InspectionFilter = {}): Promise<PaginatedResult<InspectionRecord>> {
    let items = Array.from(this.records.values());

    if (filter.status) {
      items = items.filter((item) => item.status === filter.status);
    }
    if (filter.startDate) {
      items = items.filter((item) => item.startTimestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      items = items.filter((item) => item.startTimestamp <= filter.endDate!);
    }

    // Default newest first
    items.sort((a, b) => b.startTimestamp.localeCompare(a.startTimestamp));

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

  public async create(data: CreateInspectionDTO): Promise<InspectionRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const record: InspectionRecord = {
      id,
      conduitName: data.conduitName,
      operatorNotes: data.operatorNotes,
      startTimestamp: now,
      totalDistanceMeters: 0,
      defectCount: 0,
      status: 'ready',
      reportGenerated: false,
      backupVerified: false,
    };

    this.records.set(id, record);
    return record;
  }

  public async update(id: string, data: UpdateInspectionDTO): Promise<InspectionRecord | null> {
    const existing = this.records.get(id);
    if (!existing) {
      return null;
    }

    const updated: InspectionRecord = {
      ...existing,
      ...data,
    };

    this.records.set(id, updated);
    return updated;
  }

  public async updateStatus(id: string, status: InspectionLifecycleState): Promise<InspectionRecord | null> {
    const existing = this.records.get(id);
    if (!existing) {
      return null;
    }

    const updated: InspectionRecord = {
      ...existing,
      status,
    };

    this.records.set(id, updated);
    return updated;
  }

  /**
   * Test helper to clear state between tests.
   */
  public clear(): void {
    this.records.clear();
  }
}

