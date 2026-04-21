import { createHash, randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  FulfillmentType,
  KitchenPriority,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  WrapOrderSchema,
  computeClientWebCheckoutTotals,
  normalizeCheckoutVatRate,
  parseDeliveryJson,
  computeDeliveryFeeLkr,
  type OpsActivityEventRow,
  type PaymentEventRow,
  type QueueOrder,
  type QueueMoveBlockedReason,
  type SupportOrderDetails,
  type WrapOrder,
  projectQueueOrderForPersona,
  staffRoleToResponsePersona,
  type KitchenQueueOrder,
  type CourierQueueOrder,
  type OpsQueueOrder,
  type ResponsePersona,
  SHOPPER_ROLE,
} from '@wrap-roll/contracts';
import { ZodError } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_READ } from '../prisma/prisma.tokens';
import type { PrismaReadService } from '../prisma/prisma-read.service';
import { QueueResponseCacheService } from './queue-response-cache.service';
import { StaffService } from '../staff/staff.service';
import { CouponService } from '../coupon/coupon.service';
import { CustomerService } from '../customer/customer.service';
import { RequestUser } from '../../auth/current-user.decorator';
import { normalizePaymentConfig } from '../settings/payment-config';
import { validateCustomerOrderTiming } from '../settings/operations-calendar-rules';
import { warnIfQueueProjectionAnomalies } from './queue-projection-warn';
import { buildQueueOrderFindManyArgs } from './order-queue-find';
import { LocationService } from '../location/location.service';
import { ActivityService } from '../activity/activity.service';
import { OutboxService } from '../outbox/outbox.service';
import { INVENTORY_JOB } from '../inventory/inventory.constants';
import { NOTIFICATION_JOB } from '../notification/notification.constants';
import { PRINT_JOB } from '../print/print.constants';

type BusinessSettingsScheduleSlice = {
  paymentJson: unknown;
  deliveryJson: unknown;
  openingTimeMinutes: unknown;
  closingTimeMinutes: unknown;
  minLeadTimeMinutes: unknown;
  scheduleSameDayOnly: unknown;
  timezone?: unknown;
  operationsCalendarJson?: unknown;
  checkoutVatRate?: unknown;
};

/** Policy + schedule inputs for `canTransition` / queue `blockedReasonsByStatus`. */
type OrderTransitionPolicyContext = {
  paymentStatus?: PaymentStatus;
  fulfillmentType?: FulfillmentType;
  paymentMethod?: PaymentMethod;
  source?: OrderSource;
  transactionId?: string | null;
  courierId?: string | null;
  actorSub?: string;
  estimatedReadyTime?: Date | string | null;
  placedAt?: Date | string | null;
  minLeadMinutes?: number;
};

type PaymentEventDbRow = {
  id: string;
  eventType: string;
  paymentMethod: PaymentMethod | null;
  actorRole: string | null;
  actorUserId: string | null;
  note: string | null;
  metadataJson: unknown;
  createdAt: Date;
};

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

/**
 * Narrow delegates for settings + payment audit. Some TS language service configs mis-resolve
 * `PrismaClient` / transaction `Omit<...>` and hide model accessors; this stays structurally aligned with Prisma.
 */
type OrderPrismaSidecars = {
  businessSettings: {
    findUnique(args: { where: { id: string } }): Promise<BusinessSettingsScheduleSlice | null>;
  };
  paymentEvent: {
    findMany(args: {
      where: { orderId: string };
      orderBy: { createdAt: 'desc' };
      take: number;
    }): Promise<PaymentEventDbRow[]>;
    create(args: {
      data: {
        orderId: string;
        eventType: string;
        paymentMethod?: PaymentMethod | null;
        actorRole?: string | null;
        actorUserId?: string | null;
        note?: string | null;
        metadataJson?: Prisma.InputJsonValue | Prisma.DecimalJsLike | null;
      };
    }): Promise<PaymentEventDbRow>;
  };
  opsActivityEvent: {
    create(args: {
      data: {
        app: string;
        entityType: string;
        entityId: string;
        eventType: string;
        summary: string;
        actorUserId?: string | null;
        actorName?: string | null;
        actorRole?: string | null;
        actorEmail?: string | null;
        metadataJson?: Prisma.InputJsonValue | Prisma.DecimalJsLike | null;
      };
    }): Promise<OpsActivityDbRow>;
    findMany(args: {
      where?: {
        entityType?: string;
        entityId?: string;
        app?: string;
        actorRole?: string;
        createdAt?: {
          gte?: Date;
          lte?: Date;
        };
        eventType?: { contains: string; mode: 'insensitive' };
        OR?: Array<{
          actorName?: { contains: string; mode: 'insensitive' };
          actorEmail?: { contains: string; mode: 'insensitive' };
          actorRole?: { contains: string; mode: 'insensitive' };
          summary?: { contains: string; mode: 'insensitive' };
          entityId?: { contains: string; mode: 'insensitive' };
        }>;
      };
      orderBy: { createdAt: 'desc' };
      take: number;
    }): Promise<OpsActivityDbRow[]>;
  };
};

/** Client checkout page shape (legacy) — differs from WrapOrder canonical schema. */
function isClientCheckoutPayload(data: unknown): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    'fulfillmentType' in d &&
    Array.isArray(d.items) &&
    d.items.length > 0 &&
    typeof (d.items as { itemId?: string }[])[0]?.itemId === 'string'
  );
}

function normalizeLegacyClientSource(raw: unknown): OrderSource {
  const requestedSource = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (requestedSource === 'client_mobile') return 'client_mobile';
  return 'client_web';
}

/**
 * Maps storefront cart → WrapOrder so Zod + Prisma stay the single pipeline.
 * Does not set customer.customerId to Supabase `userId` (not a Prisma Customer FK).
 */
