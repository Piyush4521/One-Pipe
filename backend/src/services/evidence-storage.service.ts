/**
 * Local Inspection Evidence Storage Service
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 16.4
 *
 * Provides safe, verified local storage for defect crop images and inspection frames.
 * CRITICAL SAFETY & INTEGRITY CONSTRAINTS:
 * 1. Path Traversal Prevention: All paths strictly resolved and verified within STORAGE_ROOT.
 * 2. Magic Bytes Validation: Verifies binary signatures for JPEG and PNG formats.
 * 3. Atomic Writes: Writes to temporary file before atomic rename to prevent partial writes.
 * 4. SHA-256 Checksums: Cryptographic digests recorded for every saved evidence file.
 * 5. Relative References: Persists relative storage paths to ensure portable backups.
 */

import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

export interface EvidenceStorageResult {
  relativePath: string;
  absolutePath: string;
  fileSizeBytes: number;
  sha256: string;
  mimeType: 'image/jpeg' | 'image/png';
  isDuplicate?: boolean;
}

export class EvidenceStorageService {
  private readonly storageRoot: string;
  private readonly maxFileSizeBytes: number;

  constructor(storageRoot?: string, maxFileSizeBytes?: number) {
    this.storageRoot = path.resolve(storageRoot || env.STORAGE_ROOT);
    this.maxFileSizeBytes = maxFileSizeBytes || env.MAX_EVIDENCE_FILE_SIZE_BYTES;
  }

  public getStorageRoot(): string {
    return this.storageRoot;
  }

  /**
   * Validates image magic bytes to ensure payload is legitimate JPEG or PNG.
   */
  public validateMagicBytes(buffer: Buffer): 'image/jpeg' | 'image/png' {
    if (buffer.length < 8) {
      const err: AppError = new Error('File payload too small to be a valid image.');
      err.statusCode = 400;
      err.code = 'INVALID_FILE_SIGNATURE';
      throw err;
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }

    const err: AppError = new Error(
      'Unsupported file format. Evidence images must be valid JPEG or PNG files.'
    );
    err.statusCode = 400;
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    throw err;
  }

  /**
   * Sanitizes string token for safe path component usage, rejecting path traversal characters.
   */
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

  /**
   * Resolves and verifies that a relative path stays within storageRoot.
   * Enforces symlink rejection and canonical directory containment.
   */
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
   * Saves defect evidence image atomically to local storage.
   * Prevents accidental overwrites and supports idempotent duplicate uploads.
   */
  public async saveEvidence(
    inspectionId: string,
    defectId: string,
    frameId: string,
    buffer: Buffer
  ): Promise<EvidenceStorageResult> {
    if (buffer.length > this.maxFileSizeBytes) {
      const err: AppError = new Error(
        `File size (${buffer.length} bytes) exceeds maximum allowed limit of ${this.maxFileSizeBytes} bytes.`
      );
      err.statusCode = 413;
      err.code = 'FILE_TOO_LARGE';
      throw err;
    }

    const mimeType = this.validateMagicBytes(buffer);
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';

    const safeInspectionId = this.sanitizePathComponent(inspectionId);
    const safeDefectId = this.sanitizePathComponent(defectId);
    const safeFrameId = this.sanitizePathComponent(frameId);

    const relativeDir = path.join('inspections', safeInspectionId, 'evidence');
    const absoluteDir = this.resolveSafePath(relativeDir);

    await fs.promises.mkdir(absoluteDir, { recursive: true });

    const filename = `${safeDefectId}_${safeFrameId}.${extension}`;
    const targetPath = path.join(absoluteDir, filename);
    const tempPath = path.join(absoluteDir, `${filename}.${randomUUID()}.tmp`);

    const relativePath = path
      .join('inspections', safeInspectionId, 'evidence', filename)
      .replace(/\\/g, '/');

    // Compute cryptographic SHA-256 digest
    const hash = createHash('sha256');
    hash.update(buffer);
    const sha256 = hash.digest('hex');

    // Overwrite prevention & idempotent duplicate detection
    if (fs.existsSync(targetPath)) {
      const existingBuffer = await fs.promises.readFile(targetPath);
      const existingSha256 = createHash('sha256').update(existingBuffer).digest('hex');

      if (existingSha256 === sha256) {
        // Idempotent duplicate: identical content already stored
        return {
          relativePath,
          absolutePath: targetPath,
          fileSizeBytes: existingBuffer.length,
          sha256: existingSha256,
          mimeType,
          isDuplicate: true,
        };
      }

      // Conflict: different content for the same defect and frame ID
      const err: AppError = new Error(
        `Evidence file already exists with different contents for defect '${safeDefectId}' and frame '${safeFrameId}'. Overwrite denied.`
      );
      err.statusCode = 409;
      err.code = 'EVIDENCE_ALREADY_EXISTS';
      throw err;
    }

    // Atomic write via temp file rename
    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, targetPath);

    return {
      relativePath,
      absolutePath: targetPath,
      fileSizeBytes: buffer.length,
      sha256,
      mimeType,
      isDuplicate: false,
    };
  }

  /**
   * Reads stored evidence file and verifies integrity.
   */
  public async getEvidence(
    relativePath: string
  ): Promise<{ buffer: Buffer; sha256: string; mimeType: string }> {
    const absolutePath = this.resolveSafePath(relativePath);

    try {
      const buffer = await fs.promises.readFile(absolutePath);
      const hash = createHash('sha256');
      hash.update(buffer);
      const sha256 = hash.digest('hex');

      const mimeType =
        absolutePath.endsWith('.png') || (buffer[0] === 0x89 && buffer[1] === 0x50)
          ? 'image/png'
          : 'image/jpeg';

      return { buffer, sha256, mimeType };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        const notFoundErr: AppError = new Error(`Evidence file '${relativePath}' was not found.`);
        notFoundErr.statusCode = 404;
        notFoundErr.code = 'EVIDENCE_FILE_NOT_FOUND';
        throw notFoundErr;
      }
      throw err;
    }
  }

  /**
   * Verifies that the file at relativePath matches the expected SHA-256 digest.
   */
  public async verifyEvidence(relativePath: string, expectedSha256: string): Promise<boolean> {
    try {
      const { sha256 } = await this.getEvidence(relativePath);
      return sha256.toLowerCase() === expectedSha256.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * Cleans orphaned .tmp upload files older than maxAgeMs (default 5 minutes).
   */
  public async cleanOrphanedTempFiles(maxAgeMs: number = 300000): Promise<number> {
    let deletedCount = 0;
    const now = Date.now();

    const walk = async (dir: string): Promise<void> => {
      if (!fs.existsSync(dir)) return;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.tmp')) {
          try {
            const stat = await fs.promises.stat(fullPath);
            if (now - stat.mtimeMs > maxAgeMs) {
              await fs.promises.unlink(fullPath);
              deletedCount++;
            }
          } catch {
            // Concurrently removed or locked
          }
        }
      }
    };

    await walk(this.storageRoot);
    return deletedCount;
  }
}
