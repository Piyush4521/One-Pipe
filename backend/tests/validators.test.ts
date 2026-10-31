import { describe, expect, it } from 'vitest';
import { defectQuerySchema, updateDefectReviewSchema } from '../src/validators/defect.validator';
import { createInspectionSchema, inspectionQuerySchema } from '../src/validators/inspection.validator';
import { robotMovementCommandSchema } from '../src/validators/robot.validator';

describe('Zod 4 Validation Schemas', () => {
  describe('createInspectionSchema', () => {
    it('should validate valid inspection creation input', () => {
      const result = createInspectionSchema.safeParse({
        conduitName: 'North Storm Line 04',
        operatorNotes: 'Routine quarterly inspection',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conduitName).toBe('North Storm Line 04');
      }
    });

    it('should allow optional fields', () => {
      const result = createInspectionSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject empty or whitespace-only conduit name if provided', () => {
      const result = createInspectionSchema.safeParse({ conduitName: '   ' });
      expect(result.success).toBe(false);
    });

    it('should reject oversized conduit name (> 100 chars)', () => {
      const result = createInspectionSchema.safeParse({
        conduitName: 'A'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it('should reject oversized operator notes (> 1000 chars)', () => {
      const result = createInspectionSchema.safeParse({
        operatorNotes: 'A'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('should reject unknown extra fields due to strict schema', () => {
      const result = createInspectionSchema.safeParse({
        conduitName: 'Line A',
        unknownInjectedField: 'dangerous payload',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateDefectReviewSchema', () => {
    it('should validate permitted review statuses', () => {
      const validStatuses = ['UNREVIEWED', 'CONFIRMED', 'FALSE_POSITIVE', 'NEEDS_VERIFICATION'] as const;

      for (const status of validStatuses) {
        const result = updateDefectReviewSchema.safeParse({ reviewStatus: status });
        expect(result.success).toBe(true);
      }
    });

    it('should reject unsupported review statuses', () => {
      const result = updateDefectReviewSchema.safeParse({
        reviewStatus: 'APPROVED_BY_ADMIN',
      });
      expect(result.success).toBe(false);
    });

    it('should reject extra fields', () => {
      const result = updateDefectReviewSchema.safeParse({
        reviewStatus: 'CONFIRMED',
        injectedSeverity: 'HIGH',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('robotMovementCommandSchema (Provisional Contract)', () => {
    it('should validate velocity values within [-1.0, 1.0] and valid duration', () => {
      const result = robotMovementCommandSchema.safeParse({
        linearVelocity: 0.5,
        angularVelocity: -0.2,
        durationMs: 200,
        sequenceNumber: 1042,
      });
      expect(result.success).toBe(true);
    });

    it('should reject linearVelocity > 1.0', () => {
      const result = robotMovementCommandSchema.safeParse({
        linearVelocity: 1.5,
        angularVelocity: 0.0,
        durationMs: 200,
      });
      expect(result.success).toBe(false);
    });

    it('should reject linearVelocity < -1.0', () => {
      const result = robotMovementCommandSchema.safeParse({
        linearVelocity: -1.2,
        angularVelocity: 0.0,
        durationMs: 200,
      });
      expect(result.success).toBe(false);
    });

    it('should reject durationMs > 500ms', () => {
      const result = robotMovementCommandSchema.safeParse({
        linearVelocity: 0.0,
        angularVelocity: 0.0,
        durationMs: 600,
      });
      expect(result.success).toBe(false);
    });

    it('should reject durationMs < 10ms', () => {
      const result = robotMovementCommandSchema.safeParse({
        linearVelocity: 0.0,
        angularVelocity: 0.0,
        durationMs: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Query parameter schemas', () => {
    it('should coerce and apply bounds to page and limit', () => {
      const result = inspectionQuerySchema.safeParse({
        page: '2',
        limit: '50',
        status: 'running',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.status).toBe('running');
      }
    });

    it('should reject limit > 100', () => {
      const result = defectQuerySchema.safeParse({
        limit: '500',
      });
      expect(result.success).toBe(false);
    });
  });
});

