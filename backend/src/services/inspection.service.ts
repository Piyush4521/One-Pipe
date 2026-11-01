/**
 * Inspection Management Domain Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2
 */

import { BackupManifest } from '../interfaces/backup.interface';
import {
  CreateInspectionDTO,
  InspectionFilter,
  InspectionRecord,
} from '../interfaces/inspection.interface';
import { PaginatedResult } from '../interfaces/pagination.interface';
import { IInspectionRepository } from '../interfaces/repositories';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { AuditLogService } from './audit-log.service';
import { BackupService } from './backup.service';
import { InspectionLifecycleService } from './inspection-lifecycle.service';

export class InspectionService {
  private readonly lifecycleService: InspectionLifecycleService;
  private readonly activeBackups: Set<string> = new Set();

  constructor(
    private readonly repository: IInspectionRepository,
    private readonly backupService?: BackupService,
    private readonly auditLogService?: AuditLogService
  ) {
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
    const completed = await this.lifecycleService.transition(id, 'completed', operatorNotes);

    if (this.auditLogService) {
      await this.auditLogService.logCriticalEvent({
        category: 'inspection_lifecycle',
        severity: 'info',
        subsystem: 'backend',
        message: `Inspection '${id}' transitioned to 'completed'`,
        inspectionId: id,
        details: {
          conduitName: completed.conduitName,
          defectCount: completed.defectCount,
          durationSeconds: completed.durationSeconds,
          totalDistanceMeters: completed.totalDistanceMeters,
        },
      });
    }

    // Mark backup pending and trigger asynchronous post-inspection backup
    let marked: InspectionRecord | null = null;
    if (this.backupService) {
      marked = await this.repository.update(id, { backupStatus: 'pending' });
      // Non-blocking trigger so HTTP response returns promptly
      void this.triggerPostInspectionBackup(id);
    }

    return marked || completed;
  }

  /**
   * Asynchronously triggers post-inspection backup with idempotency guard.
   */
  public async triggerPostInspectionBackup(id: string): Promise<void> {
    if (!this.backupService) {
      return;
    }

    // Duplicate trigger guard
    if (this.activeBackups.has(id)) {
      return;
    }

    const inspection = await this.repository.findById(id);
    if (!inspection || inspection.status !== 'completed') {
      return;
    }

    if (inspection.backupStatus === 'running' || inspection.backupStatus === 'completed') {
      return;
    }

    this.activeBackups.add(id);

    try {
      await this.repository.update(id, { backupStatus: 'running' });
      const manifest = await this.backupService.createBackup();

      await this.repository.update(id, {
        backupStatus: 'completed',
        backupVerified: true,
        backupId: manifest.backupId,
        backupError: null,
      });

      if (this.auditLogService) {
        await this.auditLogService.logCriticalEvent({
          category: 'backup',
          severity: 'info',
          subsystem: 'backup',
          message: `Post-inspection backup completed for inspection '${id}' (backupId: ${manifest.backupId})`,
          inspectionId: id,
          details: {
            backupId: manifest.backupId,
            totalSizeBytes: manifest.totalSizeBytes,
          },
        });
      }
    } catch (err: any) {
      logger.error('Post-inspection backup failed', { inspectionId: id, error: err.message });
      await this.repository.update(id, {
        backupStatus: 'failed',
        backupVerified: false,
        backupError: err.message,
      });

      if (this.auditLogService) {
        await this.auditLogService.logCriticalEvent({
          category: 'backup',
          severity: 'critical',
          subsystem: 'backup',
          message: `Post-inspection backup failed for inspection '${id}': ${err.message}`,
          inspectionId: id,
          details: { error: err.message },
        });
      }
    } finally {
      this.activeBackups.delete(id);
    }
  }

  /**
   * Manual operator retry for failed or pending post-inspection backups.
   */
  public async retryInspectionBackup(id: string): Promise<BackupManifest> {
    const inspection = await this.repository.findById(id);
    if (!inspection) {
      const err: AppError = new Error(`Inspection session with ID '${id}' was not found.`);
      err.statusCode = 404;
      err.code = 'INSPECTION_NOT_FOUND';
      throw err;
    }

    if (inspection.status !== 'completed') {
      const err: AppError = new Error(
        `Cannot backup inspection '${id}' with status '${inspection.status}'. Only 'completed' inspections can be backed up.`
      );
      err.statusCode = 409;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    if (!this.backupService) {
      const err: AppError = new Error('Backup service is not configured or available.');
      err.statusCode = 500;
      err.code = 'BACKUP_SERVICE_UNAVAILABLE';
      throw err;
    }

    if (this.activeBackups.has(id)) {
      const err: AppError = new Error(
        `A backup operation is already in progress for inspection '${id}'.`
      );
      err.statusCode = 409;
      err.code = 'BACKUP_ALREADY_IN_PROGRESS';
      throw err;
    }

    this.activeBackups.add(id);

    try {
      await this.repository.update(id, { backupStatus: 'running' });
      const manifest = await this.backupService.createBackup();

      await this.repository.update(id, {
        backupStatus: 'completed',
        backupVerified: true,
        backupId: manifest.backupId,
        backupError: null,
      });

      if (this.auditLogService) {
        await this.auditLogService.logCriticalEvent({
          category: 'backup',
          severity: 'info',
          subsystem: 'backup',
          message: `Manual retry of post-inspection backup succeeded for inspection '${id}' (backupId: ${manifest.backupId})`,
          inspectionId: id,
          details: {
            backupId: manifest.backupId,
            totalSizeBytes: manifest.totalSizeBytes,
          },
        });
      }

      return manifest;
    } catch (err: any) {
      await this.repository.update(id, {
        backupStatus: 'failed',
        backupVerified: false,
        backupError: err.message,
      });

      if (this.auditLogService) {
        await this.auditLogService.logCriticalEvent({
          category: 'backup',
          severity: 'critical',
          subsystem: 'backup',
          message: `Manual retry of post-inspection backup failed for inspection '${id}': ${err.message}`,
          inspectionId: id,
          details: { error: err.message },
        });
      }

      throw err;
    } finally {
      this.activeBackups.delete(id);
    }
  }
}

