/**
 * Inspection Session Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.2
 */

import { Router } from 'express';
import { inspectionController } from '../controllers/inspection.controller';
import { requireOperatorAuthority } from '../middleware/authority.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { createInspectionSchema, inspectionQuerySchema } from '../validators/inspection.validator';

const router = Router();

// GET /api/inspections - Read-only monitoring
router.get('/', validateQuery(inspectionQuerySchema), (req, res, next) =>
  inspectionController.list(req, res, next)
);

// POST /api/inspections - Operator creates session in 'ready' state
router.post(
  '/',
  requireOperatorAuthority,
  validateBody(createInspectionSchema),
  (req, res, next) => inspectionController.create(req, res, next)
);

// GET /api/inspections/:id - Read-only single session details
router.get('/:id', (req, res, next) => inspectionController.getById(req, res, next));

// POST /api/inspections/:id/start - Operator starts inspection
router.post('/:id/start', requireOperatorAuthority, (req, res, next) =>
  inspectionController.start(req, res, next)
);

// POST /api/inspections/:id/pause - Operator pauses inspection
router.post('/:id/pause', requireOperatorAuthority, (req, res, next) =>
  inspectionController.pause(req, res, next)
);

// POST /api/inspections/:id/resume - Operator resumes inspection
router.post('/:id/resume', requireOperatorAuthority, (req, res, next) =>
  inspectionController.resume(req, res, next)
);

// POST /api/inspections/:id/complete - Operator finalizes inspection
router.post('/:id/complete', requireOperatorAuthority, (req, res, next) =>
  inspectionController.complete(req, res, next)
);

// POST /api/inspections/:id/backup - Operator triggers or retries post-inspection backup
router.post('/:id/backup', requireOperatorAuthority, (req, res, next) =>
  inspectionController.retryBackup(req, res, next)
);

export default router;

