/**
 * Centralized Global Error Handler Middleware
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3, 20
 */

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export function errorMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = (res.locals.requestId as string) || req.requestId || 'unknown';

  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    logger.warn({ requestId, err: err.message }, 'Malformed JSON body received');
    sendError(res, 400, 'INVALID_JSON', 'Malformed JSON payload in request body.');
    return;
  }

  // Handle CORS rejection error
  if (err.message && err.message.includes('CORS')) {
    logger.warn({ requestId, err: err.message }, 'CORS request rejected');
    sendError(res, 403, 'CORS_NOT_ALLOWED', 'Origin is not permitted by CORS policy.');
    return;
  }

  const customErr = err as AppError;
  const statusCode = customErr.statusCode || 500;
  const errorCode = customErr.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // Log complete error details internally with stack trace
  logger.error(
    {
      requestId,
      statusCode,
      errorCode,
      err: {
        message: err.message,
        stack: err.stack,
      },
    },
    'Request failed with error'
  );

  // Never expose stack trace or filesystem path to HTTP clients
  const clientMessage =
    statusCode >= 500
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Request could not be processed.';

  sendError(res, statusCode, errorCode, clientMessage);
}

