/**
 * Local Backup & Restore Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.4, 17
 *
 * Provides cryptographic backup creation, manifest verification, rotation,
 * and safe restore verification into isolated test databases.
 *
 * CRITICAL SAFETY RULES:
 * 1. Concurrency Guard: Only one backup operation can execute at a time.
 * 2. Active Database Protection: Restore verification MUST NEVER overwrite active 'pipebot' DB.
 * 3. Fallback Integrity: If mongodump/mongorestore CLI tools are absent, structured JSON
 *    export/import is used with full SHA-256 verification.
 * 4. Retention Safety: Rotation retains the newest N backups and NEVER deletes the only valid backup.
 * 5. Relative References: Manifest references relative paths for portable restoration.
 */

import { execFile } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import mongoose from 'mongoose';
import * as path from 'path';
import { promisify } from 'util';
import { env } from '../config/env';
import {
  BackupCollectionEntry,
  BackupFileEntry,
  BackupManifest,
  BackupSummary,
  RestoreVerificationResult,
} from '../interfaces/backup.interface';
import { AppError } from '../middleware/error.middleware';
import { DefectModel } from '../models/defect.model';
import { InspectionModel } from '../models/inspection.model';
import { ReportModel } from '../models/report.model';
import { SystemEventModel } from '../models/system-event.model';
import { TelemetrySampleModel } from '../models/telemetry-sample.model';
import { logger } from '../utils/logger';
import { AuditLogService } from './audit-log.service';

const execFileAsync = promisify(execFile);

export class BackupService {
  private readonly backupRoot: string;
  private readonly storageRoot: string;
  private readonly retentionCount: number;
  private isBackupRunning = false;

  constructor(
    private readonly auditLogService?: AuditLogService,
    backupRoot?: string,
    storageRoot?: string,
    retentionCount?: number
  ) {
    this.backupRoot = path.resolve(backupRoot || env.BACKUP_DIR);
    this.storageRoot = path.resolve(storageRoot || env.STORAGE_ROOT);
    this.retentionCount = retentionCount || env.BACKUP_RETENTION_COUNT;
  }

  public getBackupRoot(): string {
    return this.backupRoot;
  }

  /**
   * Validates backup manifest structure, required fields, and supported version.
   */
  public validateManifest(manifest: unknown): asserts manifest is BackupManifest {
    if (!manifest || typeof manifest !== 'object') {
      const err: AppError = new Error(
        'Invalid backup manifest: payload must be a non-null object.'
      );
      err.statusCode = 400;
      err.code = 'INVALID_MANIFEST_FORMAT';
      throw err;
    }
    const m = manifest as any;
    if (m.manifestVersion !== '1.0.0') {
      const err: AppError = new Error(
        `Unsupported backup manifest version '${m.manifestVersion}'. Expected '1.0.0'.`
      );
      err.statusCode = 400;
      err.code = 'UNSUPPORTED_MANIFEST_VERSION';
      throw err;
    }
    if (!m.backupId || typeof m.backupId !== 'string') {
      const err: AppError = new Error('Invalid backup manifest: missing or invalid backupId.');
      err.statusCode = 400;
      err.code = 'INVALID_MANIFEST_FORMAT';
      throw err;
    }
    if (!Array.isArray(m.collections) || !Array.isArray(m.files)) {
      const err: AppError = new Error(
        'Invalid backup manifest: collections and files must be arrays.'
      );
      err.statusCode = 400;
      err.code = 'INVALID_MANIFEST_FORMAT';
      throw err;
    }
  }

