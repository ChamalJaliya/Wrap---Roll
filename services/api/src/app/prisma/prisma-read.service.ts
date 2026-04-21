import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Optional read replica for read-heavy paths (e.g. `getQueue`).
 * Set `DATABASE_READ_URL` to enable; otherwise inject `undefined` and callers use the primary.
 *
 * Replication lag: `businessSettings` + queue rows may be slightly stale — acceptable for SLA display;
 * writes always go through {@link PrismaService}.
 */
@Injectable()
export class PrismaReadService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    const max = Math.min(
      50,
      Math.max(1, Number(process.env.PRISMA_READ_POOL_MAX ?? 10) || 10),
    );
    const pool = new Pool({
      connectionString,
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[PrismaReadService] pool error', err);
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}

export function createPrismaReadServiceFromEnv(): PrismaReadService | undefined {
  const url = process.env.DATABASE_READ_URL?.trim();
  if (!url) return undefined;
  return new PrismaReadService(url);
}
