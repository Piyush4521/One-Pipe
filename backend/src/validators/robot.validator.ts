/**
 * Robot Command Validation Schema (Provisional Contract)
 * Follows Rules/PipeBot_Build_Rulebook.md § 10.1, 16.2
 *
 * CAUTION:
 * All field names, velocity ranges, and duration bounds below are non-normative,
 * unapproved placeholders and do NOT represent the final agreed ESP32 protocol,
 * motor specifications, or communication structure (reserved for Stage 5).
 * Movement command execution is strictly disabled in Stage 2.
 */

import { z } from 'zod';

export const robotMovementCommandSchema = z
  .object({
    linearVelocity: z
      .number()
      .min(-1.0, 'Provisional velocity limit placeholder: -1.0')
      .max(1.0, 'Provisional velocity limit placeholder: 1.0'),
    angularVelocity: z
      .number()
      .min(-1.0, 'Provisional angular velocity limit placeholder: -1.0')
      .max(1.0, 'Provisional angular velocity limit placeholder: 1.0'),
    durationMs: z
      .number()
      .int()
      .min(10, 'Provisional duration min: 10ms')
      .max(500, 'Provisional duration max: 500ms'),
    sequenceNumber: z.number().int().min(0).optional(),
  })
  .strict();
