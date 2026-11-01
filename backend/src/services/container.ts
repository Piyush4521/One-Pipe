/**
 * Service & Repository Dependency Container
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1, 16.4
 *
 * Configures application-wide singleton repositories and domain services.
 * Wires concrete MongoDB repositories in persistent database mode (STORAGE_DRIVER === 'mongodb').
 * In-memory repositories are strictly isolated to explicit non-production testbed mode (STORAGE_DRIVER === 'memory').
 * In-memory fallback is strictly forbidden in production environment.
 */

import { env } from '../config/env';
import {
  DefectFilter,
  DefectRecord,
  DefectStats,
  UpdateDefectReviewDTO,
} from '../interfaces/defect.interface';
import {
  CreateInspectionDTO,
  InspectionFilter,
  InspectionLifecycleState,
  InspectionRecord,
  UpdateInspectionDTO,
} from '../interfaces/inspection.interface';
import { PaginatedResult } from '../interfaces/pagination.interface';
import { ReportRecord } from '../interfaces/report.interface';
import {
  IDefectRepository,
  IInspectionRepository,
  IReportRepository,
  ISystemEventRepository,
  ITelemetryRepository,
} from '../interfaces/repositories';
import {
  CreateSystemEventDTO,
  SystemEventFilter,
  SystemEventRecord,
} from '../interfaces/system-event.interface';
import {
  BatchIngestResult,
  PersistedTelemetryRecord,
  TelemetryFilter,
  TelemetrySampleDTO,
  TelemetrySessionSummary,
} from '../interfaces/telemetry.interface';
import { MemoryDefectRepository } from '../repositories/memory/memory-defect.repository';
import { MemoryInspectionRepository } from '../repositories/memory/memory-inspection.repository';
import { MemoryReportRepository } from '../repositories/memory/memory-report.repository';
import { MemorySystemEventRepository } from '../repositories/memory/memory-system-event.repository';
import { MemoryTelemetryRepository } from '../repositories/memory/memory-telemetry.repository';
import {
  MongoDefectRepository,
  MongoInspectionRepository,
  MongoReportRepository,
  MongoSystemEventRepository,
  MongoTelemetryRepository,
} from '../repositories/mongo';
import { AuditLogService } from './audit-log.service';
import { BackupService } from './backup.service';
import { DefectService } from './defect.service';
import { EvidenceStorageService } from './evidence-storage.service';
import { InspectionService } from './inspection.service';
import { ReportStorageService } from './report-storage.service';
import { ReportService } from './report.service';
import { TelemetryService } from './telemetry.service';

export interface RepositoryContainer {
  inspectionRepository: IInspectionRepository;
  defectRepository: IDefectRepository;
  reportRepository: IReportRepository;
  telemetryRepository: ITelemetryRepository;
  systemEventRepository: ISystemEventRepository;
}

/**
 * Builds the concrete repository set for the specified driver.
 */
export function buildRepositories(
  driver: 'mongodb' | 'memory' = env.STORAGE_DRIVER
): RepositoryContainer {
  if (driver === 'mongodb') {
    return {
      inspectionRepository: new MongoInspectionRepository(),
      defectRepository: new MongoDefectRepository(),
      reportRepository: new MongoReportRepository(),
      telemetryRepository: new MongoTelemetryRepository(),
      systemEventRepository: new MongoSystemEventRepository(),
    };
  }

  // Explicit testbed-only in-memory repositories
  return {
    inspectionRepository: new MemoryInspectionRepository(),
    defectRepository: new MemoryDefectRepository(),
    reportRepository: new MemoryReportRepository(),
    telemetryRepository: new MemoryTelemetryRepository(),
    systemEventRepository: new MemorySystemEventRepository(),
  };
}

let currentDriver: 'mongodb' | 'memory' = env.STORAGE_DRIVER;
let activeRepos: RepositoryContainer = buildRepositories(currentDriver);

// Delegating repository instances preserving singleton interfaces and test helpers
export const inspectionRepository: IInspectionRepository & { clear?: () => void } = {
  findById: (id: string): Promise<InspectionRecord | null> =>
    activeRepos.inspectionRepository.findById(id),
  findMany: (filter?: InspectionFilter): Promise<PaginatedResult<InspectionRecord>> =>
    activeRepos.inspectionRepository.findMany(filter),
  create: (data: CreateInspectionDTO): Promise<InspectionRecord> =>
    activeRepos.inspectionRepository.create(data),
  update: (id: string, data: UpdateInspectionDTO): Promise<InspectionRecord | null> =>
    activeRepos.inspectionRepository.update(id, data),
  updateStatus: (id: string, status: InspectionLifecycleState): Promise<InspectionRecord | null> =>
    activeRepos.inspectionRepository.updateStatus(id, status),
  clear: (): void => {
    (activeRepos.inspectionRepository as any).clear?.();
  },
};

