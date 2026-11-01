import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('System Health & Status Endpoints', () => {
  describe('GET /api/system/status', () => {
    it('should return 200 with honest subsystem status placeholders and diagnostics', async () => {
      const response = await request(app).get('/api/system/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { data } = response.body;
      expect(data.process).toBe('alive');
      expect(typeof data.uptimeSeconds).toBe('number');

      // Subsystem status checks - must be honestly reported as offline / not configured
      expect(data.subsystems).toBeDefined();
      expect(data.subsystems.esp32).toBe('offline');
      expect(data.subsystems.camera).toBe('offline');
      expect(data.subsystems.aiEngine).toBe('offline');
      expect(data.subsystems.database).toBe('offline');
      expect(data.subsystems.gpuDeviceName).toBeNull();
      expect(data.subsystems.isGpuAvailable).toBe(false);
      expect(typeof data.subsystems.lastChecked).toBe('string');

      // Storage limitation disclosure
      expect(data.storage).toBeDefined();
      expect(data.storage.driver).toBe('mongodb');
      expect(data.storage.isPersistent).toBe(false);
      expect(data.storage.limitation).toContain('disconnected');

      // Diagnostic details
      expect(data.details).toBeDefined();
      expect(data.details.esp32).toContain('Stage 5');
      expect(data.details.camera).toContain('Stage 5');
      expect(data.details.aiEngine).toContain('Stage 4');
      expect(data.details.database).toContain('MongoDB');
      expect(data.details.gpu).toContain('Stage 4');

      // Metadata validation
      expect(response.body.meta.requestId).toBeDefined();
      expect(response.headers['x-request-id']).toBe(response.body.meta.requestId);
    });
  });

  describe('GET /readyz (Readiness Probe)', () => {
    it('should return 503 not_ready when persistent database is disconnected', async () => {
      const response = await request(app).get('/readyz');

      expect(response.status).toBe(503);
      expect(response.body.data.status).toBe('not_ready');
      expect(response.body.data.database).toBe('disconnected');
      expect(response.body.data.storageDriver).toBe('mongodb');
    });
  });
});
