import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// GOOD: Composite index for cursor pagination enables O(1) seeks vs O(n) offset pagination
// The (timestamp, id) pair provides a unique ordering with tie-breaker for identical timestamps
@Index('idx_logs_cursor', ['timestamp', 'id'])

// GOOD: GIN index for full-text search on message_vector (tsvector type)
// Created via migration because TypeORM can't auto-generate tsvector columns
// synchronize: false prevents TypeORM from trying to manage this index
@Index('idx_logs_fulltext', { synchronize: false })

// GOOD: Composite index for multi-tenant queries
// Filters by tenant first, then sorts by timestamp for efficient tenant-specific log retrieval
@Index('idx_logs_tenant_time', ['tenantId', 'timestamp'])

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // CRITICAL: Maps to tenant_id in DB for snake_case convention
  // Every query MUST filter by this to prevent data leaks between tenants
  @Column({ name: 'tenant_id' })
  tenantId: string;

  // GOOD: timestamptz stores timezone info, critical for distributed systems
  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 20 })
  severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  // Log source identifier (e.g., 'auth-service', 'api-gateway', 'worker')
  @Column({ type: 'varchar', length: 100 })
  source: string;

  @Column({ type: 'text' })
  message: string;

  // GOOD: JSONB allows efficient querying of structured metadata
  // Nullable because not all logs have additional context
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // CRITICAL: select: false excludes this from SELECT * queries
  // tsvector is auto-generated via GENERATED ALWAYS AS in migration
  // BAD practice: Including this in queries wastes bandwidth (it's only for search)
  @Column({ name: 'message_vector', type: 'tsvector', select: false })
  messageVector: string;
}
