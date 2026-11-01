/**
 * TEST-ONLY In-Memory System Event Repository
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 10.2, 16.1
 * NOTE: For automated testing only. Resets on process restart.
 */

import { randomUUID } from 'crypto';
import { PaginatedResult } from '../../interfaces/pagination.interface';
import { ISystemEventRepository } from '../../interfaces/repositories';
import {
  CreateSystemEventDTO,
  SystemEventFilter,
  SystemEventRecord,
} from '../../interfaces/system-event.interface';
import { AppError } from '../../middleware/error.middleware';

export class MemorySystemEventRepository implements ISystemEventRepository {
  private records: Map<string, SystemEventRecord> = new Map();

  public async create(data: CreateSystemEventDTO): Promise<SystemEventRecord> {
    const id = data.eventId || randomUUID();
    if (this.records.has(id)) {
      const conflictErr: AppError = new Error(
        `System event with identifier '${id}' already exists.`
      );
      conflictErr.statusCode = 409;
      conflictErr.code = 'DUPLICATE_IDENTIFIER';
      throw conflictErr;
    }

    const physicalStopConfirmed =
      data.category === 'emergency_stop_request' ? false : (data.physicalStopConfirmed ?? false);

    const record: SystemEventRecord = {
      id,
      category: data.category,
      subsystem: data.subsystem ?? null,
      severity: data.severity || 'info',
      timestamp: data.timestamp
        ? new Date(data.timestamp).toISOString()
        : new Date().toISOString(),
      message: data.message,
      inspectionId: data.inspectionId ?? null,
      correlationId: data.correlationId ?? null,
      details: data.details ?? null,
      physicalStopConfirmed,
      createdAt: new Date().toISOString(),
    };

    this.records.set(id, record);
    return record;
  }

  public async findMany(
    filter: SystemEventFilter = {}
  ): Promise<PaginatedResult<SystemEventRecord>> {
    let items = Array.from(this.records.values());

    if (filter.category) {
      items = items.filter((item) => item.category === filter.category);
    }
    if (filter.severity) {
      items = items.filter((item) => item.severity === filter.severity);
    }
    if (filter.inspectionId) {
      items = items.filter((item) => item.inspectionId === filter.inspectionId);
    }
    if (filter.fromTimestamp) {
      const fromTime = new Date(filter.fromTimestamp).getTime();
      items = items.filter((item) => new Date(item.timestamp).getTime() >= fromTime);
    }
    if (filter.toTimestamp) {
      const toTime = new Date(filter.toTimestamp).getTime();
      items = items.filter((item) => new Date(item.timestamp).getTime() <= toTime);
    }

    // Sort descending by timestamp
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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

  public clear(): void {
    this.records.clear();
  }
}

