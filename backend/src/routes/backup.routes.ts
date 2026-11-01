/**
 * Backup REST Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.4, 17
 */

import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller';
import { requireOperatorAuthority } from '../middleware/authority.middleware';

export function createBackupRouter(controller: BackupController): Router {
  const router = Router();

  // Read-only backup inspection
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.post('/:id/verify', controller.verify);

  // Privileged operator backup actions
  router.post('/', requireOperatorAuthority, controller.create);
  router.post('/:id/restore-verify', requireOperatorAuthority, controller.restoreVerify);

  return router;
}

