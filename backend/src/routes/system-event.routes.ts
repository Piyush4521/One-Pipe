/**
 * System Event & Audit Log Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 8.4, 16.1
 */

import { Router } from 'express';
import { SystemEventController } from '../controllers/system-event.controller';

export function createSystemEventRouter(controller: SystemEventController): Router {
  const router = Router();

  router.get('/events', controller.getEvents);
  router.post('/events', controller.recordEvent);

  return router;
}

