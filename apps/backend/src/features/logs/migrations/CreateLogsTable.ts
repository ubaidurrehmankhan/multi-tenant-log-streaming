import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration to create logs table with optimized indexes for:
 * 1. Cursor pagination (composite index on timestamp + id)
 * 2. Full-text search (GIN index on message_vector)
 * 3. Multi-tenant queries (composite index on tenant_id + timestamp)
 */
export class CreateLogsTable1706000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // CRITICAL: Enable uuid-ossp extension before creating table
    // Required for uuid_generate_v4() function used in id column
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create logs table with all required columns
    await queryRunner.createTable(
      new Table({
        name: 'logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()', // Requires uuid-ossp extension
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'timestamp',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
      // GOOD: No foreign keys in this table, so don't check metadata
      false,
    );

    // GOOD: Add tsvector column with auto-generation from message column
    // GENERATED ALWAYS AS ensures message_vector stays in sync with message automatically
    // STORED means the computed value is physically stored (vs VIRTUAL which computes on read)
    await queryRunner.query(`
      ALTER TABLE logs ADD COLUMN message_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', message)) STORED;
    `);

    // GOOD: GIN index for full-text search - optimized for tsvector queries
    // GIN (Generalized Inverted Index) is ideal for full-text search and JSONB
    // This enables fast @@ (match) queries without scanning the entire table
    await queryRunner.query(`
      CREATE INDEX idx_logs_fulltext ON logs USING GIN(message_vector);
    `);

    // GOOD: Composite index for cursor pagination
    // (timestamp, id) provides stable ordering with tie-breaker for identical timestamps
    // Enables O(1) seeks vs O(n) cost of OFFSET pagination at scale
    // Use raw SQL to avoid typeorm_metadata table dependency
    await queryRunner.query(`
      CREATE INDEX idx_logs_cursor ON logs (timestamp, id);
    `);

    // GOOD: Composite index for multi-tenant queries
    // Filters by tenant_id first, then sorts by timestamp
    // CRITICAL for tenant isolation and performance of tenant-scoped queries
    // Use raw SQL to avoid typeorm_metadata table dependency
    await queryRunner.query(`
      CREATE INDEX idx_logs_tenant_time ON logs (tenant_id, timestamp);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('logs', 'idx_logs_tenant_time');
    await queryRunner.dropIndex('logs', 'idx_logs_cursor');
    await queryRunner.query(`DROP INDEX IF EXISTS idx_logs_fulltext;`);

    // Drop table (cascades to columns including message_vector)
    await queryRunner.dropTable('logs');
  }
}
