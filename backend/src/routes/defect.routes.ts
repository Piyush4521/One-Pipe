/**
 * Defect Evidence Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.2
 */

import { Router } from 'express';
import { defectController } from '../controllers/defect.controller';
import { requireOperatorAuthority } from '../middleware/authority.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { defectQuerySchema, updateDefectReviewSchema } from '../validators/defect.validator';

const router = Router();

// GET /api/defects - Read-only monitoring
router.get('/', validateQuery(defectQuerySchema), (req, res, next) =>
  defectController.list(req, res, next)
);

// GET /api/defects/stats - Read-only defect statistics breakdown
router.get('/stats', (req, res, next) => defectController.getStats(req, res, next));

// GET /api/defects/:id - Read-only single defect details
router.get('/:id', (req, res, next) => defectController.getById(req, res, next));

// PATCH /api/defects/:id/review - Operator updates review status
router.patch(
  '/:id/review',
  requireOperatorAuthority,
  validateBody(updateDefectReviewSchema),
  (req, res, next) => defectController.updateReview(req, res, next)
);

export default router;

