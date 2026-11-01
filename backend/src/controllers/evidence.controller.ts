/**
 * Evidence Storage REST Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 16.1
 */

import { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import { IDefectRepository } from '../interfaces/repositories';
import { AppError } from '../middleware/error.middleware';
import {
  EvidenceStorageResult,
  EvidenceStorageService,
} from '../services/evidence-storage.service';

export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceStorageService,
    private readonly defectRepo: IDefectRepository
  ) {}

  public uploadEvidence = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    let savedResult: EvidenceStorageResult | null = null;
    try {
      const inspectionId = req.params.id as string;
      const defectId = req.params.defectId as string;
      const frameId =
        (req.query.frameId as string) ||
        (req.headers['x-frame-id'] as string) ||
        'frame_0';

      const defect = await this.defectRepo.findById(defectId);
      if (!defect || defect.inspectionId !== inspectionId) {
        const err: AppError = new Error(
          `Defect record '${defectId}' was not found in inspection session '${inspectionId}'.`
        );
        err.statusCode = 404;
        err.code = 'DEFECT_NOT_FOUND';
        throw err;
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        const err: AppError = new Error('Request body must contain binary image data.');
        err.statusCode = 400;
        err.code = 'INVALID_PAYLOAD';
        throw err;
      }

      const result = await this.evidenceService.saveEvidence(
        inspectionId,
        defectId,
        frameId,
        req.body
      );
      savedResult = result;

      // Update defect record with evidence metadata
      await this.defectRepo.updateEvidenceMetadata(defectId, {
        evidenceImagePath: result.relativePath,
        evidenceFileSizeBytes: result.fileSizeBytes,
        evidenceSha256: result.sha256,
        evidenceMimeType: result.mimeType,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      // Rollback newly written file if metadata persistence failed
      if (savedResult && !savedResult.isDuplicate && fs.existsSync(savedResult.absolutePath)) {
        try {
          await fs.promises.unlink(savedResult.absolutePath);
        } catch {
          // Ignore unlink error during rollback
        }
      }
      next(err);
    }
  };

  public getEvidence = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const inspectionId = req.params.id as string;
      const filename = req.params.filename as string;
      const safeInspectionId = this.evidenceService.sanitizePathComponent(inspectionId);
      const safeFilename = pathSecurityCheck(filename);

      const relativePath = `inspections/${safeInspectionId}/evidence/${safeFilename}`;
      const { buffer, sha256, mimeType } = await this.evidenceService.getEvidence(relativePath);

      // Verify SHA-256 integrity against defect metadata if defect ID is present in filename
      const defectId = safeFilename.split('_')[0];
      if (defectId) {
        const defect = await this.defectRepo.findById(defectId);
        if (
          defect &&
          defect.evidenceSha256 &&
          defect.evidenceSha256.toLowerCase() !== sha256.toLowerCase()
        ) {
          const err: AppError = new Error(
            `Evidence file integrity check failed for '${filename}'. Checksum mismatch between stored file and database record.`
          );
          err.statusCode = 500;
          err.code = 'EVIDENCE_CORRUPTED';
          throw err;
        }
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('ETag', `"${sha256}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  };
}

function pathSecurityCheck(filename: string): string {
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    const err: AppError = new Error('Invalid filename format.');
    err.statusCode = 400;
    err.code = 'INVALID_FILENAME';
    throw err;
  }
  return filename;
}
