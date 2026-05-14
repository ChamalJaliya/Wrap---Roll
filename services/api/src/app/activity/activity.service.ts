import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OpsActivityEventRow, OpsActivityFeedPage } from '@wrap-roll/contracts';
import { PrismaService } from '../prisma/prisma.service';

type OpsActivityDbRow = {
  id: string;
  app: string;
  entityType: string;
  entityId: string;
  eventType: string;
  summary: string;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  metadataJson: unknown;
  createdAt: Date;
};

export type GlobalActivityQuery = {
  take?: number;
  entityType?: string;
  app?: string;
  actorRole?: string;
  eventType?: string;
  q?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
};

function mapRow(row: OpsActivityDbRow): OpsActivityEventRow {
  return {
    id: row.id,
    app: (row.app as OpsActivityEventRow['app']) ?? 'system',
    entityType: row.entityType,
    entityId: row.entityId,
    eventType: row.eventType,
    summary: row.summary,
    actor: {
      userId: row.actorUserId,
      name: row.actorName,
      role: row.actorRole,
      email: row.actorEmail,
    },
    metadataJson: row.metadataJson ?? null,
    createdAt: row.createdAt,
  };
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id }), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const j = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { t?: string; id?: string };
    if (typeof j.t !== 'string' || typeof j.id !== 'string') return null;
    const createdAt = new Date(j.t);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: j.id };
  } catch {
    return null;
  }
}

/**
 * `app` = surface (e.g. client = storefront). `actorRole` = user role (e.g. CLIENT = shopper).
 */
function appAndActorWhere(
  app: string | undefined,
  actorRole: string | undefined,
): Prisma.OpsActivityEventWhereInput {
  const a = app?.trim() || undefined;
  const raw = actorRole?.trim();
  if (!raw) {
    return a ? { app: a } : {};
  }
  const role = raw.toUpperCase();
  return { ...(a ? { app: a } : {}), actorRole: role };
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async processQueueJob(
    payload: {
      eventType?: string;
      entityType?: string;
      entityId?: string;
      correlationId?: string | null;
      payload?: unknown;
    },
    attemptsMade = 0,
  ): Promise<void> {
    const eventType = String(payload.eventType ?? '').trim();
    const entityType = String(payload.entityType ?? '').trim();
    const entityId = String(payload.entityId ?? '').trim();
    if (!eventType || !entityType || !entityId) return;
    await this.prisma.opsActivityEvent.create({
      data: {
        app: 'system',
        entityType,
        entityId,
        eventType: 'activity.queue_processed',
        summary: `Queue worker processed ${eventType}`,
        metadataJson: {
          sourceEventType: eventType,
          correlationId: payload.correlationId ?? null,
          retryAttempt: attemptsMade,
        },
      },
    });
  }

  async listByOrderId(orderId: string): Promise<OpsActivityEventRow[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const events = await this.prisma.opsActivityEvent.findMany({
      where: { entityType: 'order', entityId: orderId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return events.map((e) => mapRow(e as OpsActivityDbRow));
  }

  async listGlobal(query: GlobalActivityQuery): Promise<OpsActivityFeedPage> {
    const q = String(query.q ?? '').trim();
    const fromDate = query.from ? new Date(query.from) : null;
    const toDate = query.to ? new Date(query.to) : null;
    const hasValidFrom = Boolean(fromDate && !Number.isNaN(fromDate.getTime()));
    const hasValidTo = Boolean(toDate && !Number.isNaN(toDate.getTime()));
    const createdAtFilter =
      hasValidFrom || hasValidTo
        ? {
            ...(hasValidFrom ? { gte: fromDate as Date } : {}),
            ...(hasValidTo ? { lte: toDate as Date } : {}),
          }
        : undefined;

    const baseWhere: Prisma.OpsActivityEventWhereInput = {
      ...appAndActorWhere(query.app, query.actorRole),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(query.eventType
        ? { eventType: { contains: query.eventType.trim(), mode: 'insensitive' as const } }
        : {}),
      ...(q
        ? {
            OR: [
              { actorName: { contains: q, mode: 'insensitive' as const } },
              { actorEmail: { contains: q, mode: 'insensitive' as const } },
              { actorRole: { contains: q, mode: 'insensitive' as const } },
              { summary: { contains: q, mode: 'insensitive' as const } },
              { entityId: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const cursorDecoded = query.cursor ? decodeCursor(query.cursor) : null;
    const cursorWhere: Prisma.OpsActivityEventWhereInput | undefined = cursorDecoded
      ? {
          OR: [
            { createdAt: { lt: cursorDecoded.createdAt } },
            {
              AND: [{ createdAt: cursorDecoded.createdAt }, { id: { lt: cursorDecoded.id } }],
            },
          ],
        }
      : undefined;

    const where: Prisma.OpsActivityEventWhereInput = cursorWhere
      ? Object.keys(baseWhere).length > 0
        ? { AND: [baseWhere, cursorWhere] }
        : cursorWhere
      : baseWhere;

    const pageSize = Math.min(Math.max(Number(query.take ?? 100), 1), 300);
    const rows = await this.prisma.opsActivityEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return {
      items: slice.map((e) => mapRow(e as OpsActivityDbRow)),
      nextCursor,
    };
  }

  /** Non-paginated list for legacy `GET /orders/activity`. */
  async listGlobalLegacy(query: Omit<GlobalActivityQuery, 'cursor'>): Promise<OpsActivityEventRow[]> {
    const page = await this.listGlobal({ ...query, cursor: null });
    return page.items;
  }

  /** Count events strictly before `cutoff` (same predicate as {@link purgeBefore}). */
  async countBefore(cutoff: Date): Promise<number> {
    return this.prisma.opsActivityEvent.count({
      where: { createdAt: { lt: cutoff } },
    });
  }

  /** Hard-delete all ops activity events with `createdAt` strictly before `cutoff`. */
  async purgeBefore(cutoff: Date): Promise<{ deleted: number }> {
    const result = await this.prisma.opsActivityEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deleted: result.count };
  }
}
