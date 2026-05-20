import 'reflect-metadata';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/data-source';
import { Log } from './logs.entity';

type Severity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

type LogInsert = Omit<Log, 'id' | 'messageVector'>;

type MessagePayload = {
  message: string;
  source: string;
  metadata: Record<string, unknown> | null;
};

const TENANT_COUNTS = {
  tenant_a: 50_000,
  tenant_b: 30_000,
  tenant_c: 20_000,
} as const;

const BATCH_SIZE = 1000;
const LOG_PROGRESS_EVERY = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.now();

const clusters = [
  { centerDaysAgo: 2, spreadDays: 1.5, weight: 0.25 },
  { centerDaysAgo: 6, spreadDays: 2.0, weight: 0.2 },
  { centerDaysAgo: 12, spreadDays: 3.0, weight: 0.2 },
  { centerDaysAgo: 20, spreadDays: 3.0, weight: 0.2 },
  { centerDaysAgo: 27, spreadDays: 2.0, weight: 0.15 },
];

const sources = [
  'auth-service',
  'api-gateway',
  'billing-service',
  'order-service',
  'db-service',
  'worker',
  'notifications',
  'search-service',
  'analytics-service',
  'webhook-service',
];

const endpoints = [
  'POST /v1/orders',
  'POST /v1/payments',
  'GET /v1/orders/:id',
  'GET /v1/users/:id',
  'POST /v1/auth/login',
  'POST /v1/auth/refresh',
  'POST /v1/webhooks/stripe',
  'GET /v1/reports/daily',
  'PATCH /v1/users/:id',
];

const queueNames = ['email', 'payments', 'shipments', 'webhooks', 'reports'];
const dbNames = ['orders', 'users', 'billing', 'inventory', 'sessions'];
const carriers = ['UPS', 'FedEx', 'DHL', 'USPS'];
const paymentProviders = ['Stripe', 'PayPal', 'Adyen'];
const reportNames = ['daily-orders', 'weekly-revenue', 'fraud-audit'];
const featureFlags = ['new-checkout', 'search-v2', 'beta-dashboard'];
const errorCodes = ['E_CONN_RESET', 'E_TIMEOUT', 'E_DB_LOCK', 'E_BAD_GATEWAY'];

const infoGenerators: Array<() => MessagePayload> = [
  () => {
    const orderId = randomOrderId();
    const amount = randomAmount();
    return {
      message: `Payment processed for order ${orderId} ($${amount})`,
      source: 'billing-service',
      metadata: { orderId, amount: Number(amount), provider: randomChoice(paymentProviders) },
    };
  },
  () => {
    const orderId = randomOrderId();
    const carrier = randomChoice(carriers);
    return {
      message: `Order shipped for ${orderId} via ${carrier}`,
      source: 'order-service',
      metadata: { orderId, carrier, trackingId: randomId('trk') },
    };
  },
  () => {
    const userId = randomUserId();
    return {
      message: `User created: ${userId}`,
      source: 'auth-service',
      metadata: { userId, requestId: randomId('req') },
    };
  },
  () => {
    const email = randomEmail();
    return {
      message: `Email sent to ${email}`,
      source: 'notifications',
      metadata: { email, template: 'order-confirmation' },
    };
  },
  () => {
    const key = randomId('cache');
    return {
      message: `Cache refreshed for key ${key}`,
      source: 'api-gateway',
      metadata: { cacheKey: key },
    };
  },
  () => {
    const sku = randomId('sku');
    const delta = randomInt(1, 25);
    return {
      message: `Inventory updated for ${sku} (+${delta})`,
      source: 'order-service',
      metadata: { sku, delta },
    };
  },
  () => {
    const provider = randomChoice(paymentProviders);
    const latency = randomInt(80, 450);
    return {
      message: `Webhook delivered to ${provider} in ${latency}ms`,
      source: 'webhook-service',
      metadata: { provider, latencyMs: latency },
    };
  },
  () => {
    const report = randomChoice(reportNames);
    return {
      message: `Report generated: ${report}`,
      source: 'analytics-service',
      metadata: { report, durationMs: randomInt(400, 2500) },
    };
  },
];