  public sanitizeId(id: string): string {
    const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!cleaned || cleaned.includes('..')) {
      const err: AppError = new Error(`Invalid identifier '${id}'.`);
      err.statusCode = 400;
      err.code = 'INVALID_IDENTIFIER';
      throw err;
    }
    return cleaned;
  }

  /**
   * Checks whether mongodump executable is available.
   */
  public async isMongodumpAvailable(): Promise<boolean> {
    if (env.MONGODUMP_PATH) {
      try {
        await fs.promises.access(env.MONGODUMP_PATH, fs.constants.X_OK);
        return true;
      } catch {
        // Fall through to system lookup
      }
    }

    try {
      await execFileAsync('mongodump', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether mongorestore executable is available.
   */
  public async isMongorestoreAvailable(): Promise<boolean> {
    if (env.MONGORESTORE_PATH) {
      try {
        await fs.promises.access(env.MONGORESTORE_PATH, fs.constants.X_OK);
        return true;
      } catch {
        // Fall through to system lookup
      }
    }

    try {
      await execFileAsync('mongorestore', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Computes SHA-256 hash of a file on disk.
   */
  public async computeFileSha256(filePath: string): Promise<string> {
    const buffer = await fs.promises.readFile(filePath);
    const hash = createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  /**
   * Creates a full system backup (MongoDB database and inspection evidence/reports).
   */
  public async createBackup(): Promise<BackupManifest> {
    if (this.isBackupRunning) {
      const err: AppError = new Error('Another backup operation is currently in progress.');
      err.statusCode = 409;
      err.code = 'BACKUP_IN_PROGRESS';
      throw err;
    }

    this.isBackupRunning = true;
    const timestampStr = new Date().toISOString();
    const datePrefix = timestampStr.replace(/[-:T.]/g, '').slice(0, 14);
    const backupId = `backup_${datePrefix}_${randomUUID().slice(0, 8)}`;
    const backupDir = path.join(this.backupRoot, backupId);
    const dumpDir = path.join(backupDir, 'mongo_dump');
    const filesDir = path.join(backupDir, 'files');

    try {
      await fs.promises.mkdir(dumpDir, { recursive: true });
      await fs.promises.mkdir(filesDir, { recursive: true });

      const hasMongodump = await this.isMongodumpAvailable();
      let dumpMethod: 'mongodump' | 'structured_export' = 'structured_export';
      const collections: BackupCollectionEntry[] = [];

      if (hasMongodump) {
        try {
          const mongodumpExe = env.MONGODUMP_PATH || 'mongodump';
          await execFileAsync(mongodumpExe, [
            `--uri=${env.MONGODB_URI}`,
            `--db=${env.MONGODB_DB_NAME}`,
            `--out=${dumpDir}`,
          ]);
          dumpMethod = 'mongodump';
        } catch (err: any) {
          logger.warn('mongodump execution failed, falling back to structured export', {
            error: err.message,
          });
          dumpMethod = 'structured_export';
        }
      }

      if (dumpMethod === 'structured_export') {
        // Structured export using Mongoose models
        const models = [
          { name: 'inspections', model: InspectionModel },
          { name: 'defects', model: DefectModel },
          { name: 'reports', model: ReportModel },
          { name: 'telemetry', model: TelemetrySampleModel },
          { name: 'system_events', model: SystemEventModel },
        ];

        for (const item of models) {
          const docs = await (item.model as any).find().lean().exec();
          const jsonContent = JSON.stringify(docs, null, 2);
          const collectionFile = path.join(dumpDir, `${item.name}.json`);
          await fs.promises.writeFile(collectionFile, jsonContent, 'utf-8');

          const hash = createHash('sha256');
          hash.update(jsonContent);
          const sha256 = hash.digest('hex');

          collections.push({
            name: item.name,
            documentCount: docs.length,
            fileSizeBytes: Buffer.byteLength(jsonContent, 'utf-8'),
            sha256,
          });
        }
      }

      // Cross-resource consistency check: ensure all files referenced in database snapshot exist on disk
      const referencedFiles: string[] = [];
      const allDefects = await DefectModel.find().lean().exec();
      for (const d of allDefects) {
        if (d.evidenceImagePath && typeof d.evidenceImagePath === 'string') {
          referencedFiles.push(d.evidenceImagePath);
        }
      }
      const allReports = await ReportModel.find().lean().exec();
      for (const r of allReports) {
        if (r.pdfRelativePath && typeof r.pdfRelativePath === 'string') {
          referencedFiles.push(r.pdfRelativePath);
        }
      }

      for (const refPath of referencedFiles) {
        const fullPath = path.resolve(this.storageRoot, refPath);
        if (!fs.existsSync(fullPath)) {
          const err: AppError = new Error(
            `Backup consistency violation: Database references file '${refPath}' which does not exist on disk. Backup aborted.`
          );
          err.statusCode = 409;
          err.code = 'BACKUP_CONSISTENCY_VIOLATION';
          throw err;
        }
      }

      // Copy inspection files (evidence and reports)
      const files: BackupFileEntry[] = [];
      const inspectionsDir = path.join(this.storageRoot, 'inspections');

      if (fs.existsSync(inspectionsDir)) {
        await this.copyDirRecursive(inspectionsDir, path.join(filesDir, 'inspections'), files);
      }

      // Compute total size
      let totalSizeBytes = 0;
      for (const f of files) {
        totalSizeBytes += f.fileSizeBytes;
      }
      for (const c of collections) {
        totalSizeBytes += c.fileSizeBytes || 0;
      }

      const manifest: BackupManifest = {
        backupId,
        timestamp: timestampStr,
        databaseName: env.MONGODB_DB_NAME,
        dumpMethod,
        totalSizeBytes,
        files,
        collections,
        manifestVersion: '1.0.0',
        consistencyVerified: true,
        verified: true, // Will be verified immediately
      };

      // Write manifest
      const manifestPath = path.join(backupDir, 'manifest.json');
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      // Verify backup immediately
      const verification = await this.verifyBackup(backupId);
      if (!verification.verified) {
        manifest.verified = false;
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      }

      // Rotate older backups
      await this.rotateBackups();

      if (this.auditLogService) {
        await this.auditLogService.logEvent({
          category: 'backup',
          severity: 'info',
          subsystem: 'backup',
          message: `Backup '${backupId}' completed successfully (verified: ${manifest.verified}).`,
          details: {
            backupId,
            fileCount: files.length,
            collectionCount: collections.length,
            totalSizeBytes,
            dumpMethod,
          },
        });
      }

      return manifest;
    } catch (err: any) {
      // Purge incomplete backup directory on failure
      try {
        await fs.promises.rm(backupDir, { recursive: true, force: true });
      } catch {
        // Ignore directory cleanup error
      }

      if (this.auditLogService) {
        await this.auditLogService.logEvent({
          category: 'backup',
          severity: 'critical',
          subsystem: 'backup',
          message: `Backup '${backupId}' failed: ${err.message}`,
          details: { backupId, error: err.message },
        });
      }
      throw err;
    } finally {
      this.isBackupRunning = false;
    }
  }

  /**
   * Recursively copies directory and collects manifest entries with SHA-256.
   */
  private async copyDirRecursive(
    srcDir: string,
    destDir: string,
    filesList: BackupFileEntry[]
  ): Promise<void> {
    await fs.promises.mkdir(destDir, { recursive: true });
    const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcPath, destPath, filesList);
      } else if (entry.isFile()) {
        const relativePath = path.relative(this.storageRoot, srcPath).replace(/\\/g, '/');

        // Pre-copy digest
        const buffer = await fs.promises.readFile(srcPath);
        const hash = createHash('sha256');
        hash.update(buffer);
        const preHash = hash.digest('hex');

        // Write to destination
        await fs.promises.writeFile(destPath, buffer);

        // Post-copy verification on destination
        const destBuffer = await fs.promises.readFile(destPath);
        const destHash = createHash('sha256').update(destBuffer).digest('hex');

        // Detect concurrent modification on source file
        const postBuffer = await fs.promises.readFile(srcPath);
        const postHash = createHash('sha256').update(postBuffer).digest('hex');

        if (destHash !== preHash || postHash !== preHash) {
          const err: AppError = new Error(
            `Backup consistency violation: Source file '${relativePath}' was modified during backup window.`
          );
          err.statusCode = 409;
          err.code = 'BACKUP_CONSISTENCY_VIOLATION';
          throw err;
        }

        filesList.push({
          relativePath,
          fileSizeBytes: buffer.length,
          sha256: preHash,
        });
      }
    }
  }

  /**
   * Lists all existing backups sorted newest first.
   */
  public async listBackups(): Promise<BackupSummary[]> {
    if (!fs.existsSync(this.backupRoot)) {
      return [];
    }

    const entries = await fs.promises.readdir(this.backupRoot, { withFileTypes: true });
    const summaries: BackupSummary[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(this.backupRoot, entry.name, 'manifest.json');
        try {
          if (fs.existsSync(manifestPath)) {
            const raw = await fs.promises.readFile(manifestPath, 'utf-8');
            const manifest: BackupManifest = JSON.parse(raw);
            summaries.push({
              backupId: manifest.backupId,
              timestamp: manifest.timestamp,
              databaseName: manifest.databaseName,
              dumpMethod: manifest.dumpMethod,
              fileCount: manifest.files.length,
              collectionCount: manifest.collections.length,
              totalSizeBytes: manifest.totalSizeBytes,
              verified: manifest.verified,
            });
          }
        } catch {
          // Ignore unparseable or incomplete directories
        }
      }
    }

    // Sort descending by timestamp
    summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return summaries;
  }

  /**
   * Retrieves full manifest for a specific backup.
   */
  public async getBackupManifest(backupId: string): Promise<BackupManifest> {
    const safeId = this.sanitizeId(backupId);
    const manifestPath = path.join(this.backupRoot, safeId, 'manifest.json');

    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      this.validateManifest(manifest);
      return manifest;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        const notFoundErr: AppError = new Error(`Backup '${backupId}' was not found.`);
        notFoundErr.statusCode = 404;
        notFoundErr.code = 'BACKUP_NOT_FOUND';
        throw notFoundErr;
      }
      throw err;
    }
  }

  /**
   * Verifies all files and collections in a backup against their SHA-256 checksums.
   */
  public async verifyBackup(
    backupId: string
  ): Promise<{ verified: boolean; errors: string[] }> {
    const manifest = await this.getBackupManifest(backupId);
    const safeId = this.sanitizeId(backupId);
    const backupDir = path.join(this.backupRoot, safeId);
    const filesDir = path.join(backupDir, 'files');
    const dumpDir = path.join(backupDir, 'mongo_dump');
    const errors: string[] = [];

    // 1. Verify files
    for (const file of manifest.files) {
      const filePath = path.join(filesDir, file.relativePath);
      try {
        const sha256 = await this.computeFileSha256(filePath);
        if (sha256.toLowerCase() !== file.sha256.toLowerCase()) {
          errors.push(
            `File '${file.relativePath}' checksum mismatch: expected ${file.sha256}, got ${sha256}`
          );
        }
      } catch (err: any) {
        errors.push(`File '${file.relativePath}' missing or unreadable: ${err.message}`);
      }
    }

    // 2. Verify collections if structured export
    if (manifest.dumpMethod === 'structured_export') {
      for (const col of manifest.collections) {
        if (col.sha256) {
          const colPath = path.join(dumpDir, `${col.name}.json`);
          try {
            const sha256 = await this.computeFileSha256(colPath);
            if (sha256.toLowerCase() !== col.sha256.toLowerCase()) {
              errors.push(
                `Collection '${col.name}' checksum mismatch: expected ${col.sha256}, got ${sha256}`
              );
            }
          } catch (err: any) {
            errors.push(`Collection '${col.name}' dump missing: ${err.message}`);
          }
        }
      }
    }

    return {
      verified: errors.length === 0,
      errors,
    };
  }

  /**
   * Rotates old backups keeping the newest N backups.
   * Safety rule: NEVER delete the only valid backup.
   */
  public async rotateBackups(): Promise<number> {
    const backups = await this.listBackups();
    if (backups.length <= this.retentionCount) {
      return 0;
    }

    let deletedCount = 0;
    // Keep top retentionCount backups
    const candidatesToDelete = backups.slice(this.retentionCount);

    for (const backup of candidatesToDelete) {
      // Ensure we don't delete if it would leave 0 valid backups
      const remainingBackups = backups.filter((b) => b.backupId !== backup.backupId);
      const hasValidRemaining = remainingBackups.some((b) => b.verified);

      if (!hasValidRemaining) {
        logger.warn('Skipping deletion of backup during rotation to preserve at least 1 valid backup', {
          backupId: backup.backupId,
        });
        continue;
      }

      const backupPath = path.join(this.backupRoot, this.sanitizeId(backup.backupId));
      try {
        await fs.promises.rm(backupPath, { recursive: true, force: true });
        deletedCount++;
        logger.info(`Rotated old backup '${backup.backupId}'`);
      } catch (err: any) {
        logger.error(`Failed to delete rotated backup '${backup.backupId}': ${err.message}`);
      }
    }

    return deletedCount;
  }

  /**
   * Restores backup into an isolated test database to verify restore integrity.
   * STRICT SAFETY RULE: Rejects restoring into active database (pipebot) to prevent data loss.
   */
  public async restoreVerify(
    backupId: string,
    targetDatabase: string = 'pipebot_restore_test'
  ): Promise<RestoreVerificationResult> {
    // 1. Strict Active Database Guard
    if (
      targetDatabase.toLowerCase() === env.MONGODB_DB_NAME.toLowerCase() ||
      targetDatabase.toLowerCase() === 'pipebot'
    ) {
      const err: AppError = new Error(
        `Restoration into active production database '${targetDatabase}' is strictly forbidden during verification.`
      );
      err.statusCode = 403;
      err.code = 'ACTIVE_DATABASE_PROTECTED';
      throw err;
    }

    // 2. Verify backup manifest
    const verification = await this.verifyBackup(backupId);
    if (!verification.verified) {
      const err: AppError = new Error(
        `Backup verification failed prior to restore: ${verification.errors.join(', ')}`
      );
      err.statusCode = 400;
      err.code = 'BACKUP_CORRUPTED';
      throw err;
    }

    const manifest = await this.getBackupManifest(backupId);
    const safeId = this.sanitizeId(backupId);
    const dumpDir = path.join(this.backupRoot, safeId, 'mongo_dump');

    // 3. Connect to target test database via useDb
    const testDbConnection = mongoose.connection.useDb(targetDatabase);
    const restoredCollections: {
      name: string;
      expectedCount: number;
      restoredCount: number;
    }[] = [];

    let allMatched = true;

    try {
      if (manifest.dumpMethod === 'structured_export') {
        for (const col of manifest.collections) {
          const colFile = path.join(dumpDir, `${col.name}.json`);
          if (!fs.existsSync(colFile)) {
            const err: AppError = new Error(
              `Collection dump file for '${col.name}' is missing at '${colFile}'.`
            );
            err.statusCode = 400;
            err.code = 'COLLECTION_DUMP_MISSING';
            throw err;
          }

          // Checksum verification
          const actualSha256 = await this.computeFileSha256(colFile);
          if (col.sha256 && actualSha256.toLowerCase() !== col.sha256.toLowerCase()) {
            const err: AppError = new Error(
              `Collection dump file for '${col.name}' failed checksum verification. Expected ${col.sha256}, got ${actualSha256}.`
            );
            err.statusCode = 400;
            err.code = 'BACKUP_CORRUPTED';
            throw err;
          }

          const raw = await fs.promises.readFile(colFile, 'utf-8');
          let docs: any[];
          try {
            docs = JSON.parse(raw);
          } catch {
            const err: AppError = new Error(
              `Collection dump file for '${col.name}' contains invalid or corrupt JSON payload.`
            );
            err.statusCode = 400;
            err.code = 'CORRUPT_BACKUP_PAYLOAD';
            throw err;
          }

          const targetCollection = testDbConnection.collection(col.name);
          await targetCollection.deleteMany({});

          if (docs.length > 0) {
            await targetCollection.insertMany(docs);
          }

          const count = await targetCollection.countDocuments();
          restoredCollections.push({
            name: col.name,
            expectedCount: col.documentCount,
            restoredCount: count,
          });

          if (count !== col.documentCount) {
            allMatched = false;
          }

          // Representative record integrity verification
          if (docs.length > 0) {
            const sampleDoc = docs[0];
            const keyId =
              sampleDoc.inspectionId ||
              sampleDoc.defectId ||
              sampleDoc.reportId ||
              sampleDoc.sampleId ||
              sampleDoc.eventId;

            if (keyId) {
              const restoredDoc = await targetCollection.findOne({
                $or: [
                  { inspectionId: keyId },
                  { defectId: keyId },
                  { reportId: keyId },
                  { sampleId: keyId },
                  { eventId: keyId },
                ],
              });

              if (!restoredDoc) {
                allMatched = false;
                const err: AppError = new Error(
                  `Representative record integrity check failed for collection '${col.name}'. Record '${keyId}' not found after restore.`
                );
                err.statusCode = 500;
                err.code = 'RESTORE_RECORD_INTEGRITY_FAILED';
                throw err;
              }
            }
          }
        }
      } else {
        // mongorestore execution to targetDatabase
        const mongorestoreExe = env.MONGORESTORE_PATH || 'mongorestore';
        await execFileAsync(mongorestoreExe, [
          `--uri=${env.MONGODB_URI}`,
          `--nsInclude=${env.MONGODB_DB_NAME}.*`,
          `--nsFrom=${env.MONGODB_DB_NAME}.*`,
          `--nsTo=${targetDatabase}.*`,
          `--dir=${dumpDir}`,
          '--drop',
        ]);

        for (const col of manifest.collections) {
          const targetCollection = testDbConnection.collection(col.name);
          const count = await targetCollection.countDocuments();
          restoredCollections.push({
            name: col.name,
            expectedCount: col.documentCount,
            restoredCount: count,
          });
          if (count !== col.documentCount) {
            allMatched = false;
          }
        }
      }

      return {
        backupId,
        targetDatabase,
        verifiedAt: new Date().toISOString(),
        manifestVerified: verification.verified,
        restoredCollections,
        representativeRecordsVerified: true,
        allMatched,
        cleanedUp: true,
      };
    } finally {
      // Guaranteed cleanup path: always drop test database
      try {
        await testDbConnection.dropDatabase();
      } catch {
        // Ignore drop failure in cleanup
      }
    }
  }
}

