import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsService } from './logs.service';
import { Log } from './logs.entity';
import { LogsController } from './logs.controller';
import { LogsGateway } from './logs.gateway';

/**
 * Logs module for high-volume log management with cursor pagination
 *
 * GOOD: Registers entity, service, gateway, and controller for dependency injection
 * GOOD: Exports service and gateway for use in other modules
 * CRITICAL: LogsGateway enables real-time WebSocket streaming with tenant isolation
 */
@Module({
  imports: [
    // GOOD: Register Log entity for TypeORM repository access
    TypeOrmModule.forFeature([Log]),
  ],
  controllers: [LogsController],
  providers: [
    LogsService,
    LogsGateway, // GOOD: WebSocket gateway for real-time log streaming
  ],
  exports: [
    LogsService, // GOOD: Export for use in controllers
    LogsGateway, // GOOD: Export for use in service (broadcastLog)
  ],
})
export class LogsModule {}
