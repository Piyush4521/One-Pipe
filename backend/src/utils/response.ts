/**
 * Uniform Response Envelope Helpers
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3
 */

import { Response } from 'express';
import { ApiErrorDetail, ApiErrorResponse, ApiSuccessResponse } from '../interfaces/api-response.interface';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const requestId = (res.locals.requestId as string) || '';
  const responsePayload: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  return res.status(statusCode).json(responsePayload);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[]
): Response {
  const requestId = (res.locals.requestId as string) || '';
  const responsePayload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  return res.status(statusCode).json(responsePayload);
}