function clientCheckoutToWrapOrderShape(data: Record<string, unknown>): unknown {
  const items = data.items as Array<{
    itemId: string;
    name: string;
    quantity: number;
    basePrice: number;
    modifiers?: Array<{
      groupId?: string;
      name?: string;
      options: Array<{ label: string; priceAdjust?: number; optionId?: string }>;
    }>;
    totalPrice: number;
  }>;

  const now = new Date().toISOString();
  const source = normalizeLegacyClientSource((data as Record<string, unknown>).source);
  const subtotal = items.reduce((s, i) => s + Number(i.totalPrice ?? 0), 0);
  const discountRaw = data.discountCode;
  const discountCode =
    typeof discountRaw === 'string' && discountRaw.trim().length > 0
      ? discountRaw.trim().toUpperCase()
      : undefined;
  const { tax, total } = computeClientWebCheckoutTotals(subtotal);

  const rawFt = String(data.fulfillmentType ?? 'TAKEAWAY').toUpperCase();
  const fulfillmentType =
    rawFt === 'DINE_IN'
      ? 'dine_in'
      : rawFt === 'DELIVERY'
        ? 'delivery'
        : 'takeaway';

  /** Store the same group + option shape as the client cart — optional groups are simply omitted. */
  const mapModifiers = (
    modifiers: Array<{
      groupId?: string;
      name?: string;
      options: Array<{ label: string; priceAdjust?: number; optionId?: string }>;
    }>,
  ) => {
    const optionGroups = (modifiers ?? [])
      .map((g) => {
        const options = (g.options ?? []).map((o) => ({
          label: String(o.label),
          priceAdjust: Number(o.priceAdjust ?? 0),
          ...(o.optionId ? { optionId: o.optionId } : {}),
        }));
        const groupName = String(g.name ?? g.groupId ?? 'Option').trim();
        return {
          groupId: g.groupId,
          groupName,
          name: g.name,
          options,
        };
      })
      .filter((g) => g.options.length > 0);

    return {
      optionGroups,
    };
  };

  const requestedTime =
    typeof data.requestedTime === 'string' && data.requestedTime.length > 0
      ? data.requestedTime
      : undefined;

  const readCoord = (raw: unknown): number | undefined => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };
  const deliveryLatitude = readCoord(
    (data as Record<string, unknown>).deliveryLatitude,
  );
  const deliveryLongitude = readCoord(
    (data as Record<string, unknown>).deliveryLongitude,
  );

  const requestedMethod = String(data.paymentMethod ?? 'payhere')
    .toLowerCase()
    .trim();
  const paymentMethod =
    requestedMethod === 'cash' ||
    requestedMethod === 'card' ||
    requestedMethod === 'online'
      ? requestedMethod
      : 'payhere';
  const deferredCashTransactionId =
    paymentMethod === 'cash'
      ? fulfillmentType === 'delivery'
        ? `ON_DELIVERY_${Date.now()}`
        : fulfillmentType === 'takeaway'
          ? `ON_PICKUP_${Date.now()}`
          : null
      : null;

  return {
    orderId: randomUUID(),
    status: 'placed',
    source,
    placedAt: now,
    updatedAt: now,
    customer: {
      name: String(data.customerName ?? 'Guest'),
      phone:
        data.customerPhone != null && data.customerPhone !== ''
          ? String(data.customerPhone)
          : undefined,
    },
    items: items.map((i) => {
      const qty = Math.max(1, Math.floor(Number(i.quantity)));
      const lineTotal = Number(i.totalPrice);
      const unitPrice = Math.round((lineTotal / qty) * 100) / 100;
      return {
        lineItemId: randomUUID(),
        wrapId: String(i.itemId),
        name: String(i.name),
        availability: 'available',
        quantity: qty,
        unitPrice,
        modifiers: mapModifiers(i.modifiers ?? []),
        lineTotal,
      };
    }),
    pricing: {
      subtotal,
      ...(discountCode ? { discountCode } : {}),
      discountAmount: 0,
      tax,
      deliveryFee: 0,
      total,
    },
    payment: {
      method: paymentMethod,
      status: paymentMethod === 'cash' ? 'pending' : 'pending',
      ...(deferredCashTransactionId ? { transactionId: deferredCashTransactionId } : {}),
    },
    fulfillment: {
      type: fulfillmentType,
      ...(fulfillmentType === 'delivery' && typeof data.deliveryAddress === 'string'
        ? { deliveryAddress: data.deliveryAddress }
        : {}),
      ...(fulfillmentType === 'delivery' &&
      deliveryLatitude !== undefined &&
      deliveryLongitude !== undefined
        ? { deliveryLatitude, deliveryLongitude }
        : {}),
      ...(requestedTime ? { estimatedReadyTime: requestedTime } : {}),
    },
    kitchen: { priority: 'normal' },
  };
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly cashierDuplicateWindowMinutes = 5;
  private deliveryMeta(row: unknown): {
    deliveryLatitude?: Prisma.Decimal | number | string | null;
    deliveryLongitude?: Prisma.Decimal | number | string | null;
    deliveryDistanceKm?: Prisma.Decimal | number | string | null;
    deliveryGeoSource?: string | null;
  } {
    const r = (row ?? {}) as Record<string, unknown>;
    const geo =
      typeof r.deliveryGeoSource === 'string' ? r.deliveryGeoSource : r.deliveryGeoSource == null ? null : String(r.deliveryGeoSource);
    return {
      deliveryLatitude: (r.deliveryLatitude as Prisma.Decimal | number | string | null) ?? null,
      deliveryLongitude: (r.deliveryLongitude as Prisma.Decimal | number | string | null) ?? null,
      deliveryDistanceKm: (r.deliveryDistanceKm as Prisma.Decimal | number | string | null) ?? null,
      deliveryGeoSource: geo,
    };
  }

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(PRISMA_READ) private readonly prismaRead: PrismaReadService | null,
    private readonly queueCache: QueueResponseCacheService,
    private staffService: StaffService,
    private couponService: CouponService,
    private customerService: CustomerService,
    private readonly locationService: LocationService,
    private readonly activityService: ActivityService,
    private readonly outboxService: OutboxService,
  ) {}

  private orderSidecars(): OrderPrismaSidecars {
    return this.prisma as unknown as OrderPrismaSidecars;
  }

  private orderSidecarsUsing(client: PrismaClient): OrderPrismaSidecars {
    return client as unknown as OrderPrismaSidecars;
  }

  /** Primary or optional read replica for `getQueue` reads only. */
  private prismaForQueueRead(): PrismaClient {
    return (this.prismaRead ?? this.prisma) as unknown as PrismaClient;
  }

  private queueResponseCacheKey(parts: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  private queueCacheTtlMs(): number {
    const v = process.env.QUEUE_CACHE_ENABLED;
    if (v === '0' || v === 'false') return 0;
    return Math.max(0, Number(process.env.QUEUE_CACHE_TTL_MS ?? 0) || 0);
  }

  private logQueuePerf(meta: Record<string, unknown>): void {
    const on = process.env.QUEUE_PERF_LOG === '1' || String(process.env.QUEUE_PERF_LOG).toLowerCase() === 'true';
    if (!on) return;
    this.logger.log(JSON.stringify({ msg: 'queue.get', ...meta }));
  }

  /** Invalidate queue cache + notify SSE subscribers (fire-and-forget). */
  private notifyQueueProjectionChanged(meta: { orderId?: string; type?: string } = {}): void {
    void this.queueCache.bumpGlobalRevAndPublish(meta).catch(() => undefined);
  }

  private txPaymentSidecar(
    tx: Prisma.TransactionClient,
  ): Pick<OrderPrismaSidecars, 'paymentEvent'> {
    return tx as unknown as Pick<OrderPrismaSidecars, 'paymentEvent'>;
  }

  private actorDisplayNameFromEvent(event: PaymentEventDbRow): string | null {
    const meta =
      event.metadataJson && typeof event.metadataJson === 'object'
        ? (event.metadataJson as Record<string, unknown>)
        : null;
    const value =
      (meta?.actorName as string | undefined) ??
      (meta?.fullName as string | undefined) ??
      (meta?.actorEmail as string | undefined);
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length > 0) return text;
    const fallback = typeof event.actorUserId === 'string' ? event.actorUserId.trim() : '';
    return fallback.length > 0 ? fallback : null;
  }

  private appFromRole(role?: string | null): OpsActivityEventRow['app'] {
    const normalized = String(role ?? '').toUpperCase();
    if (normalized === 'CASHIER') return 'cashier';
    if (normalized === 'KITCHEN') return 'kitchen';
    if (normalized === 'COURIER') return 'delivery';
    if (normalized === SHOPPER_ROLE) return 'client';
    if (normalized === 'ADMIN') return 'admin';
    return 'system';
  }

  private async recordOpsActivity(args: {
    entityType: string;
    entityId: string;
    eventType: string;
    summary: string;
    actor?: RequestUser | null;
    app?: OpsActivityEventRow['app'];
    /** When `actor` is absent (e.g. guest web order), persist role for activity filters */
    actorRoleFallback?: string | null;
    metadataJson?: Prisma.InputJsonValue | null;
  }) {
    const sidecars = this.orderSidecars() as unknown as {
      opsActivityEvent?: {
        create?: (args: {
          data: {
            app: string;
            entityType: string;
            entityId: string;
            eventType: string;
            summary: string;
            actorUserId?: string | null;
            actorName?: string | null;
            actorRole?: string | null;
            actorEmail?: string | null;
            metadataJson?: Prisma.InputJsonValue | Prisma.DecimalJsLike | null;
          };
        }) => Promise<unknown>;
      };
    };
    if (!sidecars.opsActivityEvent?.create) return;
    await sidecars.opsActivityEvent.create({
      data: {
        app: args.app ?? this.appFromRole(args.actor?.role),
        entityType: args.entityType,
        entityId: args.entityId,
        eventType: args.eventType,
        summary: args.summary,
        actorUserId: args.actor?.sub ?? null,
        actorName: args.actor?.fullName ?? null,
        actorRole: args.actor?.role ?? args.actorRoleFallback ?? null,
        actorEmail: args.actor?.email ?? null,
        metadataJson: args.metadataJson ?? null,
      },
    });
  }

  /** Minutes from midnight in `timeZone` (IANA), for same-day open/close rules. */
  private getBusinessMinuteOfDay(instant: Date, timeZone: string): number {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(instant);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return h * 60 + m;
  }

  private formatMinutesAsClock(mins: number): string {
    const h = Math.floor(mins / 60) % 24;
    const mi = mins % 60;
    return new Date(2000, 0, 1, h, mi).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Calendar date YYYY-MM-DD in IANA `timeZone` (for same-day scheduling rules). */
  private zonedYmd(instant: Date, timeZone: string): string {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(instant);
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  }

  private async getOperationalWindow(date?: string): Promise<{ start: Date; end: Date; label: string }> {
    const s = await this.orderSidecars().businessSettings.findUnique({
      where: { id: 'singleton' },
    });
    const openMinsRaw = Number(s?.openingTimeMinutes ?? 0);
    const closeMinsRaw = Number(s?.closingTimeMinutes ?? 24 * 60);
    const openMins = Math.min(24 * 60 - 1, Math.max(0, Number.isFinite(openMinsRaw) ? openMinsRaw : 0));
    const closeMins = Math.min(
      24 * 60 - 1,
      Math.max(0, Number.isFinite(closeMinsRaw) ? closeMinsRaw : 24 * 60 - 1),
    );
    const overnight = closeMins <= openMins;

    const now = new Date();
    let anchorDate = now;
    if (date && date !== 'today') {
      const parsed = new Date(`${date}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid reconciliation date');
      anchorDate = parsed;
    } else if (date === 'today' && overnight) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < closeMins) {
        anchorDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    const dayStart = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      anchorDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const start = new Date(dayStart.getTime() + openMins * 60 * 1000);
    const end = new Date(
      dayStart.getTime() +
        (overnight ? 24 * 60 * 60 * 1000 : 0) +
        closeMins * 60 * 1000,
    );
    return { start, end, label: dayStart.toISOString().slice(0, 10) };
  }

  private resolveOperationalWindowForReference(
    reference: Date,
    openMins: number,
    closeMins: number,
  ): { start: Date; end: Date } {
    const dayStart = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate(),
      0,
      0,
      0,
      0,
    );
    const overnight = closeMins <= openMins;
    if (!overnight) {
      return {
        start: new Date(dayStart.getTime() + openMins * 60_000),
        end: new Date(dayStart.getTime() + closeMins * 60_000),
      };
    }
    const minsNow = reference.getHours() * 60 + reference.getMinutes();
    if (minsNow < closeMins) {
      return {
        start: new Date(dayStart.getTime() - 24 * 60 * 60 * 1000 + openMins * 60_000),
        end: new Date(dayStart.getTime() + closeMins * 60_000),
      };
    }
    return {
      start: new Date(dayStart.getTime() + openMins * 60_000),
      end: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 + closeMins * 60_000),
    };
  }

  // INT-005 — Fulfillment enum casing mapping
  private mapFulfillmentType(type: string | undefined): FulfillmentType {
    if (type == null || type === '') return 'takeaway';
    const map: Record<string, FulfillmentType> = {
      DINE_IN: 'dine_in',
      TAKEAWAY: 'takeaway',
      DELIVERY: 'delivery',
    };
    const direct = map[type];
    if (direct) return direct;
    const lower = type.toLowerCase();
    if (lower === 'dine_in' || lower === 'takeaway' || lower === 'delivery') {
      return lower;
    }
    return 'takeaway';
  }

  private async getPaymentMethodAvailability() {
    const s = await this.orderSidecars().businessSettings.findUnique({
      where: { id: 'singleton' },
    });
    return normalizePaymentConfig(s?.paymentJson ?? null).methods;
  }

  private async assertMethodEnabled(method: PaymentMethod) {
    const available = await this.getPaymentMethodAvailability();
    if (!available[method]) {
      throw new ForbiddenException(`Payment method ${method} is currently disabled`);
    }
  }

  private assertScenarioPaymentPolicy(
    source: OrderSource,
    fulfillmentType: string,
    method: PaymentMethod,
  ) {
    const policy: Record<OrderSource, { fulfillment: string[]; paymentMethods: PaymentMethod[] }> = {
      client_web: {
        fulfillment: ['takeaway', 'dine_in', 'delivery'],
        paymentMethods: ['cash', 'payhere', 'card', 'online'],
      },
      client_mobile: {
        fulfillment: ['takeaway', 'dine_in', 'delivery'],
        paymentMethods: ['cash', 'payhere', 'card', 'online'],
      },
      cashier_pos: {
        fulfillment: ['takeaway', 'dine_in', 'delivery'],
        paymentMethods: ['cash', 'card'],
      },
      cashier_pos_offline: {
        fulfillment: ['takeaway', 'dine_in', 'delivery'],
        paymentMethods: ['cash', 'card'],
      },
    };
    const allowed = policy[source];
    if (!allowed) throw new BadRequestException(`Unsupported order source: ${source}`);
    if (!allowed.fulfillment.includes(fulfillmentType)) {
      throw new BadRequestException(
        `Fulfillment ${fulfillmentType} is not allowed for source ${source}`,
      );
    }
    if (!allowed.paymentMethods.includes(method)) {
      throw new BadRequestException(
        `Payment method ${method} is not allowed for source ${source}`,
      );
    }
  }

  private normalizeInitialPaymentStatus(
    source: OrderSource,
    fulfillmentType: string,
    method: PaymentMethod,
    incoming: PaymentStatus,
  ): PaymentStatus {
    if (method === 'card' || method === 'payhere' || method === 'online') {
      return incoming === 'completed' ? 'completed' : 'pending';
    }
    // Cash: dine-in at counter can be completed at placement; others default pending
    if (method === 'cash' && source.startsWith('cashier') && fulfillmentType === 'dine_in') {
      return incoming === 'completed' ? 'completed' : 'pending';
    }
    return incoming === 'completed' ? 'completed' : 'pending';
  }

  /** Payment / role policy only (no schedule gate). */
  private getPaymentPolicyKitchenReleaseReason(order: {
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    fulfillmentType: FulfillmentType;
    paymentMethod: PaymentMethod;
    source: OrderSource;
    transactionId?: string | null;
  }): 'PREPAID' | 'DINE_IN_POSTPAY' | 'DELIVERY_PAY_LATER' | 'TAKEAWAY_PAY_LATER' | 'STAFF_PAY_LATER' | null {
    if (['delivered', 'cancelled', 'voided', 'refunded'].includes(order.status)) return null;
    if (order.paymentStatus === 'completed') return 'PREPAID';
    if (order.status !== 'placed') return null;
    const tx = String(order.transactionId ?? '').toUpperCase();
    if (
      order.fulfillmentType === 'takeaway' &&
      order.paymentMethod === 'cash' &&
      tx.startsWith('ON_PICKUP_')
    ) {
      return 'TAKEAWAY_PAY_LATER';
    }
    if (order.fulfillmentType === 'dine_in' && order.paymentMethod === 'cash') {
      return 'DINE_IN_POSTPAY';
    }
    if (order.fulfillmentType === 'delivery' && order.paymentMethod === 'cash') {
      return 'DELIVERY_PAY_LATER';
    }
    if (
      (order.source === 'cashier_pos' || order.source === 'cashier_pos_offline') &&
      ['takeaway', 'dine_in', 'delivery'].includes(order.fulfillmentType)
    ) {
      // Cash takeaway must opt into explicit on-pickup marker, even at cashier.
      if (order.fulfillmentType === 'takeaway' && order.paymentMethod === 'cash') return null;
      return 'STAFF_PAY_LATER';
    }
    return null;
  }

  private isKitchenEligibleByPolicyOnly(order: {
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    fulfillmentType: FulfillmentType;
    paymentMethod: PaymentMethod;
    source: OrderSource;
  }): boolean {
    if (order.status === 'in_kitchen') return true;
    if (order.status === 'paid') return true;
    return this.getPaymentPolicyKitchenReleaseReason(order) !== null;
  }

  private isScheduleGateBlockingKitchenRelease(args: {
    status: OrderStatus;
    estimatedReadyTime: Date | null;
    minLeadMinutes: number;
    now?: Date;
  }): boolean {
    const { status, estimatedReadyTime, minLeadMinutes } = args;
    const now = args.now ?? new Date();
    if (status !== 'placed' && status !== 'paid') return false;
    if (!estimatedReadyTime) return false;
    const releaseAt = new Date(estimatedReadyTime.getTime() - minLeadMinutes * 60_000);
    return now.getTime() < releaseAt.getTime();
  }

  private computeKitchenTimingForQueue(
    o: {
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      fulfillmentType: FulfillmentType;
      paymentMethod: PaymentMethod;
      source: OrderSource;
      transactionId: string | null;
      estimatedReadyTime: Date | null;
      placedAt: Date;
    },
    minLeadMinutes: number,
    now: Date,
  ): {
    kitchenReleaseAt: Date | null;
    priorityDeadlineAt: Date;
    slaBucket: 'overdue' | 'due_soon' | 'ok';
    kitchenEligible: boolean;
    releaseReason: QueueOrder['releaseReason'];
  } {
    const est = o.estimatedReadyTime;
    const placed = o.placedAt;
    const kitchenReleaseAt =
      est != null ? new Date(est.getTime() - minLeadMinutes * 60_000) : null;
    const priorityDeadlineAt =
      est != null ? est : new Date(placed.getTime() + minLeadMinutes * 60_000);

    const policyAllows = this.isKitchenEligibleByPolicyOnly({
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentType: o.fulfillmentType,
      paymentMethod: o.paymentMethod,
      source: o.source,
    });

    const scheduleBlocks =
      (o.status === 'placed' || o.status === 'paid') &&
      kitchenReleaseAt != null &&
      now.getTime() < kitchenReleaseAt.getTime();

    const kitchenEligible =
      o.status === 'in_kitchen' ? true : policyAllows && !scheduleBlocks;

    const releaseReason: QueueOrder['releaseReason'] =
      scheduleBlocks && policyAllows
        ? 'SCHEDULED_PENDING'
        : this.getPaymentPolicyKitchenReleaseReason({
            status: o.status,
            paymentStatus: o.paymentStatus,
            fulfillmentType: o.fulfillmentType,
            paymentMethod: o.paymentMethod,
            source: o.source,
            transactionId: o.transactionId,
          });

    const early: OrderStatus[] = ['placed', 'paid', 'in_kitchen'];
    let slaBucket: 'overdue' | 'due_soon' | 'ok';
    if (!early.includes(o.status)) {
      slaBucket = 'ok';
    } else if (now.getTime() > priorityDeadlineAt.getTime()) {
      slaBucket = 'overdue';
    } else if (now.getTime() >= priorityDeadlineAt.getTime() - 15 * 60_000) {
      slaBucket = 'due_soon';
    } else {
      slaBucket = 'ok';
    }

    return {
      kitchenReleaseAt,
      priorityDeadlineAt,
      slaBucket,
      kitchenEligible,
      releaseReason,
    };
  }

  private warnQueueProjectionBatch(
    persona: ResponsePersona,
    rows: (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[],
  ): void {
    for (const row of rows) {
      warnIfQueueProjectionAnomalies(this.logger, persona, row);
    }
  }

  /** Full row includes line prices; kitchen/courier use lean `select` without unit/line totals. */
  private queueOrderItemToDto(item: {
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    modifiersJson: unknown;
    unitPrice?: unknown;
    lineTotal?: unknown;
  }): NonNullable<QueueOrder['items']>[number] {
    const u = item.unitPrice;
    const l = item.lineTotal;
    return {
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      quantity: Number(item.quantity ?? 0),
      unitPrice: u != null ? Number(u) : 0,
      lineTotal: l != null ? Number(l) : 0,
      modifiersJson: item.modifiersJson,
    };
  }

  private compareQueueOrderPriority(a: QueueOrder, b: QueueOrder): number {
    const rank: Record<'overdue' | 'due_soon' | 'ok', number> = {
      overdue: 0,
      due_soon: 1,
      ok: 2,
    };
    const ar = a.slaBucket != null ? rank[a.slaBucket] : 2;
    const br = b.slaBucket != null ? rank[b.slaBucket] : 2;
    if (ar !== br) return ar - br;
    const arush = a.kitchenPriority === 'rush' ? 0 : 1;
    const brush = b.kitchenPriority === 'rush' ? 0 : 1;
    if (arush !== brush) return arush - brush;
    const ad = a.priorityDeadlineAt ? new Date(String(a.priorityDeadlineAt)).getTime() : 0;
    const bd = b.priorityDeadlineAt ? new Date(String(b.priorityDeadlineAt)).getTime() : 0;
    if (ad !== bd) return ad - bd;
    const ap = a.placedAt ? new Date(String(a.placedAt)).getTime() : 0;
    const bp = b.placedAt ? new Date(String(b.placedAt)).getTime() : 0;
    return ap - bp;
  }

  private derivePaymentCollection(order: {
    source: OrderSource;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    fulfillmentType: FulfillmentType;
    transactionId?: string | null;
  }): 'immediate' | 'on_delivery' | 'on_pickup' | null {
    const tx = String(order.transactionId ?? '').toUpperCase();
    if (tx.startsWith('ON_DELIVERY_')) return 'on_delivery';
    if (tx.startsWith('ON_PICKUP_')) return 'on_pickup';
    if (order.paymentMethod !== 'cash') return 'immediate';
    if (tx.startsWith('CASH_')) return 'immediate';
    if (
      order.source === 'cashier_pos_offline' &&
      order.paymentStatus !== 'completed' &&
      order.fulfillmentType === 'delivery'
    ) {
      return 'on_delivery';
    }
    if (
      order.source === 'cashier_pos_offline' &&
      order.paymentStatus !== 'completed' &&
      (order.fulfillmentType === 'takeaway' || order.fulfillmentType === 'dine_in')
    ) {
      return 'on_pickup';
    }
    return 'immediate';
  }

  private canTransition(
    from: OrderStatus,
    to: OrderStatus,
    role: string,
    context?: OrderTransitionPolicyContext,
  ): boolean {
    if (from === to) return true;
    const transitions = this.transitionGraph();
    const allowed = transitions[from]?.includes(to);
    if (!allowed) return false;
    if (['voided', 'refunded'].includes(to)) return role === 'ADMIN';
    if (to === 'paid') return ['ADMIN', 'CASHIER'].includes(role);
    if (to === 'cancelled') return ['ADMIN', 'CASHIER'].includes(role);
    if (to === 'in_kitchen') {
      // Cashier must be able to release eligible phone/COD orders into kitchen.
      if (!['KITCHEN', 'ADMIN', 'CASHIER'].includes(role)) return false;
      if (!context) return false;
      const minLead = Number(context.minLeadMinutes ?? 20);
      const estRaw = context.estimatedReadyTime;
      const est =
        estRaw instanceof Date
          ? estRaw
          : estRaw != null && String(estRaw).length > 0
            ? new Date(estRaw as string)
            : null;
      if (
        this.isScheduleGateBlockingKitchenRelease({
          status: from,
          estimatedReadyTime: est,
          minLeadMinutes: minLead,
        })
      ) {
        return false;
      }
      if (from !== 'placed') return true;
      return (
        this.getPaymentPolicyKitchenReleaseReason({
          status: 'placed',
          paymentStatus: context.paymentStatus ?? 'pending',
          fulfillmentType: context.fulfillmentType ?? 'takeaway',
          paymentMethod: context.paymentMethod ?? 'cash',
          source: context.source ?? 'cashier_pos',
          transactionId: context.transactionId ?? null,
        }) !== null
      );
    }
    if (to === 'ready') return ['KITCHEN', 'ADMIN'].includes(role);
    if (to === 'in_transit') {
      const fulfillmentType = context?.fulfillmentType ?? 'delivery';
      if (fulfillmentType !== 'delivery') return false;
      return ['COURIER', 'ADMIN'].includes(role);
    }
    if (to === 'delivered') {
      // Delivery completion must only happen after payment is settled.
      if (context?.paymentStatus !== 'completed') return false;
      const fulfillmentType = context?.fulfillmentType ?? 'delivery';
      if (fulfillmentType === 'delivery') return ['COURIER', 'ADMIN'].includes(role);
      return ['CASHIER', 'ADMIN'].includes(role);
    }
    return true;
  }

  private transitionGraph(): Record<OrderStatus, OrderStatus[]> {
    return {
      placed: ['paid', 'in_kitchen', 'cancelled', 'voided'],
      paid: ['in_kitchen', 'cancelled', 'refunded'],
      in_kitchen: ['ready', 'cancelled', 'voided'],
      ready: ['in_transit', 'delivered', 'cancelled'],
      in_transit: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
      voided: [],
      refunded: [],
    };
  }

  private blockedReasonForTransition(
    from: OrderStatus,
    to: OrderStatus,
    role: string,
    context: OrderTransitionPolicyContext & {
      paymentStatus: PaymentStatus;
      fulfillmentType: FulfillmentType;
      paymentMethod: PaymentMethod;
      source: OrderSource;
    },
  ): QueueMoveBlockedReason | null {
    if (from === to) return null;
    if (['delivered', 'cancelled', 'voided', 'refunded'].includes(from)) return 'TERMINAL_STATE';
    if (!this.transitionGraph()[from]?.includes(to)) return 'INVALID_TRANSITION';
    if (to === 'paid' && context.paymentStatus !== 'completed') return 'PAYMENT_NOT_COMPLETED';
    if (to === 'in_transit' && context.fulfillmentType !== 'delivery') return 'NOT_DELIVERY_ORDER';
    if (to === 'delivered' && context.paymentStatus !== 'completed') return 'PAYMENT_NOT_COMPLETED';
    if (
      to === 'delivered' &&
      role === 'COURIER' &&
      context.courierId &&
      context.actorSub &&
      context.courierId !== context.actorSub
    ) {
      return 'COURIER_NOT_ASSIGNED';
    }
    if (to === 'in_kitchen' && (from === 'placed' || from === 'paid')) {
      const minLead = Number(context.minLeadMinutes ?? 20);
      const estRaw = context.estimatedReadyTime;
      const est =
        estRaw instanceof Date
          ? estRaw
          : estRaw != null && String(estRaw).length > 0
            ? new Date(estRaw as string)
            : null;
      if (
        this.isScheduleGateBlockingKitchenRelease({
          status: from,
          estimatedReadyTime: est,
          minLeadMinutes: minLead,
        })
      ) {
        return 'SCHEDULE_GATE';
      }
    }
    if (
      from === 'placed' &&
      to === 'in_kitchen' &&
      !this.getPaymentPolicyKitchenReleaseReason({
        status: 'placed',
        paymentStatus: context.paymentStatus,
        fulfillmentType: context.fulfillmentType,
        paymentMethod: context.paymentMethod,
        source: context.source,
        transactionId: context.transactionId ?? null,
      })
    ) {
      return 'KITCHEN_POLICY_BLOCK';
    }
    if (!this.canTransition(from, to, role, context)) return 'ROLE_FORBIDDEN';
    return null;
  }

  /** Same phone + item count + total within a short window → likely double-submit / retry. */
  private async findRecentCashierOrderDuplicate(parsed: WrapOrder): Promise<string | null> {
    const src = parsed.source;
    if (src !== 'cashier_pos' && src !== 'cashier_pos_offline') return null;
    const digits = this.customerService.normalizePhoneDigits(parsed.customer?.phone ?? null);
    if (!digits) return null;

    const since = new Date(Date.now() - this.cashierDuplicateWindowMinutes * 60_000);
    const totalRounded = Math.round(Number(parsed.pricing.total) * 100) / 100;
    const itemCount = parsed.items.length;

    const recent = await this.prisma.order.findMany({
      where: {
        placedAt: { gte: since },
        source: { in: [OrderSource.cashier_pos, OrderSource.cashier_pos_offline] },
      },
      select: {
        id: true,
        total: true,
        customerPhone: true,
        customer: { select: { phone: true } },
        _count: { select: { items: true } },
      },
      orderBy: { placedAt: 'desc' },
      take: 80,
    });

    for (const o of recent) {
      const oDigits = this.customerService.normalizePhoneDigits(
        o.customerPhone ?? o.customer?.phone ?? null,
      );
      if (oDigits !== digits) continue;
      if (o._count.items !== itemCount) continue;
      const oTotal = Math.round(Number(o.total) * 100) / 100;
      if (Math.abs(oTotal - totalRounded) > 0.005) continue;
      return o.id;
    }
    return null;
  }

  private idempotencyKeyToOrderId(key: string): string {
    const hex = createHash('sha256').update(key).digest('hex').slice(0, 32);
    const p1 = hex.slice(0, 8);
    const p2 = hex.slice(8, 12);
    const p3 = `4${hex.slice(13, 16)}`; // v4 marker
    const variantNibble = (parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8;
    const p4 = `${variantNibble.toString(16)}${hex.slice(17, 20)}`;
    const p5 = hex.slice(20, 32);
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }

  async createOrder(data: unknown, idempotencyKey?: string, actor?: RequestUser): Promise<any> {
    this.logger.log(`Incoming order data: ${JSON.stringify(data)}`);
    const fromLegacyClientCart = isClientCheckoutPayload(data);
    const normalized = fromLegacyClientCart
      ? clientCheckoutToWrapOrderShape(data as Record<string, unknown>)
      : data;

    let parsed;
    try {
      parsed = WrapOrderSchema.parse(normalized);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException({
          message: 'Invalid order payload',
          issues: e.flatten(),
        });
      }
      throw e;
    }

    if (fromLegacyClientCart) {
      const legacySource = normalizeLegacyClientSource((data as Record<string, unknown>).source);
      if (parsed.source !== legacySource) {
        this.logger.warn(
          `Legacy source mismatch raw=${legacySource} parsed=${parsed.source}; preserving raw source.`,
        );
        parsed.source = legacySource;
      }
    }

    const stableOrderId =
      typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
        ? this.idempotencyKeyToOrderId(idempotencyKey.trim())
        : null;
    if (stableOrderId) {
      const existing = await this.prisma.order.findUnique({
        where: { id: stableOrderId },
        include: { items: true },
      });
      if (existing) return existing;
    }

    // Server-side operating-window validation + near-closing cutoff (production safety).
    // NOTE: Contracts currently only have `estimatedReadyTime`, so we treat it as user-requested schedule time for now.
    const s = await this.orderSidecars().businessSettings.findUnique({
      where: { id: 'singleton' },
    });
    const openMinsRaw = Number(s?.openingTimeMinutes ?? 0);
    const closeMinsRaw = Number(s?.closingTimeMinutes ?? 24 * 60 - 1);
    const openMins = Math.min(24 * 60 - 1, Math.max(0, Number.isFinite(openMinsRaw) ? openMinsRaw : 0));
    const closeMins = Math.min(
      24 * 60 - 1,
      Math.max(0, Number.isFinite(closeMinsRaw) ? closeMinsRaw : 24 * 60 - 1),
    );
    const businessTz =
      typeof s?.timezone === 'string' && s.timezone.trim().length > 0
        ? s.timezone.trim()
        : 'Asia/Colombo';
    const lead = Number(s?.minLeadTimeMinutes ?? 0);
    const sameDayOnly = Boolean(s?.scheduleSameDayOnly ?? true);

    const now = new Date();
    const requestedTime = parsed.fulfillment?.estimatedReadyTime
      ? new Date(parsed.fulfillment.estimatedReadyTime)
      : null;

    const fulfillmentForTiming = parsed.fulfillment.type;
    const isPosChannel =
      parsed.source === OrderSource.cashier_pos || parsed.source === OrderSource.cashier_pos_offline;
    const bypassPosInStoreTiming =
      isPosChannel && fulfillmentForTiming !== 'delivery';

    const timing = validateCustomerOrderTiming({
      now,
      requestedTime,
      timezone: businessTz,
      openingTimeMinutes: openMinsRaw,
      closingTimeMinutes: closeMinsRaw,
      scheduleSameDayOnly: sameDayOnly,
      minLeadTimeMinutes: lead,
      deliveryJson: s?.deliveryJson ?? null,
      operationsCalendarJson: s?.operationsCalendarJson ?? null,
      bypassOperatingWindowForPos: bypassPosInStoreTiming,
    });
    if (timing.ok === false) {
      throw new BadRequestException(timing.message);
    }

    let deliveryDistanceKm: number | null = null;
    let deliveryGeoSource: string | null = null;
    let deliveryCalcJson: Prisma.InputJsonValue | null = null;

    const applyServerCheckoutPricing =
      fromLegacyClientCart ||
      (isPosChannel && parsed.fulfillment.type === 'delivery');

    // Storefront legacy cart + POS delivery: server-authoritative VAT + delivery (coupon adjusts next).
    // Other WrapOrder payloads keep submitted pricing.
    if (applyServerCheckoutPricing) {
      const requireCoords = process.env.DELIVERY_REQUIRE_COORDS !== 'false';
      const vatRate = normalizeCheckoutVatRate(s?.checkoutVatRate ?? 0.15);
      const delRules = parseDeliveryJson(s?.deliveryJson ?? null);
      const isDelivery = parsed.fulfillment.type === 'delivery';
      const deliveryAddress = String(parsed.fulfillment.deliveryAddress ?? '').trim();
      if (isDelivery && !delRules.enabled) {
        throw new BadRequestException('Delivery is not available.');
      }
      if (isDelivery && deliveryAddress.length === 0) {
        throw new BadRequestException({
          code: 'delivery_address_required',
          message: 'Delivery address is required.',
        });
      }

      let geoFromPosAddress = false;
      if (
        isDelivery &&
        delRules.feeMode === 'distance' &&
        isPosChannel &&
        deliveryAddress.length > 0 &&
        (parsed.fulfillment.deliveryLatitude == null ||
          parsed.fulfillment.deliveryLongitude == null ||
          !Number.isFinite(parsed.fulfillment.deliveryLatitude) ||
          !Number.isFinite(parsed.fulfillment.deliveryLongitude))
      ) {
        const coords = await this.locationService.geocodeAddressLine(deliveryAddress);
        if (coords) {
          parsed.fulfillment.deliveryLatitude = coords.latitude;
          parsed.fulfillment.deliveryLongitude = coords.longitude;
          geoFromPosAddress = true;
        }
      }

      const feeResult = computeDeliveryFeeLkr(delRules, {
        fulfillmentIsDelivery: isDelivery,
        deliveryLat: parsed.fulfillment.deliveryLatitude ?? null,
        deliveryLng: parsed.fulfillment.deliveryLongitude ?? null,
      });
      let deliveryFee = feeResult.fee;
      if (feeResult.error === 'coords_required') {
        this.logger.warn('Delivery fee calc blocked: coords_required');
        if (!requireCoords) {
          deliveryFee = 0;
          deliveryGeoSource = 'coords_missing_fallback';
          deliveryCalcJson = { feeMode: delRules.feeMode, fallback: 'no_coords' };
        } else {
          throw new BadRequestException({
            code: 'delivery_coords_required',
            message: isPosChannel
              ? 'Distance-based delivery needs a mappable address. Add street, area, and city, or ensure Google Maps geocoding is configured.'
              : 'Distance-based delivery needs your location. Enable location access in your browser and try again.',
          });
        }
      }
      if (feeResult.error === 'out_of_range') {
        this.logger.warn('Delivery fee calc blocked: out_of_range');
        throw new BadRequestException({
          code: 'delivery_out_of_range',
          message: 'This location is outside our delivery area.',
        });
      }
      if (feeResult.error === 'invalid_rules') {
        this.logger.warn('Delivery fee calc blocked: invalid_rules');
        throw new BadRequestException({
          code: 'delivery_pricing_unavailable',
          message: 'Delivery pricing is temporarily unavailable. Please try takeaway.',
        });
      }
      if (feeResult.error == null) {
        deliveryDistanceKm =
          typeof feeResult.distanceKm === 'number' ? Number(feeResult.distanceKm.toFixed(3)) : null;
      }
      const sourceRaw =
        typeof (data as Record<string, unknown>).deliveryGeoSource === 'string'
          ? String((data as Record<string, unknown>).deliveryGeoSource)
          : null;
      deliveryGeoSource =
        (geoFromPosAddress ? 'geocoded_address' : null) ??
        deliveryGeoSource ??
        sourceRaw?.trim() ??
        (parsed.fulfillment.deliveryLatitude != null ? 'checkout_location' : null);
      deliveryCalcJson =
        deliveryCalcJson ??
        ({
          feeMode: delRules.feeMode,
          maxDeliveryKm: delRules.maxDeliveryKm,
          distanceKm: deliveryDistanceKm,
          feeApplied: deliveryFee,
        } as Prisma.InputJsonValue);
      this.logger.log(
        `Delivery fee computed mode=${delRules.feeMode} fee=${deliveryFee} distanceKm=${deliveryDistanceKm ?? 'n/a'} source=${deliveryGeoSource ?? 'n/a'}`,
      );
      const subtotal = parsed.pricing.subtotal;
      const tax = Math.round(subtotal * vatRate * 100) / 100;
      parsed.pricing.tax = tax;
      parsed.pricing.deliveryFee = deliveryFee;
      parsed.pricing.discountAmount = 0;
      parsed.pricing.total = Math.round((subtotal + tax + deliveryFee) * 100) / 100;
    }

    // Objective 4: Coupon Verification during 'placed' status transition (creation)
    if (parsed.pricing.discountCode) {
      const couponRes = await this.couponService.validateCoupon(
        parsed.pricing.discountCode,
        parsed.pricing.subtotal,
        parsed.customer?.customerId,
        parsed.customer?.phone
      );

      if (!couponRes.valid) {
        throw new BadRequestException(`Coupon Error: ${couponRes.message}`);
      }

      // Sync the validated discount amount to the order object
      parsed.pricing.discountAmount = couponRes.discountAmount;
      
      // Recalculate final total using server-side validated discount
      parsed.pricing.total = 
        parsed.pricing.subtotal - 
        parsed.pricing.discountAmount + 
        parsed.pricing.tax + 
        parsed.pricing.deliveryFee;

      this.logger.log(`Coupon ${parsed.pricing.discountCode} applied. discountAmount: ${parsed.pricing.discountAmount}`);
    }
    
    await this.assertMethodEnabled(parsed.payment.method as PaymentMethod);
    this.assertScenarioPaymentPolicy(
      parsed.source as OrderSource,
      this.mapFulfillmentType(parsed.fulfillment.type),
      parsed.payment.method as PaymentMethod,
    );
    parsed.payment.status = this.normalizeInitialPaymentStatus(
      parsed.source as OrderSource,
      this.mapFulfillmentType(parsed.fulfillment.type),
      parsed.payment.method as PaymentMethod,
      parsed.payment.status as PaymentStatus,
    );

    const dupId = await this.findRecentCashierOrderDuplicate(parsed);
    if (dupId) {
      throw new ConflictException({
        duplicateOf: dupId,
        message:
          'A very similar cashier order was placed moments ago. Open that order or wait before retrying.',
      });
    }

    const buildCreate = async () =>
      this.prisma.$transaction(async (tx) => {
      const orderData: any = {
        ...(stableOrderId ? { id: stableOrderId } : {}),
        status: parsed.status as OrderStatus,
        source: parsed.source as OrderSource,
        staffScheduleOverride: bypassPosInStoreTiming,
        placedByUserId: actor?.sub ?? null,
        subtotal: parsed.pricing.subtotal,
        discountCode: parsed.pricing.discountCode,
        discountAmount: parsed.pricing.discountAmount,
        tax: parsed.pricing.tax,
        deliveryFee: parsed.pricing.deliveryFee,
        total: parsed.pricing.total,
        paymentMethod: parsed.payment.method as PaymentMethod,
        paymentStatus: parsed.payment.status as PaymentStatus,
        transactionId: parsed.payment.transactionId,
        // INT-005 — Apply casing map
        fulfillmentType: this.mapFulfillmentType(parsed.fulfillment.type),
        tableNumber: parsed.fulfillment.tableNumber,
        deliveryAddress: parsed.fulfillment.deliveryAddress,
        deliveryLatitude: parsed.fulfillment.deliveryLatitude,
        deliveryLongitude: parsed.fulfillment.deliveryLongitude,
        deliveryDistanceKm,
        deliveryGeoSource,
        deliveryCalcJson,
        estimatedReadyTime: parsed.fulfillment.estimatedReadyTime ? new Date(parsed.fulfillment.estimatedReadyTime) : null,
        kitchenPriority: (parsed.kitchen?.priority ?? 'normal') as KitchenPriority,
        items: {
          create: parsed.items.map(item => ({
            id: item.lineItemId,
            menuItemId: item.wrapId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            modifiersJson: item.modifiers as Prisma.InputJsonValue,
          }))
        }
      };

      if (parsed.customer?.customerId) {
        orderData.customerId = parsed.customer.customerId;
      } else if (parsed.customer?.name) {
        const guest = await this.customerService.findOrCreateGuestByPhone(
          parsed.customer.name,
          parsed.customer.phone,
        );
        orderData.customerId = guest.id;
      }

      const order = await tx.order.create({
        data: orderData,
        include: { items: true },
      });

      await this.txPaymentSidecar(tx).paymentEvent.create({
        data: {
          orderId: order.id,
          eventType: 'payment_intent_created',
          paymentMethod: order.paymentMethod,
          metadataJson: {
            source: order.source,
            paymentStatus: order.paymentStatus,
            idempotencyKey: idempotencyKey?.trim() || null,
          },
        },
      });
      if (order.paymentMethod === 'cash' && order.paymentStatus === 'completed') {
        await this.txPaymentSidecar(tx).paymentEvent.create({
          data: {
            orderId: order.id,
            eventType: 'cash_collected',
            paymentMethod: 'cash',
            actorRole: 'CASHIER',
            note: 'Collected at order placement',
          },
        });
      }
      await this.outboxService.appendUsingTx(tx, {
        eventType: 'order.created',
        eventVersion: 1,
        entityType: 'order',
        entityId: order.id,
        correlationId: idempotencyKey?.trim() || null,
        idempotencyKey: `order.created:${order.id}:v1`,
        payloadJson: {
          orderId: order.id,
          status: order.status,
          source: order.source,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          fulfillmentType: order.fulfillmentType,
        } as Prisma.InputJsonValue,
      });
      return order;
    });

    let created;
    try {
      created = await buildCreate();
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'P2002' && stableOrderId) {
        const existing = await this.prisma.order.findUnique({
          where: { id: stableOrderId },
          include: { items: true },
        });
        if (existing) return existing;
      }
      if (code === 'P2003') {
        // Usually means a cart item references a menu item that no longer exists.
        throw new BadRequestException(
          'One or more items are no longer available. Please refresh menu and try again.',
        );
      }
      throw error;
    }

    this.logger.log(
      `Order created id=${created.id} source=${created.source} legacyClientPayload=${fromLegacyClientCart}`,
    );

    const isClientOrder =
      created.source === 'client_web' || created.source === 'client_mobile';
    await this.recordOpsActivity({
      entityType: 'order',
      entityId: created.id,
      eventType: 'order.created',
      summary: `Order placed via ${created.source}`,
      app: isClientOrder ? 'client' : 'cashier',
      actor: actor ?? undefined,
      actorRoleFallback: isClientOrder && !actor ? SHOPPER_ROLE : undefined,
      metadataJson: {
        status: created.status,
        source: created.source,
        paymentMethod: created.paymentMethod,
        paymentStatus: created.paymentStatus,
        fulfillmentType: created.fulfillmentType,
        ...((created as { staffScheduleOverride?: boolean }).staffScheduleOverride
          ? { staffScheduleOverride: true }
          : {}),
      },
    });
    this.notifyQueueProjectionChanged({ orderId: created.id, type: 'order.created' });
    return created;
  }

  async markCashReceived(
    orderId: string,
    actor: RequestUser,
    note?: string,
  ): Promise<any> {
    return this.markPaymentReceived(orderId, actor, 'cash', note);
  }

  async markPaymentReceived(
    orderId: string,
    actor: RequestUser,
    method: Extract<PaymentMethod, 'cash' | 'card'>,
    note?: string,
  ): Promise<any> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (actor.role === 'COURIER') {
      if (order.fulfillmentType !== 'delivery') {
        throw new BadRequestException('Courier payment collection is only valid for delivery orders');
      }
      if (order.courierId && order.courierId !== actor.sub) {
        throw new BadRequestException('Only assigned courier can collect payment for this delivery');
      }
    }

    const allowedMethods: PaymentMethod[] = ['cash', 'card'];
    if (!allowedMethods.includes(method)) {
      throw new BadRequestException('Unsupported collection method');
    }

    if (order.paymentStatus === 'completed' || order.status === 'paid') {
      const current = await this.getOrderById(orderId);
      return { order: current, collectionApplied: false };
    }
    if (['cancelled', 'voided', 'refunded'].includes(order.status)) {
      throw new BadRequestException(`Cannot collect payment for ${order.status} order`);
    }
    if (!['placed', 'ready', 'in_transit', 'delivered'].includes(order.status)) {
      throw new BadRequestException('Payment can only be collected near handoff');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentMethod: method,
          paymentStatus: 'completed' as PaymentStatus,
          // Non-delivery handoff orders can close immediately once payment is collected at pickup.
          ...(order.status === 'ready' && order.fulfillmentType !== 'delivery'
            ? { status: 'delivered' as OrderStatus }
            : // Do not regress progressed orders back to paid.
              order.status === 'placed'
              ? { status: 'paid' as OrderStatus }
              : {}),
        },
        include: { items: true, customer: true },
      });

      await this.txPaymentSidecar(tx).paymentEvent.create({
        data: {
          orderId,
          eventType: method === 'card' ? 'card_collected' : 'cash_collected',
          paymentMethod: method,
          actorRole: actor.role,
          actorUserId: actor.sub,
          note: note?.trim() ? note.trim() : null,
          metadataJson: {
            previousStatus: order.status,
            actorName: actor.fullName ?? null,
            actorEmail: actor.email ?? null,
          },
        },
      });
      await this.outboxService.appendUsingTx(tx, {
        eventType: 'order.payment_collected',
        eventVersion: 1,
        entityType: 'order',
        entityId: orderId,
        correlationId: actor.sub,
        idempotencyKey: `order.payment_collected:${orderId}:${method}:v1`,
        payloadJson: {
          orderId,
          method,
          actorRole: actor.role,
          actorUserId: actor.sub,
          previousStatus: order.status,
        } as Prisma.InputJsonValue,
      });
      if (saved.status === 'paid') {
        await this.outboxService.appendUsingTx(tx, {
          eventType: NOTIFICATION_JOB.orderPaid,
          eventVersion: 1,
          entityType: 'order',
          entityId: orderId,
          correlationId: actor.sub,
          idempotencyKey: `${NOTIFICATION_JOB.orderPaid}:${orderId}:v1`,
          payloadJson: {
            orderId,
            correlationId: actor.sub,
          } as Prisma.InputJsonValue,
        });
        await this.outboxService.appendUsingTx(tx, {
          eventType: PRINT_JOB.cashierReceipt,
          eventVersion: 1,
          entityType: 'order',
          entityId: orderId,
          correlationId: actor.sub,
          idempotencyKey: `${PRINT_JOB.cashierReceipt}:${orderId}:v1`,
          payloadJson: {
            orderId,
            correlationId: actor.sub,
          } as Prisma.InputJsonValue,
        });
      }

      return saved;
    });

    await this.recordOpsActivity({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.payment_collected',
      summary: `${method.toUpperCase()} payment collected`,
      actor,
      metadataJson: {
        method,
        previousStatus: order.status,
      },
    });
    this.notifyQueueProjectionChanged({ orderId, type: 'order.payment_collected' });
    return { order: updated, collectionApplied: true, collectedMethod: method };
  }

  async getOrders(status?: string, fulfillmentType?: string): Promise<unknown[]> {
    const statusArray = status ? status.split(',') : [];
    const where: any =
      statusArray.length > 0 ? { status: { in: statusArray as OrderStatus[] } } : {};
    if (fulfillmentType) where.fulfillmentType = fulfillmentType;
    return this.prisma.order.findMany({
      where,
      include: { items: true, customer: true },
      orderBy: { placedAt: 'desc' },
    });
  }

  async getQueue(
    status?: string,
    fulfillmentType?: string,
    actor?: RequestUser,
    date?: string,
    page?: number,
    limit?: number,
  ): Promise<
    | (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[]
    | {
        items: (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[];
        total: number;
        page: number;
        limit: number;
        hasMore: boolean;
      }
  > {
    type QueueResult =
      | (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[]
      | {
          items: (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[];
          total: number;
          page: number;
          limit: number;
          hasMore: boolean;
        };

    const t0 = Date.now();
    const parsedPage = Number(page ?? 1);
    const parsedLimit = Number(limit ?? 100);
    const safePage = Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1;
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(200, Math.max(1, Math.floor(parsedLimit)))
      : 100;
    const statuses = status
      ? status.split(',').map((x) => x.trim())
      : ['placed', 'paid', 'in_kitchen', 'ready', 'in_transit'];
    const persona = staffRoleToResponsePersona(actor?.role);
    const where: Prisma.OrderWhereInput = {
      status: { in: statuses as OrderStatus[] },
      AND: [
        {
          OR: [
            { status: { not: 'placed' } },
            { paymentMethod: 'cash' },
            { paymentStatus: 'completed' },
          ],
        },
      ],
    };
    if (fulfillmentType) where.fulfillmentType = fulfillmentType as FulfillmentType;
    let dateWindow: { start: string; end: string } | null = null;
    if (date) {
      const window = await this.getOperationalWindow(date);
      where.placedAt = { gte: window.start, lt: window.end };
      dateWindow = { start: window.start.toISOString(), end: window.end.toISOString() };
    }
    const paginated = page != null || limit != null;
    const ttlMs = this.queueCacheTtlMs();
    const usedReadReplica = this.prismaRead != null;

    let cacheKey: string | null = null;
    let queueRev: number | undefined;
    if (ttlMs > 0) {
      queueRev = await this.queueCache.getGlobalRevForCache();
      cacheKey = this.queueResponseCacheKey({
        v: 2,
        queueRev,
        persona,
        statuses: [...statuses].sort(),
        fulfillmentType: fulfillmentType ?? null,
        dateWindow,
        actorRole: actor?.role ?? null,
        actorSub: actor?.sub ?? null,
        safePage,
        safeLimit,
        paginated,
      });
      const cached = await this.queueCache.getJson(cacheKey);
      if (cached !== undefined) {
        this.queueCache.pruneMemory();
        const elapsed = Date.now() - t0;
        const approx =
          Array.isArray(cached) ? cached.length : (cached as { items?: unknown[] }).items?.length;
        this.logQueuePerf({
          ms: elapsed,
          cacheHit: true,
          usedReadReplica,
          approxOrders: approx,
          queueRev,
        });
        return cached as QueueResult;
      }
    }

    const read = this.prismaForQueueRead();
    const projectArgs = {
      where,
      persona,
      actor,
      safePage,
      safeLimit,
      paginated,
      page,
      limit,
    };
    let result: Awaited<ReturnType<OrderService['projectQueuePage']>>;
    try {
      result = await this.projectQueuePage(read, projectArgs);
    } catch (err) {
      /** Misconfigured or down read replica would otherwise surface as HTTP 500 for every queue load. */
      if (this.prismaRead != null && read === this.prismaRead) {
        this.logger.warn(
          `getQueue: read replica failed (${(err as Error)?.message ?? String(err)}); retrying primary`,
        );
        result = await this.projectQueuePage(this.prisma as unknown as PrismaClient, projectArgs);
      } else {
        throw err;
      }
    }

    if (ttlMs > 0 && cacheKey) {
      await this.queueCache.setJson(cacheKey, result, ttlMs);
      this.queueCache.pruneMemory();
    }

    const elapsed = Date.now() - t0;
    this.logQueuePerf({
      ms: elapsed,
      cacheHit: false,
      usedReadReplica,
      orderCount: Array.isArray(result) ? result.length : result.items.length,
      total: Array.isArray(result) ? result.length : result.total,
      queueRev,
    });
    return result;
  }

  private async projectQueuePage(
    read: PrismaClient,
    args: {
      where: Prisma.OrderWhereInput;
      persona: ResponsePersona;
      actor?: RequestUser;
      safePage: number;
      safeLimit: number;
      paginated: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<
    | (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[]
    | {
        items: (OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder)[];
        total: number;
        page: number;
        limit: number;
        hasMore: boolean;
      }
  > {
    const { where, persona, actor, safePage, safeLimit, paginated, page, limit } = args;
    const findArgs = buildQueueOrderFindManyArgs(persona, where);
    const [orders, total] = await Promise.all([
      read.order.findMany(findArgs),
      read.order.count({ where }),
    ]);
    const settings = await this.orderSidecarsUsing(read).businessSettings.findUnique({
      where: { id: 'singleton' },
    });
    const minLeadMinutes = Number(settings?.minLeadTimeMinutes ?? 20);
    const now = new Date();

    /** Runtime always includes `items` + `customer` (include or select); Prisma union needs a single payload type for `.map`. */
    type QueueRow = Prisma.OrderGetPayload<{ include: { customer: true; items: true } }>;
    const mapped: QueueOrder[] = (orders as unknown as QueueRow[]).map((o) => {
      const role = String(actor?.role ?? 'ADMIN');
      const est = o.estimatedReadyTime ?? null;
      const timing = this.computeKitchenTimingForQueue(
        {
          status: o.status,
          paymentStatus: o.paymentStatus,
          fulfillmentType: o.fulfillmentType,
          paymentMethod: o.paymentMethod,
          source: o.source,
          transactionId: o.transactionId,
          estimatedReadyTime: est,
          placedAt: o.placedAt,
        },
        minLeadMinutes,
        now,
      );
      const context: OrderTransitionPolicyContext & {
        paymentStatus: PaymentStatus;
        fulfillmentType: FulfillmentType;
        paymentMethod: PaymentMethod;
        source: OrderSource;
      } = {
        paymentStatus: o.paymentStatus,
        fulfillmentType: o.fulfillmentType,
        paymentMethod: o.paymentMethod,
        source: o.source,
        transactionId: o.transactionId,
        courierId: o.courierId,
        actorSub: actor?.sub,
        estimatedReadyTime: est,
        placedAt: o.placedAt,
        minLeadMinutes,
      };
      const nextStatuses = this.transitionGraph()[o.status] ?? [];
      const allowedNextStatuses = nextStatuses.filter((next) =>
        this.canTransition(o.status, next, role, context),
      );
      const blockedReasonsByStatus = Object.fromEntries(
        nextStatuses
          .map((next) => [
            next,
            this.blockedReasonForTransition(o.status, next, role, context),
          ])
          .filter(([, reason]) => reason !== null),
      ) as QueueOrder['blockedReasonsByStatus'];

      return {
        id: o.id,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        paymentCollection: this.derivePaymentCollection({
          source: o.source,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          fulfillmentType: o.fulfillmentType,
          transactionId: o.transactionId,
        }),
        source: o.source,
        subtotal: o.subtotal,
        discountCode: o.discountCode,
        discountAmount: o.discountAmount,
        tax: o.tax,
        deliveryFee: o.deliveryFee,
        fulfillmentType: o.fulfillmentType,
        tableNumber: o.tableNumber,
        deliveryAddress: o.deliveryAddress,
        ...this.deliveryMeta(o),
        estimatedReadyTime: o.estimatedReadyTime,
        courierId: o.courierId,
        transactionId: o.transactionId,
        kitchenPriority: o.kitchenPriority,
        printedAt: o.printedAt,
        readyAt: o.readyAt,
        customer: o.customer
          ? { id: o.customer.id, name: o.customer.name, phone: o.customer.phone }
          : null,
        itemCount: o.items.length,
        items: o.items.map((item) => this.queueOrderItemToDto(item)),
        total: o.total,
        placedAt: o.placedAt,
        updatedAt: o.updatedAt,
        kitchenEligible: timing.kitchenEligible,
        releaseReason: timing.releaseReason,
        kitchenReleaseAt: timing.kitchenReleaseAt?.toISOString() ?? null,
        priorityDeadlineAt: timing.priorityDeadlineAt.toISOString(),
        slaBucket: timing.slaBucket,
        paymentRisk:
          o.paymentStatus === 'completed' ? 'LOW' : o.paymentMethod === 'cash' ? 'MEDIUM' : 'HIGH',
        staffScheduleOverride:
          (o as { staffScheduleOverride?: boolean }).staffScheduleOverride === true,
        allowedNextStatuses,
        actions: {
          canMove: allowedNextStatuses.length > 0,
          canAssignCourier:
            o.status === 'ready' &&
            o.fulfillmentType === 'delivery' &&
            this.canTransition(o.status, 'in_transit', role, context),
          canCollectPayment:
            ['in_transit', 'delivered', 'ready', 'placed'].includes(o.status) &&
            o.paymentStatus !== 'completed' &&
            ['COURIER', 'CASHIER', 'ADMIN'].includes(role),
          canMarkDelivered:
            (o.status === 'in_transit' || o.status === 'ready') &&
            this.canTransition(o.status, 'delivered', role, context),
          canVoid: this.canTransition(o.status, 'voided', role, context),
          canRefund: this.canTransition(o.status, 'refunded', role, context),
        },
        blockedReasonsByStatus,
      };
    });

    const sorted = [...mapped].sort((a, b) => this.compareQueueOrderPriority(a, b));
    const projected = sorted.map((q) => projectQueueOrderForPersona(persona, q));
    this.warnQueueProjectionBatch(persona, projected);
    if (!paginated) {
      return projected;
    }
    const start = (safePage - 1) * safeLimit;
    const items = projected.slice(start, start + safeLimit);
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      hasMore: start + items.length < total,
    };
  }

  async searchOrdersForSupport(q?: string): Promise<QueueOrder[]> {
    const query = String(q ?? '').trim();
    if (query.length < 2) return [];
    const lowered = query.toLowerCase();
    const digits = query.replace(/\D+/g, '');
    const compact = lowered.replace(/[^a-f0-9]/g, '');
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { id: { contains: lowered, mode: 'insensitive' } },
          { customerName: { contains: query, mode: 'insensitive' } },
          { customerPhone: { contains: query } },
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { customer: { phone: { contains: query } } },
          ...(digits.length >= 5 ? [{ customerPhone: { contains: digits } }] : []),
          ...(digits.length >= 5 ? [{ customer: { phone: { contains: digits } } }] : []),
        ],
      },
      include: { customer: true, items: true },
      orderBy: { placedAt: 'desc' },
      take: 40,
    });
    const normalized = orders.map((o) => ({
      id: o.id,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      paymentCollection: this.derivePaymentCollection({
        source: o.source,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        fulfillmentType: o.fulfillmentType,
        transactionId: o.transactionId,
      }),
      fulfillmentType: o.fulfillmentType,
      tableNumber: o.tableNumber,
      deliveryAddress: o.deliveryAddress,
      ...this.deliveryMeta(o),
      estimatedReadyTime: o.estimatedReadyTime,
      customer: o.customer
        ? { id: o.customer.id, name: o.customer.name, phone: o.customer.phone }
        : null,
      customerName: o.customerName ?? o.customer?.name ?? null,
      customerPhone: o.customerPhone ?? o.customer?.phone ?? null,
      total: o.total,
      placedAt: o.placedAt,
      itemCount: o.items.length,
      staffScheduleOverride:
        (o as { staffScheduleOverride?: boolean }).staffScheduleOverride === true,
    }));
    // Queue cards show short uppercase IDs (e.g. F5DF7B7B). Support searching that format too.
    if (compact.length >= 6) {
      const byCompactId = normalized.filter((o) =>
        String(o.id).replace(/-/g, '').toLowerCase().includes(compact),
      );
      if (byCompactId.length > 0) return byCompactId;
    }
    if (digits.length < 5) return normalized;
    const hasDigits = (v: string | null | undefined) =>
      String(v ?? '').replace(/\D+/g, '').includes(digits);
    return normalized.filter(
      (o) => hasDigits(o.customerPhone) || hasDigits(o.id),
    );
  }

  async getSupportOrderDetails(id: string): Promise<SupportOrderDetails> {
    const requested = String(id ?? '').trim();
    let order = await this.prisma.order.findUnique({
      where: { id: requested },
      include: { customer: true, items: true, courier: true },
    });
    if (!order) {
      const compact = requested.toLowerCase().replace(/[^a-f0-9]/g, '');
      if (compact.length >= 6) {
        order = await this.prisma.order.findFirst({
          where: { id: { contains: compact, mode: 'insensitive' } },
          include: { customer: true, items: true, courier: true },
          orderBy: { placedAt: 'desc' },
        });
      }
    }
    if (!order) throw new NotFoundException('Order not found');
    const staffEvents = await this.orderSidecars().paymentEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const cashierEvent = staffEvents.find((e) => String(e.actorRole ?? '').toUpperCase() === 'CASHIER');
    const kitchenEvent = staffEvents.find((e) => String(e.actorRole ?? '').toUpperCase() === 'KITCHEN');

    return {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentCollection: this.derivePaymentCollection({
        source: order.source,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        fulfillmentType: order.fulfillmentType,
        transactionId: order.transactionId,
      }),
      source: order.source,
      fulfillmentType: order.fulfillmentType,
      tableNumber: order.tableNumber,
      deliveryAddress: order.deliveryAddress,
      ...this.deliveryMeta(order),
      estimatedReadyTime: order.estimatedReadyTime,
      placedAt: order.placedAt,
      updatedAt: order.updatedAt,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      tax: order.tax,
      deliveryFee: order.deliveryFee,
      total: order.total,
      customer: {
        id: order.customer?.id ?? null,
        name: order.customerName ?? order.customer?.name ?? null,
        phone: order.customerPhone ?? order.customer?.phone ?? null,
      },
      courierName: order.courier?.name ?? null,
      cashierName: cashierEvent ? this.actorDisplayNameFromEvent(cashierEvent) : null,
      kitchenName: kitchenEvent ? this.actorDisplayNameFromEvent(kitchenEvent) : null,
      staffScheduleOverride:
        (order as { staffScheduleOverride?: boolean }).staffScheduleOverride === true,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        modifiers: item.modifiersJson ?? null,
      })),
    };
  }

  async getOrderPaymentEvents(id: string): Promise<PaymentEventRow[]> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    const events = await this.orderSidecars().paymentEvent.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      paymentMethod: e.paymentMethod ?? null,
      actorRole: e.actorRole ?? null,
      actorUserId: e.actorUserId ?? null,
      note: e.note ?? null,
      metadataJson: e.metadataJson ?? null,
      createdAt: e.createdAt,
    }));
  }

  async getOrderActivityEvents(id: string): Promise<OpsActivityEventRow[]> {
    return this.activityService.listByOrderId(id);
  }

  async getGlobalActivityFeed(
    take?: number,
    entityType?: string,
    app?: string,
    actorRole?: string,
    eventType?: string,
    q?: string,
    from?: string,
    to?: string,
  ): Promise<OpsActivityEventRow[]> {
    return this.activityService.listGlobalLegacy({
      take,
      entityType,
      app,
      actorRole,
      eventType,
      q,
      from,
      to,
    });
  }

  async getReconciliationSummary(date?: string) {
    const window = await this.getOperationalWindow(date ?? 'today');
    const orders = await this.prisma.order.findMany({
      where: {
        placedAt: {
          gte: window.start,
          lt: window.end,
        },
      },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
      },
    });
    const safeNum = (v: unknown) => Number(v ?? 0);
    const byMethod = ['cash', 'card', 'payhere', 'online'].map((method) => {
      const list = orders.filter((o) => o.paymentMethod === method);
      const completed = list.filter((o) => o.paymentStatus === 'completed');
      const pending = list.filter((o) => o.paymentStatus === 'pending');
      const failed = list.filter((o) => o.paymentStatus === 'failed');
      return {
        method,
        orderCount: list.length,
        completedCount: completed.length,
        pendingCount: pending.length,
        failedCount: failed.length,
        completedTotal: completed.reduce((sum, o) => sum + safeNum(o.total), 0),
      };
    });
    return {
      date: window.label,
      totalOrders: orders.length,
      completedPayments: orders.filter((o) => o.paymentStatus === 'completed').length,
      pendingPayments: orders.filter((o) => o.paymentStatus === 'pending').length,
      failedPayments: orders.filter((o) => o.paymentStatus === 'failed').length,
      byMethod,
    };
  }

  /**
   * Cashier POS cart preview: VAT + delivery fee using the same rules as `createOrder` for POS delivery.
   */
  async quotePosDeliveryPreview(input: { address: string; subtotal: number }): Promise<{
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    feeMode: 'flat' | 'distance';
    distanceKm: number | null;
    message?: string;
    code?: string;
  }> {
    const subtotal = Math.max(0, Math.round(Number(input.subtotal) * 100) / 100);
    const s = await this.orderSidecars().businessSettings.findUnique({
      where: { id: 'singleton' },
    });
    const vatRate = normalizeCheckoutVatRate(s?.checkoutVatRate ?? 0.15);
    const tax = Math.round(subtotal * vatRate * 100) / 100;
    const delRules = parseDeliveryJson(s?.deliveryJson ?? null);

    if (!delRules.enabled) {
      return {
        subtotal,
        deliveryFee: 0,
        tax,
        total: Math.round((subtotal + tax) * 100) / 100,
        feeMode: delRules.feeMode,
        distanceKm: null,
        message: 'Delivery is not enabled in settings.',
        code: 'delivery_disabled',
      };
    }

    const addr = String(input.address ?? '').trim();

    let lat: number | null = null;
    let lng: number | null = null;
    if (delRules.feeMode === 'distance') {
      if (addr.length < 3) {
        return {
          subtotal,
          deliveryFee: 0,
          tax,
          total: Math.round((subtotal + tax) * 100) / 100,
          feeMode: delRules.feeMode,
          distanceKm: null,
          message: 'Enter a delivery address to estimate the fee.',
          code: 'address_required',
        };
      }
      const g = await this.locationService.geocodeAddressLine(addr);
      if (g) {
        lat = g.latitude;
        lng = g.longitude;
      }
    }

    const feeResult = computeDeliveryFeeLkr(delRules, {
      fulfillmentIsDelivery: true,
      deliveryLat: lat,
      deliveryLng: lng,
    });

    let deliveryFee = feeResult.fee;
    let message: string | undefined;
    let code: string | undefined;
    const requireCoords = process.env.DELIVERY_REQUIRE_COORDS !== 'false';

    if (feeResult.error === 'coords_required') {
      deliveryFee = 0;
      code = 'coords_required';
      message = !requireCoords
        ? 'Distance fee needs a mappable address; amount may finalize when the order is placed.'
        : 'Could not locate this address. Add street, area, and city — the fee will finalize when you place the order.';
    } else if (feeResult.error === 'out_of_range') {
      code = 'out_of_range';
      message = 'This location looks outside the delivery radius.';
      deliveryFee = 0;
    } else if (feeResult.error === 'invalid_rules') {
      code = 'invalid_rules';
      message = 'Distance-based delivery is not configured.';
      deliveryFee = 0;
    }

    const distanceKm =
      typeof feeResult.distanceKm === 'number' ? Number(feeResult.distanceKm.toFixed(3)) : null;
    const total = Math.round((subtotal + tax + deliveryFee) * 100) / 100;

    return {
      subtotal,
      deliveryFee,
      tax,
      total,
      feeMode: delRules.feeMode,
      distanceKm,
      message,
      code,
    };
  }

  async trackOrderForClient(id: string, phone?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const rawPhone = String(phone ?? '').trim();
    if (!rawPhone) throw new ForbiddenException('Phone number is required');
    const normalize = (v: string) => v.replace(/\D+/g, '');
    const provided = normalize(rawPhone);
    const knownPhones = [order.customerPhone, order.customer?.phone]
      .filter(Boolean)
      .map((p) => normalize(String(p)));
    const matched = knownPhones.some((p) => p === provided);
    if (!matched) throw new ForbiddenException('Phone number does not match this order');
    return {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentCollection: this.derivePaymentCollection({
        source: order.source,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        fulfillmentType: order.fulfillmentType,
        transactionId: order.transactionId,
      }),
      fulfillmentType: order.fulfillmentType,
      deliveryAddress: order.deliveryAddress,
      ...this.deliveryMeta(order),
      deliveryFee: order.deliveryFee,
      estimatedReadyTime: order.estimatedReadyTime,
      customerName: order.customerName ?? order.customer?.name ?? 'Guest',
      itemCount: order.items.length,
      total: order.total,
      placedAt: order.placedAt,
      updatedAt: order.updatedAt,
    };
  }

  async updateOrderSupportDetails(
    id: string,
    actor: RequestUser,
    body: {
      customerName?: string;
      customerPhone?: string;
      tableNumber?: string;
      deliveryAddress?: string;
      estimatedReadyTime?: string | null;
      note?: string;
    },
  ) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Order not found');
    if (['delivered', 'cancelled', 'voided', 'refunded'].includes(existing.status)) {
      throw new BadRequestException('Cannot edit a completed/closed order');
    }
    const data: any = {};
    if (body.customerName !== undefined) data.customerName = body.customerName.trim() || null;
    if (body.customerPhone !== undefined) data.customerPhone = body.customerPhone.trim() || null;
    if (body.tableNumber !== undefined) data.tableNumber = body.tableNumber.trim() || null;
    if (body.deliveryAddress !== undefined) {
      data.deliveryAddress = body.deliveryAddress.trim() || null;
    }
    if (body.estimatedReadyTime !== undefined) {
      data.estimatedReadyTime = body.estimatedReadyTime
        ? new Date(body.estimatedReadyTime)
        : null;
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data,
        include: { customer: true, items: true },
      });
      await this.txPaymentSidecar(tx).paymentEvent.create({
        data: {
          orderId: id,
          eventType: 'order_support_updated',
          actorRole: actor.role,
          actorUserId: actor.sub,
          note: body.note?.trim() || 'Support update',
          metadataJson: {
            changed: Object.keys(data),
            actorName: actor.fullName ?? null,
            actorEmail: actor.email ?? null,
          },
        },
      });
      return order;
    });
    await this.recordOpsActivity({
      entityType: 'order',
      entityId: id,
      eventType: 'order.support_updated',
      summary: 'Support details updated',
      actor,
      metadataJson: {
        changed: Object.keys(data),
      },
    });
    this.notifyQueueProjectionChanged({ orderId: id, type: 'order.support_updated' });
    return updated;
  }

  async getOrderById(id: string): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    actor?: RequestUser,
    courierId?: string,
    replay?: boolean,
  ): Promise<any> {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Order not found');
    if (existing.status === status) {
      if (!replay) {
        throw new BadRequestException(
          `No-op transition rejected (${status} -> ${status}). Pass replay=true for explicit replay mode.`,
        );
      }
      await this.recordOpsActivity({
        entityType: 'order',
        entityId: id,
        eventType: 'order.status_replayed',
        summary: `Replayed ${status} event without state change`,
        actor,
        metadataJson: {
          status,
          replay: true,
        },
      });
      return existing;
    }
    const role = String(actor?.role ?? 'ADMIN');
    let minLeadMinutes = 20;
    if (status === 'in_kitchen') {
      const scheduleSettings = await this.orderSidecars().businessSettings.findUnique({
        where: { id: 'singleton' },
      });
      minLeadMinutes = Number(scheduleSettings?.minLeadTimeMinutes ?? 20);
    }
    if (status === 'paid' && existing.paymentStatus !== 'completed') {
      throw new BadRequestException(
        'Order cannot move to paid until payment status is completed',
      );
    }
    if (role === 'COURIER') {
      if (existing.fulfillmentType !== 'delivery') {
        throw new BadRequestException('Courier actions are only valid for delivery orders');
      }
      if (
        existing.courierId &&
        actor?.sub &&
        existing.courierId !== actor.sub &&
        status === 'delivered'
      ) {
        throw new BadRequestException('Only assigned courier can complete this delivery');
      }
    }
    if (
      !this.canTransition(existing.status, status, role, {
        paymentStatus: existing.paymentStatus,
        fulfillmentType: existing.fulfillmentType,
        paymentMethod: existing.paymentMethod,
        source: existing.source,
        transactionId: existing.transactionId,
        estimatedReadyTime: existing.estimatedReadyTime,
        placedAt: existing.placedAt,
        minLeadMinutes,
      })
    ) {
      throw new BadRequestException(
        `Invalid transition ${existing.status} -> ${status} for ${role}`,
      );
    }
    const updateData: any = { status };
    if (status === 'refunded') {
      updateData.paymentStatus = 'refunded' as PaymentStatus;
    }
    if (courierId) {
      updateData.courierId = courierId;
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: { items: true },
      });
      if (status === 'refunded') {
        await this.txPaymentSidecar(tx).paymentEvent.create({
          data: {
            orderId: id,
            eventType: 'order_refunded',
            paymentMethod: existing.paymentMethod,
            actorRole: actor?.role ?? 'SYSTEM',
            actorUserId: actor?.sub ?? null,
            note: 'Refunded via order status transition',
          },
        });
      }
      await this.outboxService.appendUsingTx(tx, {
        eventType: 'order.status_changed',
        eventVersion: 1,
        entityType: 'order',
        entityId: id,
        correlationId: actor?.sub ?? null,
        idempotencyKey: `order.status_changed:${id}:${status}:v1`,
        payloadJson: {
          orderId: id,
          fromStatus: existing.status,
          toStatus: status,
          actorRole: actor?.role ?? 'SYSTEM',
          actorUserId: actor?.sub ?? null,
        } as Prisma.InputJsonValue,
      });
      if (status === 'paid' || status === 'ready' || status === 'in_transit') {
        const notificationEventType =
          status === 'paid'
            ? NOTIFICATION_JOB.orderPaid
            : status === 'ready'
              ? NOTIFICATION_JOB.orderReady
              : NOTIFICATION_JOB.orderInTransit;
        await this.outboxService.appendUsingTx(tx, {
          eventType: notificationEventType,
          eventVersion: 1,
          entityType: 'order',
          entityId: id,
          correlationId: actor?.sub ?? null,
          idempotencyKey: `${notificationEventType}:${id}:v1`,
          payloadJson: {
            orderId: id,
            correlationId: actor?.sub ?? null,
          } as Prisma.InputJsonValue,
        });
      }
      if (status === 'paid' || status === 'in_kitchen' || status === 'ready') {
        const printEventType =
          status === 'paid'
            ? PRINT_JOB.cashierReceipt
            : status === 'in_kitchen'
              ? PRINT_JOB.kitchenTicket
              : PRINT_JOB.orderReadyNote;
        await this.outboxService.appendUsingTx(tx, {
          eventType: printEventType,
          eventVersion: 1,
          entityType: 'order',
          entityId: id,
          correlationId: actor?.sub ?? null,
          idempotencyKey: `${printEventType}:${id}:v1`,
          payloadJson: {
            orderId: id,
            correlationId: actor?.sub ?? null,
          } as Prisma.InputJsonValue,
        });
      }
      if (status === 'in_kitchen' || status === 'voided' || status === 'refunded') {
        const inventoryEventType =
          status === 'in_kitchen' ? INVENTORY_JOB.orderInKitchen : INVENTORY_JOB.orderReversal;
        await this.outboxService.appendUsingTx(tx, {
          eventType: inventoryEventType,
          eventVersion: 1,
          entityType: 'order',
          entityId: id,
          correlationId: actor?.sub ?? null,
          idempotencyKey: `${inventoryEventType}:${id}:${status}:v1`,
          payloadJson: {
            orderId: id,
            status,
            correlationId: actor?.sub ?? null,
          } as Prisma.InputJsonValue,
        });
      }
      return updated;
    });

    await this.recordOpsActivity({
      entityType: 'order',
      entityId: id,
      eventType: 'order.status_changed',
      summary: `Status changed to ${status}`,
      actor,
      metadataJson: {
        fromStatus: existing.status,
        toStatus: status,
        paymentStatus: order.paymentStatus,
      },
    });
    this.notifyQueueProjectionChanged({ orderId: id, type: 'order.status_changed' });
    return order;
  }

  /**
   * PRD-002 — Assign courier and trigger 'in_transit' state.
   */
  async assignCourier(orderId: string, courierId: string, actor?: RequestUser): Promise<any> {
    const order = await this.getOrderById(orderId);

    // Objective 2: State Guard — only READY
    if (order.status !== 'ready') {
      throw new BadRequestException(
        `Cannot assign courier to order in ${order.status} status. Status must be 'ready'.`
      );
    }

    // Constraints: Explicitly check for cancelled or delivered
    if (['cancelled', 'delivered'].includes(order.status as string)) {
      throw new BadRequestException(`Order is already ${order.status} and cannot be modified.`);
    }

    // Ensure assignment points to a valid courier entity.
    if (actor?.role === 'COURIER') {
      const existingCourier = await this.prisma.courier.findUnique({ where: { id: courierId } });
      if (!existingCourier) {
        await this.prisma.courier.create({
          data: {
            id: courierId,
            name: actor.fullName?.trim() || actor.email || 'Courier',
            phone: actor.phone?.trim() || 'N/A',
            isActive: true,
          },
        });
      } else if (!existingCourier.isActive) {
        throw new ForbiddenException(`Courier ${existingCourier.name} is currently inactive`);
      }
    } else {
      // Objective 4: Integration with StaffService (verify COURIER role & active)
      await this.staffService.validateCourier(courierId);
    }

    if (order.fulfillmentType !== 'delivery') {
      throw new BadRequestException('Courier assignment only applies to delivery orders.');
    }
    if (
      !this.canTransition(order.status, 'in_transit', 'COURIER', {
        paymentStatus: order.paymentStatus,
        fulfillmentType: order.fulfillmentType,
        paymentMethod: order.paymentMethod,
        source: order.source,
      })
    ) {
      throw new BadRequestException(`Invalid transition ${order.status} -> in_transit for courier.`);
    }

    // Objective 1 & 3: Assign and transition status
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        courierId,
        status: 'in_transit' as OrderStatus,
      },
      include: { items: true },
    });
    await this.outboxService.append({
      eventType: NOTIFICATION_JOB.orderInTransit,
      eventVersion: 1,
      entityType: 'order',
      entityId: orderId,
      correlationId: actor?.sub ?? null,
      idempotencyKey: `${NOTIFICATION_JOB.orderInTransit}:${orderId}:v1`,
      payloadJson: {
        orderId,
        correlationId: actor?.sub ?? null,
      } as Prisma.InputJsonValue,
    });

    this.logger.log(`Order ${orderId} assigned to courier ${courierId}. Status: IN_TRANSIT`);
    await this.recordOpsActivity({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.courier_assigned',
      summary: 'Courier assigned and moved to in_transit',
      actor,
      metadataJson: {
        courierId,
        previousStatus: order.status,
        currentStatus: updated.status,
      },
    });
    this.notifyQueueProjectionChanged({ orderId, type: 'order.courier_assigned' });

    return updated;
  }

  /**
   * Queue-driven payment orchestration entrypoint (webhook/reconciliation paid events).
   * Called by `PaymentService.processQueueJob`.
   */
  async handleOrderPaid(payload: unknown) {
    const eventPayload =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const orderId = String(eventPayload.orderId ?? '');
    if (!orderId) return;

    this.logger.log(`Order ${orderId} confirmed as PAID via Server Webhook/Reconciliation`);

    // Use updateOrderStatus to ensure consistency and downstream events (print, inventory)
    // Avoid double deduction if already processed (though InventoryService has its own check)
    try {
      const maybeTransactionId =
        eventPayload.payment_id ?? eventPayload.paymentId ?? eventPayload.transactionId ?? null;
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'completed' as PaymentStatus,
          ...(maybeTransactionId ? { transactionId: String(maybeTransactionId) } : {}),
        },
      });
      try {
        await this.updateOrderStatus(
          orderId,
          'paid',
          { sub: 'system', email: '', role: 'ADMIN' },
        );
      } catch (error: unknown) {
        if (error instanceof BadRequestException) {
          this.logger.warn(
            `Skipped paid transition for order ${orderId}; current state no longer eligible.`,
          );
        } else {
          throw error;
        }
      }
      await this.recordOpsActivity({
        entityType: 'order',
        entityId: orderId,
        eventType: 'order.payment_confirmed',
        summary: 'Payment confirmed by webhook/reconciliation',
        app: 'system',
        // Keep JSON payload primitives explicit for Prisma InputJsonValue compatibility.
        metadataJson: {
          correlationId: (() => {
            const raw = eventPayload.correlationId ?? null;
            return raw == null ? null : String(raw);
          })(),
          paymentId: (() => {
            const raw =
              eventPayload.payment_id ?? eventPayload.paymentId ?? eventPayload.transactionId ?? null;
            return raw == null ? null : String(raw);
          })(),
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const correlationId = (() => {
        const raw = eventPayload.correlationId ?? null;
        return raw == null ? null : String(raw);
      })();
      await this.recordOpsActivity({
        entityType: 'order',
        entityId: orderId,
        eventType: 'order.async_handler_failed',
        summary: 'order.paid handler failed',
        app: 'system',
        metadataJson: {
          handler: 'order.handleOrderPaid',
          retryAttempt: Number(eventPayload.retryAttempt ?? 0),
          correlationId,
          error: message,
        },
      });
      this.logger.error(`Failed to update order ${orderId} to PAID: ${message}`);
    }
  }
}
