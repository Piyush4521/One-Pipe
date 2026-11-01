/**
 * Express Application Configuration
 * Follows Rules/PipeBot_Build_Rulebook.md § 7, 16, 20
 */

import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import { MAX_JSON_BODY_SIZE, isPermittedLocalOrigin } from './config/constants';
import { env } from './config/env';
import { systemController } from './controllers/system.controller';
import { errorMiddleware } from './middleware/error.middleware';
import { httpLoggingMiddleware } from './middleware/logging.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import apiRouter from './routes';

export function createApp(): Application {
  const app = express();

  // 1. Security Headers (Helmet)
  app.use(helmet());

  // 2. Explicit CORS Origin Allowlist (CORS is transport filtering, NOT authentication)
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (such as curl, mobile clients, server-side calls)
        if (!requestOrigin) {
          return callback(null, true);
        }
        if (env.CORS_ORIGINS.includes(requestOrigin) || isPermittedLocalOrigin(requestOrigin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy violation: origin '${requestOrigin}' not allowed.`));
      },
      credentials: true,
    })
  );

  // 3. Request Correlation ID
  app.use(requestIdMiddleware);

  // 4. Structured HTTP Request Logging
  app.use(httpLoggingMiddleware);

  // 5. JSON Body Parser with strict payload size limit
  app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));

  // 6. Root Health & Readiness Probes
  app.get('/healthz', (req, res) => systemController.getHealthz(req, res));
  app.get('/readyz', (req, res) => systemController.getReadyz(req, res));

  // 7. Master API Routes (/api/*)
  app.use('/api', apiRouter);

  // 8. 404 Not Found Handler
  app.use(notFoundMiddleware);

  // 9. Centralized Error Handler (Catches all sync & async errors, prevents leakage)
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
