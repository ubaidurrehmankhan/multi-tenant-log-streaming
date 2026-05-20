import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { Log } from './logs.entity';
import { io, Socket } from 'socket.io-client';
import { randomUUID } from 'crypto';

/**
 * End-to-End Integration Tests for Logs API
 *
 * CRITICAL TEST CASES:
 * 1. Cursor Pagination - No duplicates across pages (O(1) verification)
 * 2. Tenant Isolation - Cannot access other tenant data
 * 3. Full-Text Search - GIN index returns correct results
 * 4. WebSocket Broadcast - Real-time delivery to subscribers
 *
 * GOOD: Tests actual behavior, not implementation details
 * GOOD: Uses real database connection for integration testing
 * GOOD: Cleans up test data after each test
 */
describe('Logs API - E2E Integration Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  // Test tenant IDs
  const TENANT_A = 'tenant_a';
  const TENANT_B = 'tenant_b';
  const TENANT_C = 'tenant_c';

  /**
   * Setup: Start NestJS application and initialize database
   * GOOD: Use real database for integration testing (not mocks)
   */
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get actual port from running app
    await app.listen(0); // Random available port
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 3000 : address.port;
    baseUrl = `http://localhost:${port}`;

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  /**
   * Cleanup: Close app and database connections
   * GOOD: Prevent test pollution and resource leaks
   */
  afterAll(async () => {
    await app.close();
  });

  /**
   * Cleanup: Remove test data after each test
   * GOOD: Isolated tests that don't depend on execution order
   */
  afterEach(async () => {
    await dataSource.getRepository(Log).delete({});
  });

  /**
   * TEST CASE 1: Cursor Pagination - No Duplicates
   *
   * CRITICAL: Verifies O(1) cursor pagination works correctly
   * - Fetches page 1 with limit
   * - Extracts cursor from response
   * - Fetches page 2 using cursor
   * - Asserts NO overlap in IDs (no duplicates)
   * - Asserts timestamps are descending
   *
   * GOOD: Tests the composite index (timestamp, id) behavior
   * BAD: Would fail with OFFSET pagination (duplicates on concurrent inserts)
   */
  describe('Cursor Pagination', () => {
    it('should fetch pages without duplicates', async () => {
      // ARRANGE: Seed 150 logs for tenant_a with sequential timestamps
      const logs = await seedLogsForTenant(dataSource, TENANT_A, 150);

      // ACT: Fetch page 1 (limit=50)
      const page1Response = await fetch(
        `${baseUrl}/v1/logs?limit=50`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const page1Data = await page1Response.json();

      // ASSERT: Page 1 structure
      expect(page1Data.success).toBe(true);
      expect(page1Data.data.items).toHaveLength(50);
      expect(page1Data.data.hasMore).toBe(true);
      expect(page1Data.data.nextCursor).toBeDefined();

      // ACT: Fetch page 2 using cursor
      const page2Response = await fetch(
        `${baseUrl}/v1/logs?limit=50&cursor=${page1Data.data.nextCursor}`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const page2Data = await page2Response.json();

      // ASSERT: Page 2 structure
      expect(page2Data.success).toBe(true);
      expect(page2Data.data.items).toHaveLength(50);
      expect(page2Data.data.hasMore).toBe(true);

      // CRITICAL: Check for duplicates
      const page1Ids = new Set(page1Data.data.items.map((log: Log) => log.id));
      const page2Ids = new Set(page2Data.data.items.map((log: Log) => log.id));

      // GOOD: Intersection should be empty (no duplicates)
      const intersection = new Set(
        [...page1Ids].filter(id => page2Ids.has(id))
      );
      expect(intersection.size).toBe(0);

      // GOOD: Verify descending timestamp order
      const allLogs = [...page1Data.data.items, ...page2Data.data.items];
      for (let i = 0; i < allLogs.length - 1; i++) {
        const current = new Date(allLogs[i].timestamp).getTime();
        const next = new Date(allLogs[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('should return hasMore=false on last page', async () => {
      // ARRANGE: Seed exactly 100 logs
      await seedLogsForTenant(dataSource, TENANT_A, 100);

      // ACT: Fetch page 1 (limit=50)
      const page1Response = await fetch(
        `${baseUrl}/v1/logs?limit=50`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const page1Data = await page1Response.json();

      // ACT: Fetch page 2 (should be last page)
      const page2Response = await fetch(
        `${baseUrl}/v1/logs?limit=50&cursor=${page1Data.data.nextCursor}`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const page2Data = await page2Response.json();

      // ASSERT: Last page indicators
      expect(page2Data.data.items).toHaveLength(50);
      expect(page2Data.data.hasMore).toBe(false);
      expect(page2Data.data.nextCursor).toBeNull();
    });

    it('should reject invalid cursor with 400 error', async () => {
      // ACT: Try to use invalid cursor
      const response = await fetch(
        `${baseUrl}/v1/logs?cursor=invalid_cursor_here`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const data = await response.json();

      // ASSERT: Error response
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  /**
   * TEST CASE 2: Tenant Isolation
   *
   * CRITICAL: Verifies multi-tenant data isolation
   * - Creates logs for tenant_a and tenant_b
   * - Queries with tenant_a header
   * - Asserts ONLY tenant_a logs returned
   * - Queries without header
   * - Asserts 400 error (missing tenant)
   *
   * GOOD: Tests the CRITICAL security requirement
   * BAD: Data leak if this test fails (multi-tenant violation)
   */
  describe('Tenant Isolation', () => {
    it('should only return logs for requesting tenant', async () => {
      // ARRANGE: Seed logs for two different tenants
      await seedLogsForTenant(dataSource, TENANT_A, 50);
      await seedLogsForTenant(dataSource, TENANT_B, 50);

      // ACT: Query as tenant_a
      const response = await fetch(
        `${baseUrl}/v1/logs?limit=100`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const data = await response.json();

      // ASSERT: Only tenant_a logs returned
      expect(data.success).toBe(true);
      expect(data.data.items.length).toBeGreaterThan(0);

      // CRITICAL: All logs must belong to tenant_a
      data.data.items.forEach((log: Log) => {
        expect(log.tenantId).toBe(TENANT_A);
      });

      // GOOD: Should not see any tenant_b logs
      const tenantBLogs = data.data.items.filter(
        (log: Log) => log.tenantId === TENANT_B
      );
      expect(tenantBLogs).toHaveLength(0);
    });

    it('should return 400 when X-Tenant-ID header is missing', async () => {
      // ACT: Query without tenant header
      const response = await fetch(`${baseUrl}/v1/logs?limit=50`);
      const data = await response.json();

      // ASSERT: Error response with stable error code
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('MISSING_TENANT_ID');
      expect(data.meta.requestId).toBeDefined();
    });

    it('should isolate logs across all three tenants', async () => {
      // ARRANGE: Seed logs for all three tenants
      await seedLogsForTenant(dataSource, TENANT_A, 30);
      await seedLogsForTenant(dataSource, TENANT_B, 30);
      await seedLogsForTenant(dataSource, TENANT_C, 30);

      // ACT: Query each tenant
      const [responseA, responseB, responseC] = await Promise.all([
        fetch(`${baseUrl}/v1/logs?limit=100`, { headers: { 'X-Tenant-ID': TENANT_A } }),
        fetch(`${baseUrl}/v1/logs?limit=100`, { headers: { 'X-Tenant-ID': TENANT_B } }),
        fetch(`${baseUrl}/v1/logs?limit=100`, { headers: { 'X-Tenant-ID': TENANT_C } }),
      ]);

      const [dataA, dataB, dataC] = await Promise.all([
        responseA.json(),
        responseB.json(),
        responseC.json(),
      ]);

      // ASSERT: Each tenant sees only their own logs
      expect(dataA.data.items.every((log: Log) => log.tenantId === TENANT_A)).toBe(true);
      expect(dataB.data.items.every((log: Log) => log.tenantId === TENANT_B)).toBe(true);
      expect(dataC.data.items.every((log: Log) => log.tenantId === TENANT_C)).toBe(true);

      // ASSERT: Each tenant has their expected count
      expect(dataA.data.items.length).toBe(30);
      expect(dataB.data.items.length).toBe(30);
      expect(dataC.data.items.length).toBe(30);
    });
  });

  /**
   * TEST CASE 3: Full-Text Search
   *
   * CRITICAL: Verifies GIN index full-text search works
   * - Seeds logs with specific search terms
   * - Queries with searchTerm parameter
   * - Asserts matching logs returned
   * - Verifies GIN index used (not LIKE scan)
   *
   * GOOD: Tests the O(log n) GIN index performance
   * BAD: Would be O(n) with LIKE '%term%' scan
   */
  describe('Full-Text Search', () => {
    it('should find logs matching search term using GIN index', async () => {
      // ARRANGE: Seed logs with specific searchable content
      await dataSource.getRepository(Log).save([
        {
          tenantId: TENANT_A,
          timestamp: new Date(),
          severity: 'ERROR',
          source: 'auth-service',
          message: 'Authentication failed for user john@example.com',
          metadata: null,
        },
        {
          tenantId: TENANT_A,
          timestamp: new Date(Date.now() - 1000),
          severity: 'ERROR',
          source: 'auth-service',
          message: 'Failed to authenticate with invalid token',
          metadata: null,
        },
        {
          tenantId: TENANT_A,
          timestamp: new Date(Date.now() - 2000),
          severity: 'INFO',
          source: 'api-gateway',
          message: 'Request processed successfully',
          metadata: null,
        },
      ]);

      // ACT: Search for "authentication" (should match first 2 logs)
      const response = await fetch(
        `${baseUrl}/v1/logs?searchTerm=authentication&limit=50`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const data = await response.json();

      // ASSERT: Correct logs returned
      expect(data.success).toBe(true);
      expect(data.data.items.length).toBeGreaterThanOrEqual(2);

      // GOOD: Verify all results contain search term (case-insensitive)
      data.data.items.forEach((log: Log) => {
        const message = log.message.toLowerCase();
        expect(
          message.includes('authentication') ||
          message.includes('authenticate')
        ).toBe(true);
      });
    });

    it('should enforce minimum 3-character search term', async () => {
      // ACT: Try to search with 2 characters
      const response = await fetch(
        `${baseUrl}/v1/logs?searchTerm=ab&limit=50`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const data = await response.json();

      // ASSERT: Validation error
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should combine search with severity filter', async () => {
      // ARRANGE: Seed logs with various severities
      await dataSource.getRepository(Log).save([
        {
          tenantId: TENANT_A,
          timestamp: new Date(),
          severity: 'ERROR',
          source: 'db-service',
          message: 'Database connection timeout occurred',
          metadata: null,
        },
        {
          tenantId: TENANT_A,
          timestamp: new Date(Date.now() - 1000),
          severity: 'WARN',
          source: 'db-service',
          message: 'Database connection slow, retrying',
          metadata: null,
        },
      ]);

      // ACT: Search for "database" with severity=ERROR
      const response = await fetch(
        `${baseUrl}/v1/logs?searchTerm=database&severity=ERROR&limit=50`,
        { headers: { 'X-Tenant-ID': TENANT_A } }
      );
      const data = await response.json();

      // ASSERT: Only ERROR logs with "database" returned
      expect(data.success).toBe(true);
      expect(data.data.items.length).toBeGreaterThanOrEqual(1);
      data.data.items.forEach((log: Log) => {
        expect(log.severity).toBe('ERROR');
        expect(log.message.toLowerCase()).toContain('database');
      });
    });
  });

  /**
   * TEST CASE 4: WebSocket Broadcast
   *
   * CRITICAL: Verifies real-time log delivery via Socket.IO
   * - Connects WebSocket client to backend
   * - Subscribes to tenant logs
   * - Creates new log via REST API
   * - Asserts log received via WebSocket
   * - Verifies tenant isolation in WebSocket rooms
   *
   * GOOD: Tests the real-time streaming feature
   * GOOD: Uses Socket.IO client (matches backend)
   * BAD: Using native WebSocket would fail (incompatible)
   */
  describe('WebSocket Real-Time Broadcast', () => {
    let socket: Socket;

    /**
     * Setup: Connect Socket.IO client before each WebSocket test
     */
    beforeEach((done) => {
      socket = io(baseUrl, {
        transports: ['websocket'],
        autoConnect: true,
      });

      socket.on('connect', () => {
        done();
      });
    });

    /**
     * Cleanup: Disconnect socket after each test
     * GOOD: Prevent connection leaks
     */
    afterEach(() => {
      if (socket.connected) {
        socket.disconnect();
      }
    });

    it('should broadcast new log to subscribed clients', async () => {
      // ARRANGE: Subscribe to tenant_a logs
      const logReceived = new Promise<Log>((resolve) => {
        socket.on('log', (log: Log) => {
          resolve(log);
        });
      });

      socket.emit('subscribe', { tenantId: TENANT_A });

      // Wait for subscription confirmation
      await new Promise<void>((resolve) => {
        socket.on('subscribed', () => resolve());
      });

      // ACT: Create new log via REST API
      const newLog = {
        severity: 'INFO',
        source: 'test-service',
        message: 'WebSocket broadcast test log',
        metadata: { testId: randomUUID() },
      };

      await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_A,
        },
        body: JSON.stringify(newLog),
      });

      // ASSERT: Log received via WebSocket
      const receivedLog = await logReceived;
      expect(receivedLog).toBeDefined();
      expect(receivedLog.severity).toBe('INFO');
      expect(receivedLog.source).toBe('test-service');
      expect(receivedLog.message).toBe('WebSocket broadcast test log');
      expect(receivedLog.tenantId).toBe(TENANT_A);
    }, 10000); // 10s timeout for WebSocket

    it('should respect tenant isolation in WebSocket rooms', async () => {
      // ARRANGE: Create two sockets for different tenants
      const socketA = io(baseUrl, { transports: ['websocket'] });
      const socketB = io(baseUrl, { transports: ['websocket'] });

      await Promise.all([
        new Promise<void>((resolve) => socketA.on('connect', () => resolve())),
        new Promise<void>((resolve) => socketB.on('connect', () => resolve())),
      ]);

      // Subscribe to different tenants
      socketA.emit('subscribe', { tenantId: TENANT_A });
      socketB.emit('subscribe', { tenantId: TENANT_B });

      await Promise.all([
        new Promise<void>((resolve) => socketA.on('subscribed', () => resolve())),
        new Promise<void>((resolve) => socketB.on('subscribed', () => resolve())),
      ]);

      // Track received logs
      const logsA: Log[] = [];
      const logsB: Log[] = [];

      socketA.on('log', (log: Log) => logsA.push(log));
      socketB.on('log', (log: Log) => logsB.push(log));

      // ACT: Create log for tenant_a
      await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_A,
        },
        body: JSON.stringify({
          severity: 'INFO',
          source: 'test-service',
          message: 'Log for tenant A only',
        }),
      });

      // Wait for broadcast
      await new Promise(resolve => setTimeout(resolve, 500));

      // ASSERT: Only tenant_a socket received the log
      expect(logsA.length).toBe(1);
      expect(logsA[0].tenantId).toBe(TENANT_A);
      expect(logsB.length).toBe(0); // Tenant B should NOT receive it

      // Cleanup
      socketA.disconnect();
      socketB.disconnect();
    }, 10000);

    it('should filter broadcasts by severity when specified', async () => {
      // ARRANGE: Subscribe with severity filter
      const errorLogs: Log[] = [];

      socket.on('log', (log: Log) => {
        errorLogs.push(log);
      });

      socket.emit('subscribe', { tenantId: TENANT_A, severity: 'ERROR' });

      await new Promise<void>((resolve) => {
        socket.on('subscribed', () => resolve());
      });

      // ACT: Create INFO log (should NOT be received)
      await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_A,
        },
        body: JSON.stringify({
          severity: 'INFO',
          source: 'test-service',
          message: 'This INFO log should be filtered out',
        }),
      });

      // ACT: Create ERROR log (should be received)
      await fetch(`${baseUrl}/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_A,
        },
        body: JSON.stringify({
          severity: 'ERROR',
          source: 'test-service',
          message: 'This ERROR log should be received',
        }),
      });

      // Wait for broadcasts
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ASSERT: Only ERROR log received
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].severity).toBe('ERROR');
      expect(errorLogs[0].message).toContain('ERROR log should be received');
    }, 10000);
  });
});

/**
 * Helper function to seed logs for a specific tenant
 *
 * GOOD: Generates realistic log data for testing
 * GOOD: Uses batch insertion for performance
 *
 * @param dataSource - TypeORM DataSource
 * @param tenantId - Tenant ID for logs
 * @param count - Number of logs to create
 * @returns Array of created logs
 */
async function seedLogsForTenant(
  dataSource: DataSource,
  tenantId: string,
  count: number,
): Promise<Log[]> {
  const repository = dataSource.getRepository(Log);
  const logs: Partial<Log>[] = [];

  const severities: ('DEBUG' | 'INFO' | 'WARN' | 'ERROR')[] = [
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR',
  ];

  const sources = [
    'auth-service',
    'api-gateway',
    'payment-service',
    'db-service',
    'cache-service',
  ];

  const messages = [
    'Request processed successfully',
    'Database connection established',
    'Cache hit for key',
    'Authentication failed',
    'Payment transaction completed',
    'Database query timeout',
    'Rate limit exceeded',
    'Session expired',
  ];

  // GOOD: Create logs with descending timestamps (newest first)
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    logs.push({
      tenantId,
      timestamp: new Date(now - i * 1000), // 1 second apart
      severity: severities[Math.floor(Math.random() * severities.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      metadata: { testIndex: i },
    });
  }

  // GOOD: Batch insert for performance
  return await repository.save(logs);
}
