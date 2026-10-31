/**
 * Robot Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.1, 10.1, 10.2, 16.2
 */

import { Router } from 'express';
import { robotController } from '../controllers/robot.controller';
import { movementSafetyLockout, requireOperatorAuthority } from '../middleware/authority.middleware';

const router = Router();

// GET /api/robot/status - Read-only hardware status for monitoring
router.get('/status', (req, res) => robotController.getStatus(req, res));

// POST /api/robot/commands - Operator movement pulse (Blocked in Stage 2 pending Stage 5)
router.post('/commands', requireOperatorAuthority, movementSafetyLockout);

/**
 * POST /api/robot/emergency-stop - Software emergency stop request
 *
 * SAFETY RATIONALE:
 * In accordance with fail-safe safety engineering principles, emergency stop requests
 * must have the lowest possible barrier to entry. Any local client detecting an imminent
 * hazard may issue a software stop request without token gating.
 * The response explicitly clarifies that software cannot confirm physical motor cutoff
 * and that the chassis button remains the primary safety mechanism.
 */
router.post('/emergency-stop', (req, res) => robotController.emergencyStop(req, res));

export default router;
