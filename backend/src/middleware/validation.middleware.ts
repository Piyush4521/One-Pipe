/**
 * Request Validation Middleware (Zod 4.6.7)
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3
 */

import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { sendError } from '../utils/response';

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));

      sendError(res, 400, 'VALIDATION_ERROR', 'Request body validation failed.', details);
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
      }));

      sendError(res, 400, 'VALIDATION_ERROR', 'Request query parameters validation failed.', details);
      return;
    }

    // Assign sanitized & coerced query parameters
    req.query = result.data as any;
    next();
  };
}

