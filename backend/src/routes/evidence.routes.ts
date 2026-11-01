/**
 * Evidence Storage REST Routes
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 16.1
 */

import { Router, raw } from 'express';
import { EvidenceController } from '../controllers/evidence.controller';

export function createEvidenceRouter(controller: EvidenceController): Router {
  const router = Router({ mergeParams: true });

  const rawBinaryParser = raw({
    type: ['image/jpeg', 'image/png', 'application/octet-stream'],
    limit: '10mb',
  });

  router.post(
    '/:id/defects/:defectId/evidence',
    rawBinaryParser,
    controller.uploadEvidence
  );

  router.get('/:id/evidence/:filename', controller.getEvidence);

  return router;
}

