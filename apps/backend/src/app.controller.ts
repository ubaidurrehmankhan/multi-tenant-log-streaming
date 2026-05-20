import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // GOOD: Health check endpoint for container orchestration
  // Returns timestamp for freshness verification
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'logstream-api',
    };
  }

  // BAD: Would be health check without timestamp
  // @Get('health')
  // getHealth() {
  //   return { status: 'ok' }; // No timestamp for freshness check
  // }
}
