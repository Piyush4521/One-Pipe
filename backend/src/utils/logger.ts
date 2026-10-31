/**
 * Structured Pino Logger
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3, 20
 */

import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-operator-token"]',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      'headers.authorization',
      'headers.cookie',
      'headers["x-operator-token"]',
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

