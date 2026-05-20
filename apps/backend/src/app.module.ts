import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LogsModule } from './features/logs/logs.module';
import { Log } from './features/logs/logs.entity';

// GOOD: Register global middleware and exception filter for consistent behavior
// CRITICAL: TenantMiddleware ensures ALL requests have tenant_id for data isolation
// CRITICAL: HttpExceptionFilter ensures ALL errors return standard envelope format
@Module({
  imports: [
    // CRITICAL: TypeORM configuration for PostgreSQL connection
    // GOOD: synchronize: false (migrations handle schema changes, not auto-sync)
    // GOOD: Use environment variables for all connection params (12-factor app)
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'logstream_db',
      entities: [Log], // Register all entities here
      synchronize: false, // CRITICAL: Never use true in production (use migrations)
      logging: process.env.NODE_ENV === 'development', // GOOD: Log SQL in dev only
    }),
    LogsModule,
  ],
  controllers: [AppController],
  providers: [
    // GOOD: Register global exception filter via APP_FILTER token
    // This ensures consistent error format across ALL endpoints
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  // GOOD: Configure middleware to run on all API routes
  // CRITICAL: Exclude /health so container probes do not require tenant headers
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes('*'); // Apply to all routes
  }
}
