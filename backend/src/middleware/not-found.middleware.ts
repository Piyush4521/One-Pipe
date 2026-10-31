/**
 * 404 Not Found Middleware
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3
 */

import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/response';

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction): void {
  sendError(
    res,
    404,
    'NOT_FOUND',
    `Route '${req.method} ${req.originalUrl}' does not exist on this server.`
  );
}

