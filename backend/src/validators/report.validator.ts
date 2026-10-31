/**
 * Report Validation Schemas (Zod 4.6.7)
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.3, 17
 */

import { z } from 'zod';

export const generateReportSchema = z
  .object({
    inspectionId: z.string().trim().min(1, 'Inspection ID is required').max(64, 'Invalid inspection ID length'),
  })
  .strict();

