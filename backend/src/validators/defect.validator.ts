/**
 * Defect Evidence Validation Schemas (Zod 4.6.7)
 * Follows Rules/PipeBot_Build_Rulebook.md § 14.3, 14.5, 16.3
 */

import { z } from 'zod';

export const updateDefectReviewSchema = z
  .object({
    reviewStatus: z.enum(['UNREVIEWED', 'CONFIRMED', 'FALSE_POSITIVE', 'NEEDS_VERIFICATION']),
    operatorNotes: z.string().trim().max(1000, 'Operator notes max length is 1000 characters').optional(),
  })
  .strict();

export const defectQuerySchema = z.object({
  inspectionId: z.string().trim().min(1).max(64).optional(),
  reviewStatus: z.enum(['UNREVIEWED', 'CONFIRMED', 'FALSE_POSITIVE', 'NEEDS_VERIFICATION']).optional(),
  classId: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