export const defectRepository: IDefectRepository & { clear?: () => void } = {
  findById: (id: string): Promise<DefectRecord | null> =>
    activeRepos.defectRepository.findById(id),
  findMany: (filter?: DefectFilter): Promise<PaginatedResult<DefectRecord>> =>
    activeRepos.defectRepository.findMany(filter),
  create: (data: Omit<DefectRecord, 'id'>): Promise<DefectRecord> =>
    activeRepos.defectRepository.create(data),
  updateReview: (id: string, data: UpdateDefectReviewDTO): Promise<DefectRecord | null> =>
    activeRepos.defectRepository.updateReview(id, data),
  updateEvidenceMetadata: (
    id: string,
    metadata: {
      evidenceImagePath: string;
      evidenceFileSizeBytes: number;
      evidenceSha256: string;
      evidenceMimeType: string;
    }
  ): Promise<DefectRecord | null> =>
    activeRepos.defectRepository.updateEvidenceMetadata(id, metadata),
  getStats: (): Promise<DefectStats> =>
    activeRepos.defectRepository.getStats(),
  clear: (): void => {
    (activeRepos.defectRepository as any).clear?.();
  },
};

export const reportRepository: IReportRepository & { clear?: () => void } = {
  findById: (id: string): Promise<ReportRecord | null> =>
    activeRepos.reportRepository.findById(id),
  findByInspectionId: (inspectionId: string): Promise<ReportRecord | null> =>
    activeRepos.reportRepository.findByInspectionId(inspectionId),
  findMany: (): Promise<ReportRecord[]> =>
    activeRepos.reportRepository.findMany(),
  create: (data: Omit<ReportRecord, 'id'>): Promise<ReportRecord> =>
    activeRepos.reportRepository.create(data),
  update: (id: string, data: Partial<ReportRecord>): Promise<ReportRecord | null> =>
    activeRepos.reportRepository.update(id, data),
  clear: (): void => {
    (activeRepos.reportRepository as any).clear?.();
  },
};

export const telemetryRepository: ITelemetryRepository & { clear?: () => void } = {
  create: (sample: TelemetrySampleDTO): Promise<PersistedTelemetryRecord> =>
    activeRepos.telemetryRepository.create(sample),
  createBatch: (samples: TelemetrySampleDTO[]): Promise<BatchIngestResult> =>
    activeRepos.telemetryRepository.createBatch(samples),
  findByInspectionId: (
    inspectionId: string,
    filter?: TelemetryFilter
  ): Promise<PaginatedResult<PersistedTelemetryRecord>> =>
    activeRepos.telemetryRepository.findByInspectionId(inspectionId, filter),
  findLatestByInspectionId: (inspectionId: string): Promise<PersistedTelemetryRecord | null> =>
    activeRepos.telemetryRepository.findLatestByInspectionId(inspectionId),
  getSummary: (inspectionId: string): Promise<TelemetrySessionSummary | null> =>
    activeRepos.telemetryRepository.getSummary(inspectionId),
  clear: (): void => {
    (activeRepos.telemetryRepository as any).clear?.();
  },
};

export const systemEventRepository: ISystemEventRepository & { clear?: () => void } = {
  create: (data: CreateSystemEventDTO): Promise<SystemEventRecord> =>
    activeRepos.systemEventRepository.create(data),
  findMany: (filter?: SystemEventFilter): Promise<PaginatedResult<SystemEventRecord>> =>
    activeRepos.systemEventRepository.findMany(filter),
  clear: (): void => {
    (activeRepos.systemEventRepository as any).clear?.();
  },
};

// Domain Services Singletons
export let auditLogService = new AuditLogService(systemEventRepository);
export let evidenceStorageService = new EvidenceStorageService();
export let reportStorageService = new ReportStorageService();
export let backupService = new BackupService(auditLogService);
export let inspectionService = new InspectionService(
  inspectionRepository,
  backupService,
  auditLogService
);
export let defectService = new DefectService(defectRepository);
export let reportService = new ReportService(reportRepository, inspectionRepository);
export let telemetryService = new TelemetryService(telemetryRepository, inspectionRepository);

/**
 * Returns the currently active storage driver.
 */
export function getActiveStorageDriver(): 'mongodb' | 'memory' {
  return currentDriver;
}

/**
 * Explicit test helper for switching drivers in isolated non-production unit tests.
 * In-memory driver is strictly rejected in production environment.
 */
export function setStorageDriverForTesting(driver: 'mongodb' | 'memory'): void {
  if (
    (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') &&
    driver === 'memory'
  ) {
    throw new Error(
      "SECURITY VIOLATION: In-memory storage driver is strictly forbidden in production environment."
    );
  }
  currentDriver = driver;
  activeRepos = buildRepositories(driver);
  auditLogService = new AuditLogService(systemEventRepository);
  backupService = new BackupService(auditLogService);
  inspectionService = new InspectionService(
    inspectionRepository,
    backupService,
    auditLogService
  );
  defectService = new DefectService(defectRepository);
  reportService = new ReportService(reportRepository, inspectionRepository);
  telemetryService = new TelemetryService(telemetryRepository, inspectionRepository);
}
