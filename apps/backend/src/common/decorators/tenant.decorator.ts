import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract tenant ID from request
 *
 * GOOD: Provides clean, type-safe access to tenant ID in controllers
 * BAD: Accessing req['tenantId'] directly in every controller method
 *
 * Usage in controller:
 * @Get()
 * async findAll(@TenantId() tenantId: string, @Query() query: any) {
 *   return this.service.findAll(query, tenantId);
 * }
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    // GOOD: Extract tenant ID that was attached by middleware
    // CRITICAL: This assumes TenantMiddleware has already run
    const tenantId = request['tenantId'];

    // GOOD: Defensive check (should never happen if middleware is registered)
    if (!tenantId) {
      throw new Error(
        'Tenant ID not found in request. Ensure TenantMiddleware is registered.',
      );
    }

    return tenantId;
  },
);
