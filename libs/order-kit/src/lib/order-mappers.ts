import type {
  CashierOrderLineInput,
  CashierOrderLineOption,
  CashierOrderSyncPayload,
  QueueOrder,
  WrapOrder,
} from '@wrap-roll/contracts';

type QueueOrderItemRow = NonNullable<QueueOrder['items']>[number];
type QueueOrderLike = QueueOrder & {
  created_at?: string;
  updated_at?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
};

type LineModifiers = WrapOrder['items'][number]['modifiers'];

const DEFAULT_MODIFIERS: LineModifiers = {
  optionGroups: [],
};

/** Accepts JSON numbers or numeric strings (queued/offline payloads). */
export function normalizeOptionalPositiveMoney(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const n = parseFloat(raw.trim().replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
  }
  return undefined;
}

function normalizeOptionGroups(raw: unknown[]): LineModifiers['optionGroups'] {
  const out: LineModifiers['optionGroups'] = [];
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue;
    const o = g as Record<string, unknown>;
    const groupName = String(o.groupName ?? o.name ?? o.group ?? '').trim();
    const optionsRaw = Array.isArray(o.options)
      ? o.options
      : Array.isArray(o.selectedOptions)
        ? o.selectedOptions
        : [];
    const options: LineModifiers['optionGroups'][number]['options'] = [];
    for (const opt of optionsRaw) {
      if (opt && typeof opt === 'object') {
        const x = opt as Record<string, unknown>;
        const label = String(x.label ?? x.name ?? '').trim();
        if (!label) continue;
        const priceAdjust = Number(x.priceAdjust ?? 0);
        options.push({
          ...(typeof x.optionId === 'string' ? { optionId: x.optionId } : {}),
          label,
          ...(Number.isFinite(priceAdjust) && priceAdjust > 0 ? { priceAdjust } : {}),
        });
      }
    }
    if (options.length === 0) continue;
    out.push({
      ...(typeof o.groupId === 'string' ? { groupId: o.groupId } : {}),
      ...(groupName ? { groupName } : {}),
      ...(typeof o.name === 'string' ? { name: o.name } : {}),
      options,
    });
  }
  return out;
}

export function parseModifiersJson(raw: unknown): LineModifiers {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_MODIFIERS;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return DEFAULT_MODIFIERS;
  }
  const value = parsed as Record<string, unknown>;
  const og = value.optionGroups;
  const normalized = Array.isArray(og) ? normalizeOptionGroups(og) : [];

  return {
    optionGroups: normalized,
    ...(value.notes ? { notes: String(value.notes) } : {}),
  };
}

function asDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? new Date().toISOString());
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

/** Accepts standard hyphenated UUIDs (Postgres `uuid` / Prisma `String` ids). */
const HYPHENATED_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLikelyMenuItemUuid(value: unknown): value is string {
  return typeof value === 'string' && HYPHENATED_UUID_RE.test(value.trim());
}

function requireCashierLineMenuItemId(rawId: unknown, lineName: string): string {
  const id = typeof rawId === 'string' ? rawId.trim() : '';
  if (!id) {
    throw new Error(
      `Missing menu product id on line "${lineName}". Refresh the menu and re-add this item before syncing.`,
    );
  }
  if (!HYPHENATED_UUID_RE.test(id)) {
    throw new Error(
      `Invalid menu product id on line "${lineName}". Refresh the menu and re-add this item before syncing.`,
    );
  }
  return id;
}

function optionGroupsFromCashierSelections(
  selected: CashierOrderLineOption[] | undefined,
): LineModifiers['optionGroups'] {
  if (!Array.isArray(selected) || selected.length === 0) return [];
  const map = new Map<string, LineModifiers['optionGroups'][number]['options']>();
  for (const o of selected) {
    const gn = String(o.groupName ?? 'Options').trim() || 'Options';
    if (!map.has(gn)) map.set(gn, []);
    const priceAdjust = Number(o.priceAdjust ?? 0);
    map.get(gn)!.push({
      label: String(o.label),
      ...(Number.isFinite(priceAdjust) && priceAdjust > 0 ? { priceAdjust } : {}),
    });
  }
  return Array.from(map.entries()).map(([groupName, options]) => ({ groupName, options }));
}

