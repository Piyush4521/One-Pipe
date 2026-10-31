/**
 * Master API Router
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1, 16.2
 */

import { Router } from 'express';
import defectRoutes from './defect.routes';
import inspectionRoutes from './inspection.routes';
import reportRoutes from './report.routes';
import robotRoutes from './robot.routes';
import systemRoutes from './system.routes';

const apiRouter = Router();

// Subsystem health & process diagnostics
apiRouter.use('/system', systemRoutes);

// Robot connection & safety control
apiRouter.use('/robot', robotRoutes);

// Inspection session lifecycle
apiRouter.use('/inspections', inspectionRoutes);

// Defect evidence records & review
apiRouter.use('/defects', defectRoutes);

// Consolidated report metadata
apiRouter.use('/reports', reportRoutes);

export default apiRouter;
