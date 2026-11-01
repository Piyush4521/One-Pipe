/**
 * Backup REST Controller
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.4, 17
 */

import { NextFunction, Request, Response } from 'express';
import { BackupService } from '../services/backup.service';

export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  public create = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const manifest = await this.backupService.createBackup();
      res.status(201).json({
        success: true,
        data: manifest,
      });
    } catch (err) {
      next(err);
    }
  };

  public list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summaries = await this.backupService.listBackups();
      res.status(200).json({
        success: true,
        data: summaries,
      });
    } catch (err) {
      next(err);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const manifest = await this.backupService.getBackupManifest(req.params.id as string);
      res.status(200).json({
        success: true,
        data: manifest,
      });
    } catch (err) {
      next(err);
    }
  };

  public verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.backupService.verifyBackup(req.params.id as string);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  public restoreVerify = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const targetDb = req.body?.targetDatabase || 'pipebot_restore_test';
      const result = await this.backupService.restoreVerify(req.params.id as string, targetDb);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
