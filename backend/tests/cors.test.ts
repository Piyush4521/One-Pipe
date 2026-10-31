import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('CORS Origin Filtering Middleware', () => {
  it('should allow http://localhost:3000 and return appropriate CORS headers', async () => {
    const response = await request(app)
      .get('/healthz')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should allow http://127.0.0.1:3000 and return appropriate CORS headers', async () => {
    const response = await request(app)
      .get('/healthz')
      .set('Origin', 'http://127.0.0.1:3000');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should reject unapproved origins with 403 CORS_NOT_ALLOWED', async () => {
    const response = await request(app)
      .get('/healthz')
      .set('Origin', 'http://unapproved-origin.com');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CORS_NOT_ALLOWED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow requests without an Origin header per local API policy', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