export function queueOrderToWrapOrder(dbOrder: QueueOrderLike): WrapOrder {
  return {
    orderId: dbOrder.id,
    status: dbOrder.status as WrapOrder['status'],
    source: (dbOrder.source ?? 'cashier_pos') as WrapOrder['source'],
    placedAt: asDateString(dbOrder.placedAt ?? dbOrder.created_at),
    updatedAt: asDateString(
      dbOrder.updatedAt ?? dbOrder.updated_at ?? dbOrder.placedAt ?? dbOrder.created_at,
    ),
    customer: {
      customerId: dbOrder.customer?.id ?? undefined,
      name:
        dbOrder.customer?.name ??
        dbOrder.customerName ??
        dbOrder.customer_name ??
        'Guest',
      phone:
        dbOrder.customer?.phone ??
        dbOrder.customerPhone ??
        dbOrder.customer_phone ??
        undefined,
    },
    items: (dbOrder.items ?? []).map((item: QueueOrderItemRow) => ({
      lineItemId: item.id,
      wrapId: item.menuItemId ?? item.id,
      name: item.name,
      availability: 'available',
      quantity: asNumber(item.quantity, 1),
      unitPrice: asNumber(item.unitPrice),
      modifiers: parseModifiersJson(item.modifiersJson),
      lineTotal: asNumber(item.lineTotal),
    })),
    pricing: {
      subtotal: asNumber(dbOrder.subtotal),
      discountCode: dbOrder.discountCode ?? undefined,
      discountAmount: asNumber(dbOrder.discountAmount),
      tax: asNumber(dbOrder.tax),
      deliveryFee: asNumber(dbOrder.deliveryFee),
      total: asNumber(dbOrder.total),
    },
    payment: {
      method: (dbOrder.paymentMethod ?? 'cash') as WrapOrder['payment']['method'],
      status: (dbOrder.paymentStatus ?? 'pending') as WrapOrder['payment']['status'],
      transactionId: dbOrder.transactionId ?? undefined,
    },
    fulfillment: {
      type: (dbOrder.fulfillmentType ?? 'takeaway') as WrapOrder['fulfillment']['type'],
      tableNumber: dbOrder.tableNumber ?? undefined,
      deliveryAddress: dbOrder.deliveryAddress ?? undefined,
      courierId: dbOrder.courierId ?? undefined,
      estimatedReadyTime: dbOrder.estimatedReadyTime
        ? asDateString(dbOrder.estimatedReadyTime)
        : undefined,
    },
    kitchen: {
      priority: dbOrder.kitchenPriority ?? 'normal',
      printedAt: dbOrder.printedAt ? asDateString(dbOrder.printedAt) : undefined,
      readyAt: dbOrder.readyAt ? asDateString(dbOrder.readyAt) : undefined,
    },
  };
}

/** Line items only — for `PATCH /orders/:id/line-items` amendment payloads. */
export function cashierPayloadToWrapOrderItems(
  body: CashierOrderSyncPayload,
  createId: () => string,
): WrapOrder['items'] {
  return cashierPayloadToWrapOrder(body, createId).items;
}

