/**
 * PipeBot Backend HTTP Server Entrypoint
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.3, 10.3, 16.1
 */

import http from 'http';
import { app } from './app';
import { APP_NAME, APP_VERSION, WS_PATH } from './config/constants';
import { env } from './config/env';
import { logger } from './utils/logger';
import { wsServer } from './websocket/ws-server';

const server = http.createServer(app);

// Attach WebSocket server for real-time telemetry and event stream
wsServer.attachToHttpServer(server);

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
    },
    `PipeBot backend service listening on http://${env.HOST}:${env.PORT} (WebSocket at ${WS_PATH})`
  );
});

// Graceful Shutdown Handler
async function handleGracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, `Received ${signal}. Initiating graceful backend shutdown...`);

  try {
    await wsServer.close();
  } catch (err) {
    logger.error({ err }, 'Error closing WebSocket server during shutdown');
  }

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error occurred while closing HTTP listener');
      process.exit(1);
    }
    logger.info('HTTP server closed cleanly. Process terminating.');
    process.exit(0);
  });

  // Force termination after 5 seconds if connections hang
  setTimeout(() => {
    logger.error('Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

export default server;

