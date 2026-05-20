import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { LogsService } from './logs.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { queryLogsSchema, QueryLogsDto } from './dto/query-logs.dto';
import { createLogSchema, CreateLogDto } from './dto/create-log.dto';

type RequestWithId = Request & { id?: string };

/**
 * Logs controller for log creation and paginated retrieval
 *
 * CRITICAL: Always wrap responses in the standard envelope format
 */
@Controller('v1/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * GET /v1/logs - Retrieve logs with cursor pagination
   *
   * GOOD: Uses cursor pagination for O(1) seeks
   * GOOD: Validates query params with Zod schema
   * CRITICAL: Filters by tenantId from middleware
   */
  @Get()
  async findAll(
    @Query() query: Record<string, unknown>,
    @TenantId() tenantId: string,
    @Req() req: RequestWithId,
  ) {
    const dto = this.parseQuery(query);
    const result = await this.logsService.findWithCursor(dto, tenantId);

    // CRITICAL: Wrap in standard envelope format
    return {
      success: true,
      data: result,
      meta: {
        requestId: req.id || randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * POST /v1/logs - Create a new log entry
   *
   * GOOD: Validates input with Zod schema
   * GOOD: Auto-generates timestamp server-side
   * GOOD: Broadcasts to WebSocket subscribers after DB commit
   * CRITICAL: Returns 201 Created with log in standard envelope
   *
   * @param body - Log creation data { severity, source, message, metadata? }
   * @param tenantId - Tenant ID from middleware
   * @param req - Express request object
   * @returns Created log wrapped in standard envelope
   */
  @Post()
  @HttpCode(201)
  async create(
    @Body() body: Record<string, unknown>,
    @TenantId() tenantId: string,
    @Req() req: RequestWithId,
  ) {
    const dto = this.parseBody(body);
    const log = await this.logsService.createLog(dto, tenantId);

    // CRITICAL: Wrap in standard envelope format
    return {
      success: true,
      data: log,
      meta: {
        requestId: req.id || randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Parse and validate query parameters
   * GOOD: Uses Zod for type-safe validation with coercion
   */
  private parseQuery(query: Record<string, unknown>): QueryLogsDto {
    const parsed = queryLogsSchema.safeParse(query);

    if (!parsed.success) {
      // GOOD: Fail fast with 400 for invalid query params
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
        },
      });
    }

    return parsed.data;
  }

  /**
   * Parse and validate request body
   * GOOD: Uses Zod for type-safe validation
   */
  private parseBody(body: Record<string, unknown>): CreateLogDto {
    const parsed = createLogSchema.safeParse(body);

    if (!parsed.success) {
      // GOOD: Fail fast with 400 for invalid request body
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
        },
      });
    }

    return parsed.data;
  }
}
