/**
 * Client Authority & Role-Based Access Boundary Middleware
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.1, 10.1, 20
 */

import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export type ClientRole = 'OPERATOR' | 'MONITOR_ONLY';

declare global {
  namespace Express {
    interface Request {
      clientRole?: ClientRole;
    }
  }
}

/**
 * Validates whether the incoming request possesses a verified Laptop Operator secret token.
 * NOTE: CORS origins and User-Agent headers are NEVER treated as authorization.
 */
export function requireOperatorAuthority(req: Request, res: Response, next: NextFunction): void {
  const operatorToken = req.headers['x-operator-token'];

  // Check for presence of operator credential
  if (!operatorToken || typeof operatorToken !== 'string' || operatorToken.trim().length === 0) {
    logger.warn(
      {
        requestId: res.locals.requestId,
        path: req.originalUrl,
        method: req.method,
      },
      'Missing operator authorization token'
    );

    sendError(
      res,
      403,
      'ROLE_UNAUTHORIZED',
      'Laptop operator authority required. Missing x-operator-token header.'
    );
    return;
  }

  // Validate token against configured server-side secret using timing-safe comparison
  const expectedSecret = env.OPERATOR_TOKEN;
  const providedBuffer = Buffer.from(operatorToken.trim());
  const expectedBuffer = Buffer.from(expectedSecret);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    logger.warn(
      {
        requestId: res.locals.requestId,
        path: req.originalUrl,
        method: req.method,
      },
      'Invalid operator authorization token supplied'
    );

    sendError(
      res,
      403,
      'ROLE_UNAUTHORIZED',
      'Laptop operator authority required. Invalid operator token.'
    );
    return;
  }

  // Token verified - register client role as OPERATOR
  req.clientRole = 'OPERATOR';
  next();
}

/**
 * Safety lockout middleware for robot movement execution in Stage 2.
 * Ensures no physical commands can be triggered before Stage 5 hardware integration.
 */
export function movementSafetyLockout(req: Request, res: Response, _next: NextFunction): void {
  logger.info(
    {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
    },
    'Robot movement command safely blocked: Hardware execution disabled in Stage 2'
  );

  sendError(
    res,
    503,
    'FEATURE_DISABLED',
    'Robot movement command execution is disabled in Stage 2. Awaiting Stage 5 hardware safety verification.'
  );
}
