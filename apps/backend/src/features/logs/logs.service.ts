import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueryLogsDto } from './dto/query-logs.dto';
import { CreateLogDto } from './dto/create-log.dto';
import { Log } from './logs.entity';
import { LogsGateway } from './logs.gateway';

/**
 * Cursor payload structure for pagination
 * CRITICAL: Uses both timestamp AND id as tie-breaker to prevent duplicates
 */
interface CursorPayload {
  timestamp: string; // ISO8601 format
  id: string; // UUID
}

/**
 * Logs service implementing cursor-based pagination for high-volume logs
 *
 * GOOD: Cursor pagination with O(1) seeks via composite index (timestamp, id)
 * BAD: OFFSET pagination with O(n) cost that scans all previous rows
 *
 * CRITICAL: ALL queries MUST filter by tenantId to prevent data leaks
 */
@Injectable()
export class LogsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logsGateway: LogsGateway,
  ) {}

  /**
   * Encode cursor for pagination
   *
   * GOOD: URL-safe base64url encoding (no padding, no special chars)
   * GOOD: Includes both timestamp AND id as tie-breaker
   * BAD: Using only timestamp (duplicates when multiple logs at same millisecond)
   *
   * @param timestamp - Log timestamp
   * @param id - Log UUID
   * @returns Base64url-encoded cursor string
   */
  private encodeCursor(timestamp: Date, id: string): string {
    const payload: CursorPayload = {
      timestamp: timestamp.toISOString(),
      id,
    };

    // GOOD: base64url is URL-safe (no +, /, = chars)
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  /**
   * Decode cursor for pagination
   *
   * GOOD: Extracts both timestamp and id for composite cursor query
   * NOTE: Throws if cursor is invalid (caught by global exception filter)
   *
   * @param cursor - Base64url-encoded cursor string
   * @returns Decoded cursor payload
   */
  private decodeCursor(cursor: string): CursorPayload {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString());
  }

  /**
   * Find logs with cursor-based pagination
   *
   * PERFORMANCE: O(1) cursor seeks vs O(n) OFFSET scans
   * - Cursor uses composite index: idx_logs_cursor (timestamp, id)
   * - OFFSET scans ALL previous rows before returning results
   * - At 1M logs, OFFSET 500000 scans 500k rows; cursor seeks directly
   *
   * CRITICAL: ALWAYS filters by tenantId to prevent cross-tenant data leaks
   *
   * @param dto - Query parameters (cursor, limit, severity, searchTerm, from, to)
   * @param tenantId - Tenant ID from middleware (REQUIRED)
   * @returns Paginated logs with cursor and hasMore flag
   */
  async findWithCursor(dto: QueryLogsDto, tenantId: string) {
    const { cursor, limit = 50, severity, searchTerm, from, to } = dto;

    // GOOD: Start with tenant filter (uses idx_logs_tenant_time index)
    let query = `
      SELECT id, tenant_id, timestamp, severity, source, message, metadata
      FROM logs
      WHERE tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    // GOOD: Composite cursor condition leverages (timestamp, id) index
    // This enables O(1) seeks by comparing tuple (timestamp, id) in single operation
    if (cursor) {
      const { timestamp, id } = this.decodeCursor(cursor);
      query += ` AND (timestamp, id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(timestamp, id);
      paramIndex += 2;
    }

    // GOOD: Additional filters (still uses indexes)
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    // GOOD: Full-text search uses GIN index (idx_logs_fulltext) for O(log n) performance
    // GIN index on message_vector enables fast full-text search without scanning entire table
    // BAD: LIKE '%term%' would be O(n) full table scan (no index support)
    // GOOD: plainto_tsquery handles word stemming ('running' matches 'run', 'ran')
    // CRITICAL: Always use parameterized queries to prevent SQL injection
    if (searchTerm) {
      query += ` AND message_vector @@ plainto_tsquery('english', $${paramIndex})`;
      params.push(searchTerm);
      paramIndex++;
    }

    // GOOD: Time range filtering
    if (from) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    // CRITICAL: ORDER BY must match index (timestamp DESC, id DESC)
    // GOOD: Fetch limit+1 to check hasMore without extra query
    query += ` ORDER BY timestamp DESC, id DESC LIMIT $${paramIndex}`;
    params.push(limit + 1);

    // Execute raw SQL query
    const results = await this.dataSource.query(query, params);

    // GOOD: Check hasMore by fetching one extra row
    // BAD: Running COUNT(*) query (expensive on large tables)
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;

    // GOOD: Generate nextCursor only when more data exists
    // Uses last item's timestamp+id as cursor for next page
    const nextCursor =
      hasMore && items.length > 0
        ? this.encodeCursor(
            new Date(items[items.length - 1].timestamp),
            items[items.length - 1].id,
          )
        : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Create a new log entry
   *
   * GOOD: Transactional consistency - save to DB first, then broadcast
   * BAD: Broadcasting before DB commit (race condition if save fails)
   *
   * CRITICAL: Auto-generates timestamp server-side to prevent client manipulation
   * CRITICAL: Always includes tenantId from middleware (multi-tenant isolation)
   *
   * @param dto - Log creation data (severity, source, message, metadata)
   * @param tenantId - Tenant ID from middleware (REQUIRED)
   * @returns Created log entity
   */
  async createLog(dto: CreateLogDto, tenantId: string): Promise<Log> {
    // GOOD: Save to database first (transactional consistency)
    // Auto-generate timestamp server-side to prevent client tampering
    const log = await this.dataSource.getRepository(Log).save({
      ...dto,
      tenantId,
      timestamp: new Date(), // GOOD: Server-side timestamp
    });

    // GOOD: Broadcast after successful DB commit
    // Only reaches clients in same tenant room with matching severity filter
    await this.logsGateway.broadcastLog(log);

    return log;
  }
}
