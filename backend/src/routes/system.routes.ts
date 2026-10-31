/**
 * System Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.2
 */

import { Router } from 'express';
import { systemController } from '../controllers/system.controller';

const router = Router();

// GET /api/system/status
router.get('/status', (req, res) => systemController.getSystemStatus(req, res));

export default router;

