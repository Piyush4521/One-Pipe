/**
 * Structured HTTP Request Logger Middleware
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3, 20
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export function httpLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const requestId = res.locals.requestId || req.requestId || 'unknown';

    logger.info(
      {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
      },
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms`
    );
  });

  next();
}

