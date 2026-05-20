import { DataSource } from 'typeorm';
import { Log } from '../features/logs/logs.entity';
import { CreateLogsTable1706000000000 } from '../features/logs/migrations/CreateLogsTable';

/**
 * TypeORM DataSource configuration for migrations and CLI operations
 *
 * GOOD: Separate from app.module.ts for migration CLI usage
 * This file is used by TypeORM CLI commands (migration:run, migration:revert)
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'logstream_db', // GOOD: Matches docker-compose.yml and project naming

  // GOOD: Explicit entity and migration paths
  entities: [Log],
  migrations: [CreateLogsTable1706000000000],

  // BAD: Never set synchronize: true in production (use migrations instead)
  // GOOD: Use false and rely on explicit migrations for schema changes
  synchronize: false,

  // GOOD: Log queries in development for debugging
  logging: process.env.NODE_ENV === 'development',

  // GOOD: SSL configuration for production databases
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
