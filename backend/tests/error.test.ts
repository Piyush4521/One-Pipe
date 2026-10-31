import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('Error Handling Middleware', () => {
  it('should return 404 with uniform error envelope for unknown routes', async () => {
    const response = await request(app).get('/api/unregistered/route/for/testing');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(typeof response.body.error.message).toBe('string');
    expect(response.body.error.message).toContain('/api/unregistered/route/for/testing');

    // Metadata validation
    expect(response.body.meta).toBeDefined();
    expect(typeof response.body.meta.requestId).toBe('string');
    expect(typeof response.body.meta.timestamp).toBe('string');

    // Ensure no stack traces are exposed
    expect(response.body.stack).toBeUndefined();
    expect(response.body.error.stack).toBeUndefined();
  });

  it('should return 400 with INVALID_JSON when body contains malformed JSON', async () => {
    const response = await request(app)
      .post('/api/system/status')
      .set('Content-Type', 'application/json')
      .send('{"invalidJson": unquotedValue}');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error.message).toContain('Malformed JSON');

    expect(response.body.meta.requestId).toBeDefined();
    expect(response.body.stack).toBeUndefined();
  });
});

