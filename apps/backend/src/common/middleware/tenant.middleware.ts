import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Multi-tenant middleware for extracting and validating X-Tenant-ID header
 *
 * CRITICAL: This middleware ensures tenant-scoped API requests include a tenant ID for data isolation
 * Every downstream service MUST use this tenant ID to filter queries
 * BAD: Allowing requests without tenant_id leads to data leaks across tenants
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // GOOD: Extract tenant ID from standard header
    const tenantId = req.headers['x-tenant-id'] as string;

    // CRITICAL: Reject requests without tenant ID immediately
    // GOOD: Fail fast at the boundary to prevent unauthorized access
    // BAD: Proceeding without tenant ID and relying on downstream checks
    if (!tenantId || tenantId.trim() === '') {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'MISSING_TENANT_ID',
          message: 'X-Tenant-ID header is required for tenant-scoped API routes',
        },
        meta: {
          requestId: randomUUID(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    // GOOD: Attach tenant ID to request for downstream use
    // Services can access via req['tenantId'] or @TenantId() decorator
    req['tenantId'] = tenantId;

    next();
  }
}
