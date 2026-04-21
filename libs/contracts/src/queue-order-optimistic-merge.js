"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeQueueOrderFromApiPatch = mergeQueueOrderFromApiPatch;
/**
 * Unwraps API bodies: `PATCH .../mark-payment-received` returns `{ order, collectionApplied }`;
 * `PATCH .../status` and `PATCH .../support` return a Prisma order object.
 */
function extractOrderPayload(body) {
    if (!body || typeof body !== 'object')
        return null;
    const o = body;
    if (o.order && typeof o.order === 'object') {
        return o.order;
    }
    if (typeof o.id === 'string') {
        return o;
    }
    return null;
}
function asIsoString(v) {
    if (v == null)
        return v;
    if (typeof v === 'string')
        return v;
    if (v instanceof Date)
        return v.toISOString();
    return String(v);
}
function num(v) {
    if (v == null)
        return undefined;
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}
function mergeCustomer(existing, raw) {
    if (!raw || typeof raw !== 'object')
        return existing;
    const c = raw;
    const name = c.name != null ? String(c.name) : existing === null || existing === void 0 ? void 0 : existing.name;
    const phone = c.phone != null ? String(c.phone) : existing === null || existing === void 0 ? void 0 : existing.phone;
    const id = c.id != null ? String(c.id) : existing === null || existing === void 0 ? void 0 : existing.id;
    if (name == null && phone == null && id == null)
        return existing;
    return { ...existing, id, name: name !== null && name !== void 0 ? name : null, phone: phone !== null && phone !== void 0 ? phone : null };
}
/**
 * Merges server order fields from a PATCH response onto an existing queue row.
 * Preserves projection-only fields (`allowedNextStatuses`, `actions`, SLA, etc.) until the next full `GET /orders/queue` refresh.
 */
function mergeQueueOrderFromApiPatch(existing, apiBody) {
    var _a, _b, _c;
    const row = extractOrderPayload(apiBody);
    if (!row)
        return existing;
    const next = {};
    if (typeof row.status === 'string') {
        next.status = row.status;
    }
    if (typeof row.paymentStatus === 'string') {
        next.paymentStatus = row.paymentStatus;
    }
    if (typeof row.paymentMethod === 'string') {
        next.paymentMethod = row.paymentMethod;
    }
    if (row.paymentCollection != null) {
        next.paymentCollection = row.paymentCollection;
    }
    if (typeof row.source === 'string') {
        next.source = row.source;
    }
    if (typeof row.fulfillmentType === 'string') {
        next.fulfillmentType = row.fulfillmentType;
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
            row.estimatedReadyTime == null ? null : ((_a = asIsoString(row.estimatedReadyTime)) !== null && _a !== void 0 ? _a : null);
    }
    if (row.placedAt !== undefined) {
        next.placedAt = row.placedAt == null ? null : ((_b = asIsoString(row.placedAt)) !== null && _b !== void 0 ? _b : null);
    }
    if (row.updatedAt !== undefined) {
        next.updatedAt = row.updatedAt == null ? null : ((_c = asIsoString(row.updatedAt)) !== null && _c !== void 0 ? _c : null);
    }
    if (row.courierId !== undefined) {
        next.courierId = row.courierId == null ? null : String(row.courierId);
    }
    if (row.transactionId !== undefined) {
        next.transactionId = row.transactionId == null ? null : String(row.transactionId);
    }
    if (row.kitchenPriority !== undefined) {
        next.kitchenPriority = row.kitchenPriority;
    }
    const t = num(row.total);
    if (t !== undefined)
        next.total = t;
    const st = num(row.subtotal);
    if (st !== undefined)
        next.subtotal = st;
    const tax = num(row.tax);
    if (tax !== undefined)
        next.tax = tax;
    const df = num(row.deliveryFee);
    if (df !== undefined)
        next.deliveryFee = df;
    const disc = num(row.discountAmount);
    if (disc !== undefined)
        next.discountAmount = disc;
    if (row.customer !== undefined) {
        next.customer = mergeCustomer(existing.customer, row.customer);
    }
    if (Array.isArray(row.items)) {
        next.items = row.items.map((it) => {
            var _a, _b, _c, _d, _e;
            const i = it && typeof it === 'object' ? it : {};
            return {
                id: String((_a = i.id) !== null && _a !== void 0 ? _a : ''),
                menuItemId: i.menuItemId != null ? String(i.menuItemId) : undefined,
                name: String((_b = i.name) !== null && _b !== void 0 ? _b : ''),
                quantity: (_c = num(i.quantity)) !== null && _c !== void 0 ? _c : 0,
                unitPrice: (_d = num(i.unitPrice)) !== null && _d !== void 0 ? _d : 0,
                lineTotal: (_e = num(i.lineTotal)) !== null && _e !== void 0 ? _e : 0,
                modifiersJson: i.modifiersJson,
            };
        });
    }
    if (typeof row.itemCount === 'number') {
        next.itemCount = row.itemCount;
    }
    return { ...existing, ...next };
}
//# sourceMappingURL=queue-order-optimistic-merge.js.map