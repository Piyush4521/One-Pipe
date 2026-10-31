import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/config/env';

describe('Environment Validation (Zod Schema)', () => {
  it('should parse valid default environment parameters', () => {
    const config = validateEnvironment({
      NODE_ENV: 'development',
      PORT: '5000',
      HOST: '127.0.0.1',
      CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000',
      LOG_LEVEL: 'info',
    });

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(5000);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('should use default origins when CORS_ORIGIN is not provided', () => {
    const config = validateEnvironment({});
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('should reject invalid PORT values', () => {
    expect(() =>
      validateEnvironment({
        PORT: '99', // Below min 1024
      })
    ).toThrow('Environment configuration validation failed');

    expect(() =>
      validateEnvironment({
        PORT: '70000', // Above max 65535
      })
    ).toThrow('Environment configuration validation failed');
  });

  it('should reject invalid LOG_LEVEL values', () => {
    expect(() =>
      validateEnvironment({
        LOG_LEVEL: 'verbose_unsupported',
      })
    ).toThrow('Environment configuration validation failed');
  });

  it('should reject invalid NODE_ENV values', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'staging', // only development, production, test allowed
      })
    ).toThrow('Environment configuration validation failed');
  });
});
