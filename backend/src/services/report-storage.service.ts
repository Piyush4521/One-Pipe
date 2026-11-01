/**
 * Inspection Report File Storage Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 16.4, 17
 *
 * Provides safe filesystem persistence, cryptographic checksumming, and verified download
 * for inspection report PDF files.
 * CRITICAL DATA-INTEGRITY CONSTRAINTS:
 * 1. Path Traversal Prevention: All paths strictly resolved and verified within STORAGE_ROOT.
 * 2. Magic Bytes Validation: Verifies %PDF- signature for all stored report documents.
 * 3. Atomic Writes: Writes to temporary file before atomic rename to prevent corruption.
 * 4. PDF binaries are NEVER stored in MongoDB. Only metadata and relative paths are persisted.
 */

import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

export interface ReportFileStorageResult {
  relativePath: string;
  absolutePath: string;
  fileSizeBytes: number;
  sha256: string;
}

export class ReportStorageService {
  private readonly storageRoot: string;

  constructor(storageRoot?: string) {
    this.storageRoot = path.resolve(storageRoot || env.STORAGE_ROOT);
  }

  public getStorageRoot(): string {
    return this.storageRoot;
  }

  /**
   * Validates %PDF- magic bytes (0x25 0x50 0x44 0x46 0x2D).
   */
  public validatePdfMagicBytes(buffer: Buffer): void {
    if (buffer.length < 5) {
      const err: AppError = new Error('File payload too small to be a valid PDF document.');
      err.statusCode = 400;
      err.code = 'INVALID_FILE_SIGNATURE';
      throw err;
    }

    if (
      buffer[0] !== 0x25 || // %
      buffer[1] !== 0x50 || // P
      buffer[2] !== 0x44 || // D
      buffer[3] !== 0x46 || // F
      buffer[4] !== 0x2d    // -
    ) {
      const err: AppError = new Error(
        'Unsupported file format. Report documents must be valid PDF files.'
      );
      err.statusCode = 400;
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      throw err;
    }
  }

  public sanitizePathComponent(name: string): string {
    if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
      const err: AppError = new Error(`Invalid path component '${name}'.`);
      err.statusCode = 400;
      err.code = 'INVALID_PATH';
      throw err;
    }
    const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!cleaned) {
      const err: AppError = new Error(`Invalid path component '${name}'.`);
      err.statusCode = 400;
      err.code = 'INVALID_PATH';
      throw err;
    }
    return cleaned;
  }

  public resolveSafePath(relativePath: string): string {
    if (!relativePath || relativePath.includes('..')) {
      const err: AppError = new Error('Path traversal detected. Access denied.');
      err.statusCode = 403;
      err.code = 'PATH_TRAVERSAL_DETECTED';
      throw err;
    }
    const normalized = path.normalize(relativePath);
    const absolutePath = path.resolve(this.storageRoot, normalized);

    if (!absolutePath.startsWith(this.storageRoot)) {
      const err: AppError = new Error('Path traversal detected. Access denied.');
      err.statusCode = 403;
      err.code = 'PATH_TRAVERSAL_DETECTED';
      throw err;
    }

    // Verify existing path components are not symlinks pointing outside storageRoot
    let current = path.dirname(absolutePath);
    while (current.length >= this.storageRoot.length) {
      if (fs.existsSync(current)) {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink()) {
          const err: AppError = new Error('Symbolic links are not permitted in storage paths.');
          err.statusCode = 403;
          err.code = 'SYMLINK_NOT_PERMITTED';
          throw err;
        }
        const real = fs.realpathSync(current);
        if (!real.startsWith(this.storageRoot)) {
          const err: AppError = new Error('Path traversal detected via symlink. Access denied.');
          err.statusCode = 403;
          err.code = 'PATH_TRAVERSAL_DETECTED';
          throw err;
        }
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    if (fs.existsSync(absolutePath)) {
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        const err: AppError = new Error('Symbolic links are not permitted in storage paths.');
        err.statusCode = 403;
        err.code = 'SYMLINK_NOT_PERMITTED';
        throw err;
      }
      const real = fs.realpathSync(absolutePath);
      if (!real.startsWith(this.storageRoot)) {
        const err: AppError = new Error('Path traversal detected via symlink. Access denied.');
        err.statusCode = 403;
        err.code = 'PATH_TRAVERSAL_DETECTED';
        throw err;
      }
    }

    return absolutePath;
  }

  /**
   * Stores report PDF file atomically.
   */
  public async saveReportPdf(
    inspectionId: string,
    reportId: string,
    buffer: Buffer
  ): Promise<ReportFileStorageResult> {
    this.validatePdfMagicBytes(buffer);

    const safeInspectionId = this.sanitizePathComponent(inspectionId);
    const safeReportId = this.sanitizePathComponent(reportId);

    const relativeDir = path.join('inspections', safeInspectionId, 'reports');
    const absoluteDir = this.resolveSafePath(relativeDir);

    await fs.promises.mkdir(absoluteDir, { recursive: true });

    const filename = `${safeReportId}.pdf`;
    const targetPath = path.join(absoluteDir, filename);
    const tempPath = path.join(absoluteDir, `${filename}.${randomUUID()}.tmp`);

    const relativePath = path
      .join('inspections', safeInspectionId, 'reports', filename)
      .replace(/\\/g, '/');

    const hash = createHash('sha256');
    hash.update(buffer);
    const sha256 = hash.digest('hex');

    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, targetPath);

    return {
      relativePath,
      absolutePath: targetPath,
      fileSizeBytes: buffer.length,
      sha256,
    };
  }

  /**
   * Reads stored report PDF file and verifies integrity.
   */
  public async getReportFile(
    relativePath: string
  ): Promise<{ buffer: Buffer; sha256: string }> {
    const absolutePath = this.resolveSafePath(relativePath);

    try {
      const buffer = await fs.promises.readFile(absolutePath);
      const hash = createHash('sha256');
      hash.update(buffer);
      const sha256 = hash.digest('hex');

      return { buffer, sha256 };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        const notFoundErr: AppError = new Error(`Report file '${relativePath}' was not found.`);
        notFoundErr.statusCode = 404;
        notFoundErr.code = 'FILE_NOT_FOUND';
        throw notFoundErr;
      }
      throw err;
    }
  }

  /**
   * Verifies that the file matches the expected SHA-256 digest.
   */
  public async verifyReportFile(relativePath: string, expectedSha256: string): Promise<boolean> {
    try {
      const { sha256 } = await this.getReportFile(relativePath);
      return sha256.toLowerCase() === expectedSha256.toLowerCase();
    } catch {
      return false;
    }
  }
}
