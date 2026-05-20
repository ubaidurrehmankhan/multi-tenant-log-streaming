import { z } from 'zod';

/**
 * Query DTO for logs pagination with optional filters
 *
 * GOOD: Zod validation with coercion for query params (arrive as strings)
 * GOOD: Strict limits on searchTerm to prevent abuse
 * BAD: Allowing unbounded limit (risk of memory exhaustion)
 */
export const queryLogsSchema = z.object({
  // GOOD: Optional cursor for pagination (base64-encoded timestamp:id)
  cursor: z.string().optional(),

  // GOOD: Coerce string to number, enforce reasonable limits
  limit: z.coerce.number().min(1).max(100).default(50),

  // GOOD: Enum validation for severity
  severity: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),

  // GOOD: Min length prevents single-char searches (expensive on GIN index)
  // Single-character searches return too many matches, defeating index selectivity
  // 3+ characters provide meaningful results and better GIN index performance
  searchTerm: z.string().min(3).max(200).optional(),

  // GOOD: ISO8601 datetime validation for time range filtering
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type QueryLogsDto = z.infer<typeof queryLogsSchema>;
