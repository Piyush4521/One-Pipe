/**
 * PipeBot Backend HTTP Server Entrypoint
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.3, 10.3, 16.1, 16.4
 *
 * Startup Lifecycle:
 * 1. Validates environment configuration.
 * 2. Connects to MongoDB (if STORAGE_DRIVER === 'mongodb').
 * 3. Initializes non-destructive schema indexes via initializeDatabaseIndexes().
 * 4. Fails fast in production if MongoDB is unreachable.
 * 5. Starts degraded in development if MongoDB is unreachable (with 503 on persistent routes).
 * 6. Attaches WebSocket server (monitoring-only, strict security boundary).
 * 7. Binds HTTP server to 127.0.0.1:PORT.
 *
 * Shutdown Lifecycle:
 * 1. Handles SIGINT and SIGTERM with idempotent guard (isShuttingDown).
 * 2. Closes WebSocket clients and server.
 * 3. Stops accepting new HTTP connections.
 * 4. Closes MongoDB connection cleanly.
 * 5. Exits process with code 0 (or force-exits after 5s timeout).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from './app';
import { APP_NAME, APP_VERSION, WS_PATH } from './config/constants';
import { env } from './config/env';
import { initializeDatabaseIndexes } from './database/index-initializer';
import { mongoConnectionManager } from './database/mongo-connection';
import { evidenceStorageService } from './services/container';
import { logger } from './utils/logger';
import { wsServer } from './websocket/ws-server';

const server = http.createServer(app);

// Attach WebSocket server for real-time telemetry and event stream
wsServer.attachToHttpServer(server);

let isShuttingDown = false;

export async function startServer(): Promise<http.Server> {
  // Enforce production security invariant
  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER !== 'mongodb') {
    logger.fatal(
      'CRITICAL SECURITY VIOLATION: Production environment strictly requires STORAGE_DRIVER=mongodb. In-memory storage is forbidden in production.'
    );
    process.exit(1);
  }

  // Ensure local storage and backup directories exist
  try {
    fs.mkdirSync(path.join(env.STORAGE_ROOT, 'inspections'), { recursive: true });
    fs.mkdirSync(env.BACKUP_DIR, { recursive: true });
    // Clean dangling upload temp files on startup
    const cleaned = await evidenceStorageService.cleanOrphanedTempFiles();
    if (cleaned > 0) {
      logger.info({ cleanedTempFiles: cleaned }, 'Cleaned orphaned upload temp files on startup');
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to prepare storage directories or clean temp files');
  }

  // 1. Database Connection & Index Initialization
  if (env.STORAGE_DRIVER === 'mongodb') {
    try {
      await mongoConnectionManager.connect(env.MONGODB_URI, env.MONGODB_DB_NAME);
      await initializeDatabaseIndexes();
      logger.info(
        {
          database: env.MONGODB_DB_NAME,
          redactedUri: env.REDACTED_MONGODB_URI,
        },
        'MongoDB persistent storage initialized successfully'
      );
    } catch (err: any) {
      if (env.NODE_ENV === 'production') {
        logger.fatal(
          { errorMessage: err.message },
          'Production startup aborted: MongoDB persistent database is required but unreachable.'
        );
        process.exit(1);
      } else {
        logger.warn(
          { errorMessage: err.message },
          '[DEGRADED_MODE] MongoDB unreachable at startup. Running in degraded development mode. Persistence endpoints will return 503.'
        );
      }
    }
  } else {
    logger.warn(
      { storageDriver: env.STORAGE_DRIVER },
      '[TESTBED] Using volatile in-memory storage driver. Data resets on process restart.'
    );
  }

  // 2. Start HTTP listener
  return new Promise((resolve) => {
    server.listen(env.PORT, env.HOST, () => {
      logger.info(
        {
          appName: APP_NAME,
          appVersion: APP_VERSION,
          host: env.HOST,
          port: env.PORT,
          wsPath: WS_PATH,
          nodeEnv: env.NODE_ENV,
          logLevel: env.LOG_LEVEL,
          corsOrigins: env.CORS_ORIGINS,
          storageDriver: env.STORAGE_DRIVER,
          databaseName: env.STORAGE_DRIVER === 'mongodb' ? env.MONGODB_DB_NAME : 'none',
        },
        `PipeBot backend service listening on http://${env.HOST}:${env.PORT} (WebSocket at ${WS_PATH})`
      );
      resolve(server);
    });
  });
}

// Graceful Shutdown Handler
export async function handleGracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress. Ignoring redundant signal.');
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, `Received ${signal}. Initiating graceful backend shutdown...`);

  // Force termination after 5 seconds if connections hang
  const forceTimer = setTimeout(() => {
    logger.error('Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 5000);
  forceTimer.unref();

  try {
    await wsServer.close();
  } catch (err) {
    logger.error({ err }, 'Error closing WebSocket server during shutdown');
  }

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error occurred while closing HTTP listener');
    } else {
      logger.info('HTTP server closed cleanly.');
    }

    // Disconnect MongoDB connection
    try {
      await mongoConnectionManager.disconnect();
    } catch (dbErr) {
      logger.error({ dbErr }, 'Error disconnecting MongoDB during shutdown');
    }

    clearTimeout(forceTimer);
    logger.info('PipeBot backend shutdown completed cleanly. Process terminating.');
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// Only start the server automatically if executed directly as entrypoint
if (require.main === module) {
  startServer().catch((err) => {
    logger.fatal({ err }, 'Unhandled fatal error during server startup');
    process.exit(1);
  });
}

export default server;