const warnGenerators: Array<() => MessagePayload> = [
  () => {
    const userId = randomUserId();
    const ip = randomIp();
    return {
      message: `Failed login for user ${userId} from ${ip}`,
      source: 'auth-service',
      metadata: { userId, ip, action: 'login' },
    };
  },
  () => {
    const ip = randomIp();
    const endpoint = randomChoice(endpoints);
    return {
      message: `Rate limit exceeded for ${ip} on ${endpoint}`,
      source: 'api-gateway',
      metadata: { ip, endpoint, limit: 120 },
    };
  },
  () => {
    const service = randomChoice(sources);
    const latency = randomInt(650, 2400);
    return {
      message: `Slow response from ${service} (${latency}ms)`,
      source: 'api-gateway',
      metadata: { service, latencyMs: latency },
    };
  },
  () => {
    const jobId = randomId('job');
    return {
      message: `Retry scheduled for job ${jobId}`,
      source: 'worker',
      metadata: { jobId, attempt: randomInt(2, 5) },
    };
  },
  () => {
    const queue = randomChoice(queueNames);
    const depth = randomInt(500, 4000);
    return {
      message: `Queue depth high: ${queue} (${depth} pending)`,
      source: 'worker',
      metadata: { queue, depth },
    };
  },
  () => {
    const endpoint = randomChoice(endpoints);
    return {
      message: `Deprecated API used: ${endpoint}`,
      source: 'api-gateway',
      metadata: { endpoint, clientVersion: `v${randomInt(1, 3)}.${randomInt(0, 9)}` },
    };
  },
];

const errorGenerators: Array<() => MessagePayload> = [
  () => {
    const db = randomChoice(dbNames);
    const timeout = randomInt(700, 6000);
    return {
      message: `Database timeout on ${db} after ${timeout}ms`,
      source: 'db-service',
      metadata: { db, timeoutMs: timeout },
    };
  },
  () => {
    const orderId = randomOrderId();
    const reason = randomChoice(['insufficient_funds', 'card_declined', 'fraud_suspected']);
    return {
      message: `Payment failed for order ${orderId}: ${reason}`,
      source: 'billing-service',
      metadata: { orderId, reason, provider: randomChoice(paymentProviders) },
    };
  },
  () => {
    const service = randomChoice(sources);
    const code = randomChoice(errorCodes);
    return {
      message: `Unhandled exception in ${service}: ${code}`,
      source: service,
      metadata: { service, errorCode: code, requestId: randomId('req') },
    };
  },
  () => {
    const service = randomChoice(sources);
    return {
      message: `Service unavailable: ${service}`,
      source: 'api-gateway',
      metadata: { service, status: 503 },
    };
  },
  () => {
    const host = `${randomChoice(['redis', 'postgres', 'kafka'])}-${randomInt(1, 3)}`;
    return {
      message: `Connection refused to ${host}`,
      source: 'worker',
      metadata: { host, port: randomInt(5432, 6380) },
    };
  },
  () => {
    const table = randomChoice(['orders', 'payments', 'users']);
    return {
      message: `Data integrity violation on ${table}`,
      source: 'db-service',
      metadata: { table, constraint: `${table}_pk` },
    };
  },
];

