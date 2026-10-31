import { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';
import { movementSafetyLockout, requireOperatorAuthority } from '../src/middleware/authority.middleware';

describe('Authority & Security Boundary Middleware', () => {
  describe('requireOperatorAuthority', () => {
    it('should reject requests without x-operator-token with 403 ROLE_UNAUTHORIZED', () => {
      const req = {
        headers: {},
        originalUrl: '/api/robot/commands',
        method: 'POST',
      } as unknown as Request;

      let statusCode = 0;
      let jsonPayload: any = null;

      const res = {
        locals: { requestId: 'test-req-id' },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          jsonPayload = payload;
          return res;
        },
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      requireOperatorAuthority(req, res, next);

      expect(statusCode).toBe(403);
      expect(jsonPayload.success).toBe(false);
      expect(jsonPayload.error.code).toBe('ROLE_UNAUTHORIZED');
      expect(jsonPayload.error.message).toContain('Missing x-operator-token');
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid x-operator-token with 403 ROLE_UNAUTHORIZED', () => {
      const req = {
        headers: {
          'x-operator-token': 'wrong-attacker-token-1234',
        },
        originalUrl: '/api/robot/commands',
        method: 'POST',
      } as unknown as Request;

      let statusCode = 0;
      let jsonPayload: any = null;

      const res = {
        locals: { requestId: 'test-req-id' },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          jsonPayload = payload;
          return res;
        },
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      requireOperatorAuthority(req, res, next);

      expect(statusCode).toBe(403);
      expect(jsonPayload.success).toBe(false);
      expect(jsonPayload.error.code).toBe('ROLE_UNAUTHORIZED');
      expect(jsonPayload.error.message).toContain('Invalid operator token');
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow requests with valid configured x-operator-token and assign OPERATOR role', () => {
      const req = {
        headers: {
          'x-operator-token': env.OPERATOR_TOKEN,
        },
        originalUrl: '/api/robot/commands',
        method: 'POST',
      } as unknown as Request;

      const res = {
        locals: { requestId: 'test-req-id' },
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      requireOperatorAuthority(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(req.clientRole).toBe('OPERATOR');
    });
  });

  describe('movementSafetyLockout', () => {
    it('should block movement execution with 503 FEATURE_DISABLED in Stage 2', () => {
      const req = {
        originalUrl: '/api/robot/commands',
        method: 'POST',
      } as unknown as Request;

      let statusCode = 0;
      let jsonPayload: any = null;

      const res = {
        locals: { requestId: 'test-req-id' },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (payload: any) => {
          jsonPayload = payload;
          return res;
        },
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      movementSafetyLockout(req, res, next);

      expect(statusCode).toBe(503);
      expect(jsonPayload.success).toBe(false);
      expect(jsonPayload.error.code).toBe('FEATURE_DISABLED');
      expect(jsonPayload.error.message).toContain('Stage 5');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
