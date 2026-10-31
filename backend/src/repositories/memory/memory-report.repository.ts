/**
 * TEST-ONLY In-Memory Report Repository
 * NOTE: For Stage 2 automated testing and verification only.
 * Resets on process restart. NOT persistent storage (Stage 3).
 */

import { randomUUID } from 'crypto';
import { ReportRecord } from '../../interfaces/report.interface';
import { IReportRepository } from '../../interfaces/repositories';

export class MemoryReportRepository implements IReportRepository {
  private records: Map<string, ReportRecord> = new Map();

  public async findById(id: string): Promise<ReportRecord | null> {
    return this.records.get(id) || null;
  }

  public async findByInspectionId(inspectionId: string): Promise<ReportRecord | null> {
    for (const report of this.records.values()) {
      if (report.inspectionId === inspectionId) {
        return report;
      }
    }
    return null;
  }

  public async findMany(): Promise<ReportRecord[]> {
    return Array.from(this.records.values());
  }

  public async create(data: Omit<ReportRecord, 'id'>): Promise<ReportRecord> {
    const id = randomUUID();
    const record: ReportRecord = {
      ...data,
      id,
    };

    this.records.set(id, record);
    return record;
  }

  public async update(id: string, data: Partial<ReportRecord>): Promise<ReportRecord | null> {
    const existing = this.records.get(id);
    if (!existing) {
      return null;
    }

    const updated: ReportRecord = {
      ...existing,
      ...data,
    };

    this.records.set(id, updated);
    return updated;
  }

  public clear(): void {
    this.records.clear();
  }
}
