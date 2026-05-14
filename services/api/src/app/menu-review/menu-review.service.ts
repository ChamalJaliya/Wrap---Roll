import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateMenuItemReviewBodySchema,
  CreateMenuItemReviewReplyBodySchema,
  AdminPatchMenuItemReviewBodySchema,
  evaluateMenuItemReviewEligibility,
  type AdminMenuItemReviewRow,
  type AdminPatchMenuItemReviewBody,
  type DishReviewHintRow,
  type MenuItemReviewSummary,
  type MenuItemReviewVisibility,
  type PublicMenuItemReviewList,
  type PublicMenuItemReviewReplyRow,
  type PublicMenuItemReviewRow,
} from '@wrap-roll/contracts';
import { Prisma } from '@prisma/client';
import type { Order, OrderItem, PrismaClient } from '../prisma-generated';
import { PrismaService } from '../prisma/prisma.service';

type OrderWithItems = Order & { items: OrderItem[] };

function asPhotoUrls(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === 'string');
}

function reviewerDisplayLabel(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  if (!t) return 'Customer';
  const first = t.split(/\s+/)[0] ?? t;
  return first.length > 40 ? `${first.slice(0, 40)}…` : first;
}

@Injectable()
export class MenuReviewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async refreshPublicStatsForMenuItem(menuItemId: string): Promise<void> {
    const agg = await this.prisma.menuItemReview.aggregate({
      where: { menuItemId, visibility: 'public' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const count = agg._count._all;
    const avg = agg._avg.rating;
    await this.prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        reviewCount: count,
        averageRating:
          count > 0 && avg !== null && avg !== undefined
            ? new Prisma.Decimal(Number(avg).toFixed(2))
            : null,
      },
    });
  }

  async createReview(input: {
    actorCustomerId: string;
    orderId: string;
    menuItemId: string;
    body: unknown;
  }) {
    const parsed = CreateMenuItemReviewBodySchema.parse(input.body);
    const comment =
      parsed.comment === undefined || parsed.comment === null
        ? null
        : parsed.comment.trim() || null;
    const photoUrls = parsed.photoUrls ?? [];

    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, customerId: input.actorCustomerId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const orderContains = order.items.some((i) => i.menuItemId === input.menuItemId);
    const gate = evaluateMenuItemReviewEligibility({
      order: {
        status: order.status,
        paymentStatus: order.paymentStatus,
        source: order.source,
        fulfillmentType: order.fulfillmentType,
        customerId: order.customerId,
        placedAt: order.placedAt,
      },
      actorCustomerId: input.actorCustomerId,
      menuItemId: input.menuItemId,
      orderContainsMenuItem: orderContains,
    });
    if (gate.ok === false) {
      throw new BadRequestException(`Review not allowed (${gate.code})`);
    }

    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: input.menuItemId, isActive: true },
      select: { id: true },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    try {
      const row = await this.prisma.menuItemReview.create({
        data: {
          menuItemId: input.menuItemId,
          orderId: input.orderId,
          customerId: input.actorCustomerId,
          rating: parsed.rating,
          comment,
          photoUrls: photoUrls as unknown as Prisma.InputJsonValue,
          visibility: 'pending',
        },
      });
      return {
        id: row.id,
        menuItemId: row.menuItemId,
        orderId: row.orderId,
        rating: row.rating,
        comment: row.comment,
        photoUrls: asPhotoUrls(row.photoUrls),
        visibility: row.visibility,
        createdAt: row.createdAt.toISOString(),
      };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        throw new ConflictException('You already reviewed this dish for this order');
      }
      throw e;
    }
  }

  async getPublicSummary(menuItemId: string): Promise<MenuItemReviewSummary> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, isActive: true },
      select: { id: true, averageRating: true, reviewCount: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return {
      menuItemId: item.id,
      averageRating:
        item.averageRating !== null && item.averageRating !== undefined
          ? Number(item.averageRating.toString())
          : null,
      reviewCount: item.reviewCount ?? 0,
    };
  }

  async listPublicReviews(
    menuItemId: string,
    page = 1,
    limit = 20,
  ): Promise<PublicMenuItemReviewList> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, isActive: true },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');

    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));
    const skip = (safePage - 1) * safeLimit;

    const where = { menuItemId, visibility: 'public' as const };

    const [rows, total] = await Promise.all([
      this.prisma.menuItemReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        select: {
          id: true,
          menuItemId: true,
          rating: true,
          comment: true,
          photoUrls: true,
          createdAt: true,
          customer: { select: { name: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            take: 20,
            select: {
              id: true,
              authorKind: true,
              authorLabel: true,
              body: true,
              photoUrls: true,
              createdAt: true,
            },
          },
          _count: { select: { reactions: true, replies: true } },
        },
      }),
      this.prisma.menuItemReview.count({ where }),
    ]);

    const items: PublicMenuItemReviewRow[] = rows.map((r) => {
      const replies: PublicMenuItemReviewReplyRow[] = r.replies.map((rep) => ({
        id: rep.id,
        authorKind: rep.authorKind === 'staff' ? 'staff' : 'customer',
        authorLabel: rep.authorLabel,
        body: rep.body,
        photoUrls: asPhotoUrls(rep.photoUrls),
        createdAt: rep.createdAt.toISOString(),
      }));
      return {
        id: r.id,
        menuItemId: r.menuItemId,
        rating: r.rating,
        comment: r.comment,
        photoUrls: asPhotoUrls(r.photoUrls),
        authorLabel: reviewerDisplayLabel(r.customer.name),
        helpfulCount: r._count.reactions,
        replyCount: r._count.replies,
        replies,
        createdAt: r.createdAt.toISOString(),
      };
    });

    const lastPage = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        lastPage,
        hasNext: safePage * safeLimit < total,
        hasPrev: safePage > 1,
      },
    };
  }

  async listAdmin(input: {
    page: number;
    limit: number;
    visibility?: MenuItemReviewVisibility;
    menuItemId?: string;
  }) {
    const safePage = Math.max(1, Math.floor(input.page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(input.limit)));
    const skip = (safePage - 1) * safeLimit;

    const where: {
      menuItemId?: string;
      visibility?: MenuItemReviewVisibility;
    } = {};
    if (input.visibility) where.visibility = input.visibility;
    if (input.menuItemId) where.menuItemId = input.menuItemId;

    const [rows, total] = await Promise.all([
      this.prisma.menuItemReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          menuItem: { select: { name: true } },
          customer: { select: { name: true, email: true } },
          _count: { select: { reactions: true, replies: true } },
        },
      }),
      this.prisma.menuItemReview.count({ where }),
    ]);

    const items: AdminMenuItemReviewRow[] = rows.map((r) => ({
      id: r.id,
      menuItemId: r.menuItemId,
      menuItemName: r.menuItem.name,
      orderId: r.orderId,
      customerId: r.customerId,
      customerName: r.customer.name,
      customerEmail: r.customer.email,
      rating: r.rating,
      comment: r.comment,
      photoUrls: asPhotoUrls(r.photoUrls),
      replyCount: r._count.replies,
      helpfulCount: r._count.reactions,
      visibility: r.visibility as MenuItemReviewVisibility,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    const lastPage = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        lastPage,
        hasNext: safePage * safeLimit < total,
        hasPrev: safePage > 1,
      },
    };
  }

  async patchAdminReview(
    reviewId: string,
    body: AdminPatchMenuItemReviewBody,
  ): Promise<AdminMenuItemReviewRow> {
    const parsed = AdminPatchMenuItemReviewBodySchema.parse(body);
    const existing = await this.prisma.menuItemReview.findUnique({
      where: { id: reviewId },
      select: { id: true, menuItemId: true },
    });
    if (!existing) throw new NotFoundException('Review not found');

    const updateData: {
      visibility: MenuItemReviewVisibility;
      adminNote?: string | null;
    } = {
      visibility: parsed.visibility,
    };
    if (parsed.adminNote !== undefined) {
      updateData.adminNote =
        parsed.adminNote === null ? null : parsed.adminNote.trim() || null;
    }

    await this.prisma.menuItemReview.update({
      where: { id: reviewId },
      data: updateData,
    });

    await this.refreshPublicStatsForMenuItem(existing.menuItemId);

    const row = await this.prisma.menuItemReview.findUniqueOrThrow({
      where: { id: reviewId },
      include: {
        menuItem: { select: { name: true } },
        customer: { select: { name: true, email: true } },
        _count: { select: { reactions: true, replies: true } },
      },
    });

    return {
      id: row.id,
      menuItemId: row.menuItemId,
      menuItemName: row.menuItem.name,
      orderId: row.orderId,
      customerId: row.customerId,
      customerName: row.customer.name,
      customerEmail: row.customer.email,
      rating: row.rating,
      comment: row.comment,
      photoUrls: asPhotoUrls(row.photoUrls),
      replyCount: row._count.replies,
      helpfulCount: row._count.reactions,
      visibility: row.visibility as MenuItemReviewVisibility,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Enriches Prisma `Order[]` with `dishReviewHints` for the authenticated customer. */
  async attachDishReviewHintsToOrders(customerId: string, orders: OrderWithItems[]) {
    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const reviews = await this.prisma.menuItemReview.findMany({
      where: { customerId, orderId: { in: orderIds } },
      select: {
        orderId: true,
        menuItemId: true,
        id: true,
        rating: true,
        comment: true,
        photoUrls: true,
        visibility: true,
        createdAt: true,
        _count: { select: { reactions: true, replies: true } },
      },
    });
    const reviewByKey = new Map<string, (typeof reviews)[number]>();
    for (const r of reviews) {
      reviewByKey.set(`${r.orderId}:${r.menuItemId}`, r);
    }

    return orders.map((order) => {
      const byMenu = new Map<string, { name: string }>();
      for (const line of order.items) {
        if (!byMenu.has(line.menuItemId)) {
          byMenu.set(line.menuItemId, { name: line.name });
        }
      }

      const hints: DishReviewHintRow[] = [];
      for (const [menuItemId, { name }] of byMenu) {
        const existing = reviewByKey.get(`${order.id}:${menuItemId}`);
        if (existing) {
          hints.push({
            menuItemId,
            name,
            canSubmit: false,
            reasonCode: 'ALREADY_REVIEWED',
            existingReview: {
              id: existing.id,
              rating: existing.rating,
              comment: existing.comment ?? undefined,
              photoUrls: asPhotoUrls(existing.photoUrls),
              visibility: existing.visibility as MenuItemReviewVisibility,
              createdAt: existing.createdAt.toISOString(),
              helpfulCount: existing._count.reactions,
              replyCount: existing._count.replies,
            },
          });
          continue;
        }

        const gate = evaluateMenuItemReviewEligibility({
          order: {
            status: order.status,
            paymentStatus: order.paymentStatus,
            source: order.source,
            fulfillmentType: order.fulfillmentType,
            customerId: order.customerId,
            placedAt: order.placedAt,
          },
          actorCustomerId: customerId,
          menuItemId,
          orderContainsMenuItem: true,
        });

        hints.push({
          menuItemId,
          name,
          canSubmit: gate.ok,
          reasonCode: gate.ok === false ? gate.code : undefined,
        });
      }

      return { ...order, dishReviewHints: hints };
    });
  }

  async addCustomerReply(input: { actorCustomerId: string; reviewId: string; body: unknown }) {
    const parsed = CreateMenuItemReviewReplyBodySchema.parse(input.body);
    const reviewId = input.reviewId.trim();
    if (!reviewId) throw new BadRequestException('Review id is required');
    const review = await this.prisma.menuItemReview.findFirst({
      where: { id: reviewId },
      select: { id: true, visibility: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.visibility !== 'public') {
      throw new ForbiddenException('This review is not public yet');
    }

    const actor = await this.prisma.customer.findUnique({
      where: { id: input.actorCustomerId },
      select: { name: true },
    });
    if (!actor) throw new NotFoundException('Customer not found');

    const row = await this.prisma.menuItemReviewReply.create({
      data: {
        reviewId,
        authorKind: 'customer',
        customerId: input.actorCustomerId,
        authorLabel: reviewerDisplayLabel(actor.name),
        body: parsed.body,
        photoUrls: parsed.photoUrls as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      id: row.id,
      authorKind: 'customer' as const,
      authorLabel: row.authorLabel,
      body: row.body,
      photoUrls: asPhotoUrls(row.photoUrls),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async addStaffReply(input: { staffSub: string; authorLabel: string; reviewId: string; body: unknown }) {
    const parsed = CreateMenuItemReviewReplyBodySchema.parse(input.body);
    const reviewId = input.reviewId.trim();
    if (!reviewId) throw new BadRequestException('Review id is required');
    const review = await this.prisma.menuItemReview.findFirst({
      where: { id: reviewId },
      select: { id: true, visibility: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.visibility !== 'public') {
      throw new ForbiddenException('This review is not public yet');
    }

    const label = (input.authorLabel ?? '').trim() || 'Team';
    const row = await this.prisma.menuItemReviewReply.create({
      data: {
        reviewId,
        authorKind: 'staff',
        staffUserId: input.staffSub,
        authorLabel: label.length > 120 ? `${label.slice(0, 120)}…` : label,
        body: parsed.body,
        photoUrls: parsed.photoUrls as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      id: row.id,
      authorKind: 'staff' as const,
      authorLabel: row.authorLabel,
      body: row.body,
      photoUrls: asPhotoUrls(row.photoUrls),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async toggleReviewHelpful(input: { actorCustomerId: string; reviewId: string }) {
    const reviewId = input.reviewId.trim();
    if (!reviewId) throw new BadRequestException('Review id is required');

    const row = await this.prisma.menuItemReview.findFirst({
      where: { id: reviewId },
      select: { id: true, visibility: true },
    });
    if (!row) throw new NotFoundException('Review not found');
    if (row.visibility !== 'public') {
      throw new ForbiddenException('This review is not public yet');
    }

    const actorKey = `c:${input.actorCustomerId}`;
    const existing = await this.prisma.menuItemReviewReaction.findFirst({
      where: { reviewId, actorKey },
    });
    if (existing) {
      await this.prisma.menuItemReviewReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.menuItemReviewReaction.create({
        data: { reviewId, actorKey },
      });
    }
    const helpfulCount = await this.prisma.menuItemReviewReaction.count({
      where: { reviewId },
    });
    return { reacted: !existing, helpfulCount };
  }
}
