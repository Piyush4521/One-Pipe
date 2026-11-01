/**
 * Telemetry REST API Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 11, 16.1
 */

import { Router } from 'express';
import { TelemetryController } from '../controllers/telemetry.controller';

export function createTelemetryRouter(controller: TelemetryController): Router {
  const router = Router({ mergeParams: true });

  router.post('/:id/telemetry', controller.ingest);
  router.get('/:id/telemetry', controller.getTelemetry);
  router.get('/:id/telemetry/latest', controller.getLatest);
  router.get('/:id/telemetry/summary', controller.getSummary);

  return router;
}