const debugGenerators: Array<() => MessagePayload> = [
  () => {
    const key = randomId('cache');
    return {
      message: `Cache miss for key ${key}`,
      source: 'api-gateway',
      metadata: { cacheKey: key },
    };
  },
  () => {
    const requestId = randomId('req');
    return {
      message: `Debug trace for request ${requestId}`,
      source: 'api-gateway',
      metadata: { requestId, spanCount: randomInt(4, 16) },
    };
  },
  () => {
    const flag = randomChoice(featureFlags);
    const value = Math.random() < 0.5;
    return {
      message: `Feature flag ${flag} evaluated to ${value}`,
      source: 'api-gateway',
      metadata: { flag, value },
    };
  },
  () => {
    const duration = randomInt(10, 220);
    return {
      message: `SQL query executed in ${duration}ms`,
      source: 'db-service',
      metadata: { durationMs: duration, db: randomChoice(dbNames) },
    };
  },
  () => {
    const workerId = randomId('worker');
    return {
      message: `Worker heartbeat from ${workerId}`,
      source: 'worker',
      metadata: { workerId, region: randomChoice(['us-east', 'us-west', 'eu-central']) },
    };
  },
];

const generatorsBySeverity: Record<Severity, Array<() => MessagePayload>> = {
  INFO: infoGenerators,
  WARN: warnGenerators,
  ERROR: errorGenerators,
  DEBUG: debugGenerators,
};

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAmount(): string {
  return (Math.random() * 500 + 5).toFixed(2);
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomUserId(): string {
  return `user_${randomInt(1000, 9999)}`;
}

function randomOrderId(): string {
  return `ord_${randomInt(100000, 999999)}`;
}

function randomEmail(): string {
  return `user${randomInt(100, 9999)}@example.com`;
}

function randomIp(): string {
  return `${randomInt(10, 250)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

function pickSeverity(): Severity {
  const roll = Math.random();
  if (roll < 0.7) return 'INFO';
  if (roll < 0.9) return 'WARN';
  if (roll < 0.98) return 'ERROR';
  return 'DEBUG';
}

function randomNormal(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}

function pickCluster() {
  const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const cluster of clusters) {
    roll -= cluster.weight;
    if (roll <= 0) return cluster;
  }
  return clusters[clusters.length - 1];
}

function randomTimestamp(): Date {
  const cluster = pickCluster();
  const offsetDays = clamp(
    randomNormal(cluster.centerDaysAgo, cluster.spreadDays),
    0,
    30,
  );
  return new Date(NOW_MS - offsetDays * DAY_MS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildMessage(severity: Severity): MessagePayload {
  const generator = randomChoice(generatorsBySeverity[severity]);
  const payload = generator();
  if (Math.random() < 0.35) {
    return { ...payload, metadata: null };
  }
  return payload;
}

async function seedTenant(
  repository: Repository<Log>,
  tenantId: string,
  count: number,
): Promise<void> {
  let inserted = 0;
  const batch: LogInsert[] = [];

  for (let i = 0; i < count; i += 1) {
    const severity = pickSeverity();
    const { message, source, metadata } = buildMessage(severity);

    batch.push({
      tenantId,
      timestamp: randomTimestamp(),
      severity,
      source,
      message,
      metadata,
    });

    if (batch.length === BATCH_SIZE) {
      // GOOD: Type assertion for TypeORM insert (metadata field causes strict type issues)
      await repository.insert(batch as any);
      inserted += batch.length;
      batch.length = 0;

      if (inserted % LOG_PROGRESS_EVERY === 0 || inserted === count) {
        console.log(`[${tenantId}] Inserted ${inserted.toLocaleString()} logs`);
      }
    }
  }

  if (batch.length > 0) {
    // GOOD: Type assertion for TypeORM insert (metadata field causes strict type issues)
    await repository.insert(batch as any);
    inserted += batch.length;
    console.log(`[${tenantId}] Inserted ${inserted.toLocaleString()} logs`);
  }
}

async function seed(): Promise<void> {
  const total = Object.values(TENANT_COUNTS).reduce((sum, count) => sum + count, 0);

  console.log(`Seeding ${total.toLocaleString()} logs across tenants...`);
  await AppDataSource.initialize();

  try {
    const repository = AppDataSource.getRepository(Log);
    for (const [tenantId, count] of Object.entries(TENANT_COUNTS)) {
      console.log(`Starting ${tenantId} (${count.toLocaleString()} logs)...`);
      await seedTenant(repository, tenantId, count);
    }
    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
