import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import Redis from 'ioredis';
import { Observable, Subject, interval, merge } from 'rxjs';
import { finalize, map, takeUntil } from 'rxjs/operators';

type CacheEntry = { value: string; expiresAt: number };

export const QUEUE_DIRTY_CHANNEL = 'queue:dirty';
const QUEUE_REV_KEY = 'queue:rev:global';

export type QueueDirtyPayload = {
  rev: number;
  orderId?: string;
  type?: string;
  ts: number;
};

/**
 * Short-TTL cache for `getQueue` JSON (persona-specific key).
 * - Default: in-process `Map` (per API instance; use short TTL).
 * - When `REDIS_URL` is set: shared Redis (multiple replicas).
 *
 * Disabled when `QUEUE_CACHE_TTL_MS` is 0 or unset (default 0).
 *
 * Global revision (`queue:rev:global`) invalidates cache keys when bumped; optional PUBLISH for SSE.
 */
@Injectable()
export class QueueResponseCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueResponseCacheService.name);
  private readonly memory = new Map<string, CacheEntry>();
  private redis: Redis | null = null;
  private readonly keyPrefix = 'queue:';
  private redisInitWarned = false;
  /** In-process rev when Redis is unavailable (single-instance semantics). */
  private memoryRev = 0;

  constructor() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      try {
        const isProduction = String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
        const defaultRetries = isProduction ? 20 : 0;
        const maxRetries = Math.max(
          0,
          Number.parseInt(String(process.env.REDIS_MAX_RETRY_ATTEMPTS ?? defaultRetries), 10) ||
            defaultRetries,
        );
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > maxRetries) return null;
            return Math.min(1000 * times, 5000);
          },
          reconnectOnError: () => false,
        });
        this.redis.on('error', (e) => {
          if (this.redisInitWarned) return;
          this.redisInitWarned = true;
          this.logger.warn(`Redis error; queue cache falls back to memory: ${String(e)}`);
        });
        void this.redis.connect().catch((e) => {
          if (!this.redisInitWarned) {
            this.redisInitWarned = true;
            this.logger.warn(`Redis connect failed; queue cache falls back to memory: ${String(e)}`);
          }
          this.redis?.disconnect();
          this.redis = null;
        });
      } catch (e) {
        this.logger.warn(`Redis init failed: ${String(e)}`);
        this.redis = null;
      }
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  /** Current global queue revision for cache keying (always defined). */
  async getGlobalRevForCache(): Promise<number> {
    if (this.redis && this.redis.status === 'ready') {
      try {
        const raw = await this.redis.get(QUEUE_REV_KEY);
        const n = raw != null ? Number.parseInt(String(raw), 10) : 0;
        return Number.isFinite(n) ? n : 0;
      } catch {
        return this.memoryRev;
      }
    }
    return this.memoryRev;
  }

  /**
   * Bump global revision and notify subscribers. Safe to fire-and-forget.
   * When Redis is down, only in-memory rev advances (SSE pub/sub will not fire).
   */
  async bumpGlobalRevAndPublish(meta: { orderId?: string; type?: string } = {}): Promise<void> {
    let rev: number;
    if (this.redis && this.redis.status === 'ready') {
      try {
        rev = await this.redis.incr(QUEUE_REV_KEY);
      } catch (e) {
        this.logger.warn(`queue rev incr failed: ${String(e)}`);
        this.memoryRev += 1;
        return;
      }
      const payload: QueueDirtyPayload = {
        rev,
        ts: Date.now(),
        ...(meta.orderId ? { orderId: meta.orderId } : {}),
        ...(meta.type ? { type: meta.type } : {}),
      };
      try {
        await this.redis.publish(QUEUE_DIRTY_CHANNEL, JSON.stringify(payload));
      } catch (e) {
        this.logger.warn(`queue publish failed: ${String(e)}`);
      }
    } else {
      this.memoryRev += 1;
    }
    const logPub = process.env.QUEUE_SSE_DEBUG === '1';
    if (logPub) {
      this.logger.log(JSON.stringify({ msg: 'queue.bump', ...meta }));
    }
  }

  /**
   * SSE stream of `queue:dirty` messages + heartbeat comments for proxies/LBs.
   */
  queueDirtyStream$(req: IncomingMessage): Observable<MessageEvent> {
    const stop$ = new Subject<void>();
    const onClose = () => {
      stop$.next();
      stop$.complete();
    };
    req.on('close', onClose);
    req.on('aborted', onClose);

    const heartbeatMs = Math.max(
      5000,
      Number(process.env.QUEUE_SSE_HEARTBEAT_MS ?? 25_000) || 25_000,
    );

    if (!this.redis || this.redis.status !== 'ready') {
      return interval(heartbeatMs).pipe(
        map(
          () =>
            ({
              data: '',
              comment: 'hb',
            }) as MessageEvent,
        ),
        takeUntil(stop$),
        finalize(() => {
          req.off('close', onClose);
          req.off('aborted', onClose);
        }),
      );
    }

    const sub = this.redis.duplicate();
    const connectSub = async () => {
      try {
        await sub.subscribe(QUEUE_DIRTY_CHANNEL);
      } catch (e) {
        this.logger.warn(`SSE subscribe failed: ${String(e)}`);
      }
    };
    void connectSub();

    const fromRedis = new Observable<MessageEvent>((observer) => {
      const onMessage = (_ch: string, message: string) => {
        observer.next({ data: message } as MessageEvent);
      };
      sub.on('message', onMessage);
      return () => {
        sub.off('message', onMessage);
      };
    });

    return merge(
      fromRedis,
      interval(heartbeatMs).pipe(
        map(() => ({ data: '', comment: 'hb' }) as MessageEvent),
      ),
    ).pipe(
      takeUntil(stop$),
      finalize(() => {
        req.off('close', onClose);
        req.off('aborted', onClose);
        void sub.quit().catch(() => undefined);
      }),
    );
  }

  async getJson(key: string): Promise<unknown | undefined> {
    const k = this.keyPrefix + key;
    if (this.redis && this.redis.status === 'ready') {
      try {
        const raw = await this.redis.get(k);
        if (raw == null) return undefined;
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return undefined;
        }
      } catch (e) {
        this.logger.warn(`queue cache redis get failed; miss: ${String(e)}`);
        return undefined;
      }
    }
    const ent = this.memory.get(k);
    if (!ent || Date.now() > ent.expiresAt) {
      this.memory.delete(k);
      return undefined;
    }
    try {
      return JSON.parse(ent.value) as unknown;
    } catch {
      return undefined;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    const k = this.keyPrefix + key;
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch (e) {
      this.logger.warn(`queue cache JSON.stringify failed; skip cache: ${String(e)}`);
      return;
    }
    const ttl = Math.max(1, ttlMs);
    if (this.redis && this.redis.status === 'ready') {
      try {
        await this.redis.set(k, raw, 'PX', ttl);
        return;
      } catch (e) {
        this.logger.warn(`queue cache redis set failed; using memory: ${String(e)}`);
      }
    }
    this.memory.set(k, { value: raw, expiresAt: Date.now() + ttl });
  }

  /** Cap memory growth when not using Redis. */
  pruneMemory(maxEntries = 500): void {
    if (this.memory.size <= maxEntries) return;
    const now = Date.now();
    for (const [k, v] of this.memory) {
      if (v.expiresAt < now) this.memory.delete(k);
    }
    if (this.memory.size <= maxEntries) return;
    const keys = [...this.memory.keys()].slice(0, this.memory.size - maxEntries);
    for (const k of keys) this.memory.delete(k);
  }
}
