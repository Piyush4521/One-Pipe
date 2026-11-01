/**
 * Master API Router
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1, 16.2
 */

import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller';
import { EvidenceController } from '../controllers/evidence.controller';
import { SystemEventController } from '../controllers/system-event.controller';
import { TelemetryController } from '../controllers/telemetry.controller';
import {
  auditLogService,
  backupService,
  defectRepository,
  evidenceStorageService,
  telemetryService,
} from '../services/container';
import { createBackupRouter } from './backup.routes';
import defectRoutes from './defect.routes';
import { createEvidenceRouter } from './evidence.routes';
import inspectionRoutes from './inspection.routes';
import reportRoutes from './report.routes';
import robotRoutes from './robot.routes';
import { createSystemEventRouter } from './system-event.routes';
import systemRoutes from './system.routes';
import { createTelemetryRouter } from './telemetry.routes';

const apiRouter = Router();

// Subsystem health & process diagnostics
apiRouter.use('/system', systemRoutes);

// System Events & Audit Log
const systemEventController = new SystemEventController(auditLogService);
apiRouter.use('/system', createSystemEventRouter(systemEventController));

// Robot connection & safety control
apiRouter.use('/robot', robotRoutes);

// Inspection session lifecycle
apiRouter.use('/inspections', inspectionRoutes);

// Telemetry ingestion & retrieval (mounted under /inspections/:id/telemetry)
const telemetryController = new TelemetryController(telemetryService);
apiRouter.use('/inspections', createTelemetryRouter(telemetryController));

// Defect evidence image upload & retrieval (mounted under /inspections/:id/...)
const evidenceController = new EvidenceController(evidenceStorageService, defectRepository);
apiRouter.use('/inspections', createEvidenceRouter(evidenceController));

// Defect evidence records & review
apiRouter.use('/defects', defectRoutes);

// Consolidated report metadata
apiRouter.use('/reports', reportRoutes);

// Database & file backups
const backupController = new BackupController(backupService);
apiRouter.use('/backups', createBackupRouter(backupController));

export default apiRouter;
