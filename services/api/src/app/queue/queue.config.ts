import type { QueueOptions } from 'bullmq';

type RedisConnection = NonNullable<QueueOptions['connection']>;

function parseBool(input: string | undefined, fallback: boolean): boolean {
  if (input == null) return fallback;
  const v = input.trim().toLowerCase();
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return fallback;
}

function parseNumber(input: string | undefined, fallback: number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function isBullMqEnabled(): boolean {
  const hasRedis = String(process.env.REDIS_URL ?? '').trim().length > 0;
  const defaultEnabled = hasRedis;
  return parseBool(process.env.BULLMQ_ENABLED, defaultEnabled);
}

export function queuePrefix(): string {
  const raw = String(process.env.BULLMQ_PREFIX ?? 'wraproll').trim();
  return raw.length > 0 ? raw : 'wraproll';
}

export function queueDefaultJobOptions() {
  return {
    attempts: Math.max(1, parseNumber(process.env.BULLMQ_DEFAULT_ATTEMPTS, 3)),
    removeOnComplete: Math.max(10, parseNumber(process.env.BULLMQ_REMOVE_ON_COMPLETE, 1000)),
    removeOnFail: Math.max(10, parseNumber(process.env.BULLMQ_REMOVE_ON_FAIL, 3000)),
    backoff: {
      type: 'exponential',
      delay: Math.max(100, parseNumber(process.env.BULLMQ_DEFAULT_BACKOFF_MS, 2000)),
    } as const,
  };
}

function redisRetryStrategy(times: number): number | null {
  const isProduction = String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  const defaultRetries = isProduction ? 20 : 0;
  const maxRetries = Math.max(0, parseNumber(process.env.REDIS_MAX_RETRY_ATTEMPTS, defaultRetries));
  if (times > maxRetries) return null;
  return Math.min(1000 * times, 5000);
}

export function bullMqConnectionFromEnv(): RedisConnection {
  const redisUrl = String(process.env.REDIS_URL ?? '').trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL is required when BullMQ is enabled.');
  }

  const parsed = new URL(redisUrl);
  const isTls = parsed.protocol === 'rediss:';
  const db = parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : undefined;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : undefined,
    // BullMQ worker internals require this to be null.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: redisRetryStrategy,
    reconnectOnError: () => false,
    ...(isTls ? { tls: {} } : {}),
  };
}
