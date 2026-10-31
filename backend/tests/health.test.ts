import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('GET /healthz', () => {
  it('should return 200 with process liveness and uniform success envelope', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe('alive');
    expect(typeof response.body.data.uptimeSeconds).toBe('number');
    expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(response.body.data.version).toBe('1.0.0');
    expect(response.body.data.environment).toBeDefined();
    expect(response.body.data.timestamp).toBeDefined();

    // Verify metadata and request ID
    expect(response.body.meta).toBeDefined();
    expect(typeof response.body.meta.requestId).toBe('string');
    expect(response.body.meta.requestId.length).toBeGreaterThan(0);
    expect(response.headers['x-request-id']).toBe(response.body.meta.requestId);
  });

  it('should preserve client-supplied X-Request-Id header', async () => {
    const customRequestId = 'test-client-id-12345';
    const response = await request(app)
      .get('/healthz')
      .set('X-Request-Id', customRequestId);

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(customRequestId);
    expect(response.body.meta.requestId).toBe(customRequestId);
  });
});

