import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  NotificationDeliveryFeedPage,
  NotificationDeliveryRow,
  StaffNotificationFeedPage,
  StaffNotificationRow,
} from '@wrap-roll/contracts';
import { PrismaService } from '../prisma/prisma.service';

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

function mapDelivery(r: {
  id: string;
  channel: string;
  orderId: string | null;
  templateKey: string | null;
  toMasked: string | null;
  bodyPreview: string | null;
  status: string;
  error: string | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
}): NotificationDeliveryRow {
  return {
    id: r.id,
    channel: r.channel,
    orderId: r.orderId,
    templateKey: r.templateKey,
    toMasked: r.toMasked,
    bodyPreview: r.bodyPreview,
    status: r.status,
    error: r.error,
    metadataJson: r.metadataJson ?? undefined,
    createdAt: r.createdAt,
  };
}

function mapStaff(r: {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: Date | null;
  kind: string;
  createdAt: Date;
}): StaffNotificationRow {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    linkUrl: r.linkUrl,
    readAt: r.readAt,
    kind: r.kind,
    createdAt: r.createdAt,
  };
}

@Injectable()
export class NotificationApiService {
  constructor(private readonly prisma: PrismaService) {}

  async listDeliveries(params: {
    take?: number;
    cursor?: string | null;
    orderId?: string | null;
  }): Promise<NotificationDeliveryFeedPage> {
    const cursorDecoded = params.cursor ? decodeCursor(params.cursor) : null;
    const cursorWhere: Prisma.NotificationDeliveryWhereInput | undefined = cursorDecoded
      ? {
          OR: [
            { createdAt: { lt: cursorDecoded.createdAt } },
            {
              AND: [{ createdAt: cursorDecoded.createdAt }, { id: { lt: cursorDecoded.id } }],
            },
          ],
        }
      : undefined;
    const orderFilter: Prisma.NotificationDeliveryWhereInput = params.orderId?.trim()
      ? { orderId: params.orderId.trim() }
      : {};

    const where: Prisma.NotificationDeliveryWhereInput = cursorWhere
      ? Object.keys(orderFilter).length > 0
        ? { AND: [orderFilter, cursorWhere] }
        : cursorWhere
      : orderFilter;

    const pageSize = Math.min(Math.max(Number(params.take ?? 50), 1), 200);
    const rows = await this.prisma.notificationDelivery.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });
    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return {
      items: slice.map(mapDelivery),
      nextCursor,
    };
  }

  async listInbox(
    recipientUserId: string,
    params: { take?: number; cursor?: string | null; unreadOnly?: boolean },
  ): Promise<StaffNotificationFeedPage> {
    const cursorDecoded = params.cursor ? decodeCursor(params.cursor) : null;
    const unreadFilter: Prisma.StaffNotificationWhereInput =
      params.unreadOnly === true ? { readAt: null } : {};

    const cursorWhere: Prisma.StaffNotificationWhereInput | undefined = cursorDecoded
      ? {
          OR: [
            { createdAt: { lt: cursorDecoded.createdAt } },
            {
              AND: [{ createdAt: cursorDecoded.createdAt }, { id: { lt: cursorDecoded.id } }],
            },
          ],
        }
      : undefined;

    const base: Prisma.StaffNotificationWhereInput = {
      recipientUserId,
      ...unreadFilter,
    };

    const where: Prisma.StaffNotificationWhereInput = cursorWhere
      ? { AND: [base, cursorWhere] }
      : base;

    const pageSize = Math.min(Math.max(Number(params.take ?? 50), 1), 200);
    const rows = await this.prisma.staffNotification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
    });
    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const unreadCount = await this.prisma.staffNotification.count({
      where: { recipientUserId, readAt: null },
    });

    return {
      items: slice.map(mapStaff),
      nextCursor,
      unreadCount,
    };
  }

  async markInboxRead(recipientUserId: string, id: string): Promise<StaffNotificationRow> {
    const row = await this.prisma.staffNotification.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notification not found');
    if (row.recipientUserId !== recipientUserId) {
      throw new ForbiddenException('Not your notification');
    }
    const updated = await this.prisma.staffNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return mapStaff(updated);
  }

  async markInboxReadAll(recipientUserId: string): Promise<{ updated: number }> {
    const res = await this.prisma.staffNotification.updateMany({
      where: { recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}
