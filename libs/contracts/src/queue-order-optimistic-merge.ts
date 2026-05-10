import type { QueueOrder } from './order.api.contracts';

/**
 * Unwraps API bodies: `PATCH .../mark-payment-received` returns `{ order, collectionApplied }`;
 * `PATCH .../status` and `PATCH .../support` return a Prisma order object.
 */
function extractOrderPayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (o.order && typeof o.order === 'object') {
    return o.order as Record<string, unknown>;
  }
  if (typeof o.id === 'string') {
    return o;
  }
  return null;
}

function asIsoString(v: unknown): string | null | undefined {
  if (v == null) return v as undefined;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function mergeCustomer(
  existing: QueueOrder['customer'],
  raw: unknown,
): QueueOrder['customer'] {
  if (!raw || typeof raw !== 'object') return existing;
  const c = raw as Record<string, unknown>;
  const name = c.name != null ? String(c.name) : existing?.name;
  const phone = c.phone != null ? String(c.phone) : existing?.phone;
  const id = c.id != null ? String(c.id) : existing?.id;
  if (name == null && phone == null && id == null) return existing;
  return { ...existing, id, name: name ?? null, phone: phone ?? null };
}

/**
 * Merges server order fields from a PATCH response onto an existing queue row.
 * Preserves projection-only fields (`allowedNextStatuses`, `actions`, SLA, etc.) until the next full `GET /orders/queue` refresh.
 */
export function mergeQueueOrderFromApiPatch(existing: QueueOrder, apiBody: unknown): QueueOrder {
  const row = extractOrderPayload(apiBody);
  if (!row) return existing;

  const next: Partial<QueueOrder> = {};

  if (typeof row.status === 'string') {
    next.status = row.status as QueueOrder['status'];
  }
  if (typeof row.paymentStatus === 'string') {
    next.paymentStatus = row.paymentStatus as QueueOrder['paymentStatus'];
  }
  if (typeof row.paymentMethod === 'string') {
    next.paymentMethod = row.paymentMethod as QueueOrder['paymentMethod'];
  }
  if (row.paymentCollection != null) {
    next.paymentCollection = row.paymentCollection as QueueOrder['paymentCollection'];
  }
  if (typeof row.source === 'string') {
    next.source = row.source as QueueOrder['source'];
  }
  if (typeof row.fulfillmentType === 'string') {
    next.fulfillmentType = row.fulfillmentType as QueueOrder['fulfillmentType'];
  }
  if (row.customerName !== undefined) {
    next.customerName = row.customerName == null ? null : String(row.customerName);
  }
  if (row.customerPhone !== undefined) {
    next.customerPhone = row.customerPhone == null ? null : String(row.customerPhone);
  }
  if (row.deliveryAddress !== undefined) {
    next.deliveryAddress = row.deliveryAddress == null ? null : String(row.deliveryAddress);
  }
  if (row.tableNumber !== undefined) {
    next.tableNumber = row.tableNumber == null ? null : String(row.tableNumber);
  }
  if (row.estimatedReadyTime !== undefined) {
    next.estimatedReadyTime =
      row.estimatedReadyTime == null ? null : (asIsoString(row.estimatedReadyTime) ?? null);
  }
  if (row.placedAt !== undefined) {
    next.placedAt = row.placedAt == null ? null : (asIsoString(row.placedAt) ?? null);
  }
  if (row.updatedAt !== undefined) {
    next.updatedAt = row.updatedAt == null ? null : (asIsoString(row.updatedAt) ?? null);
  }
  if (row.courierId !== undefined) {
    next.courierId = row.courierId == null ? null : String(row.courierId);
  }
  if (row.transactionId !== undefined) {
    next.transactionId = row.transactionId == null ? null : String(row.transactionId);
  }
  if (row.kitchenPriority !== undefined) {
    next.kitchenPriority = row.kitchenPriority as QueueOrder['kitchenPriority'];
  }

  const t = num(row.total);
  if (t !== undefined) next.total = t;
  const st = num(row.subtotal);
  if (st !== undefined) next.subtotal = st;
  const tax = num(row.tax);
  if (tax !== undefined) next.tax = tax;
  const df = num(row.deliveryFee);
  if (df !== undefined) next.deliveryFee = df;
  const disc = num(row.discountAmount);
  if (disc !== undefined) next.discountAmount = disc;
  if (row.discountCode !== undefined) {
    next.discountCode =
      row.discountCode == null || String(row.discountCode).trim() === ''
        ? null
        : String(row.discountCode).trim();
  }

  if (row.customer !== undefined) {
    next.customer = mergeCustomer(existing.customer, row.customer);
  }

  if (Array.isArray(row.items)) {
    next.items = row.items.map((it: unknown) => {
      const i = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        id: String(i.id ?? ''),
        menuItemId: i.menuItemId != null ? String(i.menuItemId) : undefined,
        name: String(i.name ?? ''),
        quantity: num(i.quantity) ?? 0,
        unitPrice: num(i.unitPrice) ?? 0,
        lineTotal: num(i.lineTotal) ?? 0,
        modifiersJson: i.modifiersJson,
      };
    });
  }

  if (typeof row.itemCount === 'number') {
    next.itemCount = row.itemCount;
  }

  return { ...existing, ...next };
}