export function cashierPayloadToWrapOrder(
  body: CashierOrderSyncPayload,
  createId: () => string,
): WrapOrder {
  const now = new Date().toISOString();
  const source =
    String(body.orderSource ?? 'cashier_pos_offline') === 'cashier_pos'
      ? 'cashier_pos'
      : 'cashier_pos_offline';
  const method = String(body.paymentMethod ?? 'CASH').toUpperCase() === 'CARD' ? 'card' : 'cash';
  const rawFulfillment = String(body.fulfillmentType ?? 'takeaway').toLowerCase();
  const fulfillmentType =
    rawFulfillment === 'dine_in' || rawFulfillment === 'delivery'
      ? rawFulfillment
      : 'takeaway';
  const rawPaymentCollection = String(body.paymentCollection ?? 'immediate').toLowerCase();
  const paymentCollection =
    rawPaymentCollection === 'on_delivery'
      ? 'on_delivery'
      : rawPaymentCollection === 'on_pickup'
        ? 'on_pickup'
        : rawPaymentCollection === 'at_collection'
          ? 'at_collection'
          : 'immediate';
  const paymentStatus = paymentCollection === 'immediate' ? 'completed' : 'pending';
  const items = Array.isArray(body.items) ? body.items : [];
  const normalizedDiscountCode =
    typeof body.discountCode === 'string' && body.discountCode.trim().length > 0
      ? body.discountCode.trim().toUpperCase()
      : undefined;
  const manualDiscountAmount = normalizeOptionalPositiveMoney(body.manualDiscountAmount);
  const lineSubtotal = items.reduce(
    (acc: number, item) => acc + item.unitPrice * (item.quantity ?? 1),
    0,
  );
  const subtotal = Math.round(lineSubtotal * 100) / 100;
  const tax = parseFloat((subtotal * 0.0).toFixed(2));

  return {
    orderId: createId(),
    status: paymentStatus === 'completed' ? 'paid' : 'placed',
    source,
    placedAt: body.createdAt ?? now,
    updatedAt: now,
    customer: {
      name: body.customerName ?? 'Walk-in Customer',
      phone: body.customerPhone ?? undefined,
    },
    items: items.map((item) => ({
      lineItemId: createId(),
      wrapId: requireCashierLineMenuItemId(item.id, item.name ?? 'Unknown Item'),
      name: item.name ?? 'Unknown Item',
      availability: 'available',
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice,
      modifiers: {
        optionGroups: optionGroupsFromCashierSelections(item.selectedOptions),
        ...(item.notes ? { notes: item.notes } : {}),
      },
      lineTotal: item.unitPrice * (item.quantity ?? 1),
    })),
    pricing: {
      subtotal,
      ...(normalizedDiscountCode ? { discountCode: normalizedDiscountCode } : {}),
      ...(manualDiscountAmount !== undefined ? { manualDiscountAmount } : {}),
      discountAmount: 0,
      tax,
      deliveryFee: 0,
      total: subtotal + tax,
    },
    payment: {
      method,
      status: paymentStatus,
      transactionId: (() => {
        if (paymentCollection === 'on_delivery') return `ON_DELIVERY_${Date.now()}`;
        if (paymentCollection === 'on_pickup') return `ON_PICKUP_${Date.now()}`;
        if (paymentCollection === 'at_collection') {
          if (fulfillmentType === 'delivery') return `ON_DELIVERY_${Date.now()}`;
          if (fulfillmentType === 'takeaway') return `ON_PICKUP_${Date.now()}`;
          return `AT_COLLECTION_${Date.now()}`;
        }
        return method === 'card' ? `CARD_${Date.now()}` : `CASH_${Date.now()}`;
      })(),
      ...(typeof body.cashTenderAuditNote === 'string' && body.cashTenderAuditNote.trim().length > 0
        ? {
            posCashTenderNote: body.cashTenderAuditNote.trim().slice(0, 400),
          }
        : {}),
    },
    fulfillment: {
      type: fulfillmentType,
      tableNumber: body.tableNumber ?? undefined,
      deliveryAddress:
        fulfillmentType === 'delivery' ? body.deliveryAddress?.trim() || undefined : undefined,
      ...(fulfillmentType === 'delivery' &&
      body.deliveryLatitude != null &&
      body.deliveryLongitude != null &&
      Number.isFinite(Number(body.deliveryLatitude)) &&
      Number.isFinite(Number(body.deliveryLongitude))
        ? {
            deliveryLatitude: Number(body.deliveryLatitude),
            deliveryLongitude: Number(body.deliveryLongitude),
          }
        : {}),
    },
    kitchen: {
      priority: 'normal',
    },
  };
}

/** Hydrate POS cart lines from a queue/API order row for line-item amendments. */
export function queueOrderLineToCashierLineInput(item: QueueOrderItemRow): CashierOrderLineInput {
  const mod = parseModifiersJson(item.modifiersJson);
  const selectedOptions: CashierOrderLineOption[] = mod.optionGroups.flatMap((g) =>
    (g.options ?? []).map((o) => ({
      groupName: String(g.groupName ?? g.name ?? 'Option'),
      label: o.label,
      priceAdjust: Number(o.priceAdjust ?? 0),
    })),
  );
  const menuId =
    item.menuItemId && isLikelyMenuItemUuid(item.menuItemId) ? item.menuItemId : item.id;
  const qty = Math.max(1, asNumber(item.quantity, 1));
  const lineTotal = asNumber(item.lineTotal, 0);
  const storedUnit = asNumber(item.unitPrice, 0);
  /** Prefer authoritative line total so cart matches kitchen/order (handles modifier pricing drift). */
  const unitPrice =
    lineTotal > 0 && qty > 0 ? Number((lineTotal / qty).toFixed(2)) : storedUnit;
  return {
    id: menuId,
    name: item.name,
    unitPrice,
    quantity: item.quantity,
    ...(selectedOptions.length > 0 ? { selectedOptions } : {}),
    ...(mod.notes ? { notes: mod.notes } : {}),
  };
}

export function queueOrderLinesToCashierInputs(items: QueueOrderItemRow[]): CashierOrderLineInput[] {
  return items.map(queueOrderLineToCashierLineInput);
}
