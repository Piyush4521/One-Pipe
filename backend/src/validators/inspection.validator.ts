/**
 * Inspection Validation Schemas (Zod 4.6.7)
 * Follows Rules/PipeBot_Build_Rulebook.md § 9, 16.3
 */

import { z } from 'zod';

export const createInspectionSchema = z
  .object({
    conduitName: z.string().trim().min(1, 'Conduit name cannot be empty').max(100, 'Conduit name too long').optional(),
    operatorNotes: z.string().trim().max(1000, 'Operator notes max length is 1000 characters').optional(),
  })
  .strict();

export const lifecycleTransitionSchema = z
  .object({
    targetState: z.enum(['ready', 'running', 'paused', 'completed', 'recovery_required']),
    operatorNotes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const inspectionQuerySchema = z.object({
  status: z.enum(['ready', 'running', 'paused', 'completed', 'recovery_required']).optional(),
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 string' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 string' }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
