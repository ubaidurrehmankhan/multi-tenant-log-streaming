import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { randomUUID } from 'crypto';

/**
 * Global exception filter to ensure consistent error response format
 *
 * CRITICAL: ALL errors return { success: false, error: { code, message }, meta }
 * This filter catches both HttpException and unknown errors
 *
 * GOOD: Consistent error format makes frontend error handling predictable
 * BAD: Letting different endpoints return different error shapes
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // GOOD: Determine status code from exception type
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // GOOD: Extract message from exception
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // CRITICAL: Extract error code and message with fallbacks
    // Handles both custom error objects and standard NestJS exceptions
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'An error occurred';

    if (typeof message === 'object' && message !== null) {
      // GOOD: Check for custom error format from middleware/services
      if ('error' in message && typeof message.error === 'object') {
        const errorObj = message.error as { code?: string; message?: string };
        errorCode = errorObj.code || 'INTERNAL_ERROR';
        errorMessage = errorObj.message || 'An error occurred';
      } else if ('message' in message) {
        // GOOD: Handle standard NestJS error format
        errorMessage = (message as any).message || errorMessage;
        errorCode = this.mapStatusToCode(status);
      }
    } else if (typeof message === 'string') {
      errorMessage = message;
      errorCode = this.mapStatusToCode(status);
    }

    // CRITICAL: Return consistent error envelope format
    // GOOD: Same format for ALL errors (400, 401, 404, 500, etc.)
    // BAD: Different error formats for different status codes
    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Map HTTP status codes to semantic error codes
   * GOOD: Provides stable error codes for common HTTP errors
   */
  private mapStatusToCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };

    return codeMap[status] || 'INTERNAL_ERROR';
  }
}
