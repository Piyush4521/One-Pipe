/**
 * Report Metadata Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2, 17
 */

import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { requireOperatorAuthority } from '../middleware/authority.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { generateReportSchema } from '../validators/report.validator';

const router = Router();

// GET /api/reports - Read-only monitoring
router.get('/', (req, res, next) => reportController.list(req, res, next));

// GET /api/reports/:id - Read-only single report metadata
router.get('/:id', (req, res, next) => reportController.getById(req, res, next));

// GET /api/reports/:id/download - Download compiled report PDF file
router.get('/:id/download', (req, res, next) => reportController.download(req, res, next));

// POST /api/reports - Operator requests report generation metadata
router.post(
  '/',
  requireOperatorAuthority,
  validateBody(generateReportSchema),
  (req, res, next) => reportController.create(req, res, next)
);

export default router;

