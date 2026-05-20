import { z } from 'zod';

/**
 * DTO for creating logs (used by POST /v1/logs)
 *
 * GOOD: Strict validation prevents invalid log entries
 * BAD: Accepting unvalidated payloads from clients
 */
export const createLogSchema = z.object({
  // GOOD: Enum validation for severity
  severity: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),

  // GOOD: Bound source length to match DB column constraints
  source: z.string().min(1).max(100),

  // GOOD: Allow longer messages but prevent abuse
  message: z.string().min(1).max(5000),

  // GOOD: Optional structured metadata for diagnostics
  metadata: z.record(z.unknown()).optional(),
});

export type CreateLogDto = z.infer<typeof createLogSchema>;
