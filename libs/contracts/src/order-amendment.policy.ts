/**
 * Central policy for post-place order edits (production-style gates).
 * Keep in sync with ops docs; server enforces — clients use for UX hints only.
 */

export type AmendmentStaffRole = 'ADMIN' | 'CASHIER' | 'KITCHEN' | 'COURIER' | string;

export type OrderAmendmentSnapshot = {
  status: string;
  paymentStatus: string;
  fulfillmentType: string;
};

const TERMINAL_STATUSES = new Set(['delivered', 'cancelled', 'voided', 'refunded']);

export type LineReplacementPolicyResult =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

/**
 * Client / queue hints: whether the amend-lines affordance should appear (POS + ops cards).
 * ADMIN may open the editor whenever the order is not terminal.
 * Cashier follows payment + fulfillment locks via {@link evaluateCashierLineReplacement}.
 *
 * Save-time enforcement (override reason, etc.) uses {@link validateLineItemsReplacementSave}.
 */
export function evaluateLineItemReplacementPolicy(
  order: OrderAmendmentSnapshot,
  role: AmendmentStaffRole,
): LineReplacementPolicyResult {
  if (TERMINAL_STATUSES.has(order.status)) {
    return {
      allowed: false,
      code: 'TERMINAL_STATE',
      message: 'This order is closed — line items cannot be changed.',
    };
  }

  if (role === 'ADMIN') {
    return { allowed: true };
  }

  return evaluateCashierLineReplacement(order);
}

/**
 * Server: validates PATCH …/line-items. When cashier rules block edits, ADMIN must supply
 * `adminOverrideReason` (min 3 chars) for audit.
 */
export function validateLineItemsReplacementSave(
  order: OrderAmendmentSnapshot,
  role: AmendmentStaffRole,
  adminOverrideReason?: string | null,
): LineReplacementPolicyResult {
  if (TERMINAL_STATUSES.has(order.status)) {
    return {
      allowed: false,
      code: 'TERMINAL_STATE',
      message: 'This order is closed — line items cannot be changed.',
    };
  }

  const cashierPol = evaluateCashierLineReplacement(order);
  if (cashierPol.allowed) {
    return { allowed: true };
  }

  if (role === 'ADMIN') {
    const reason = String(adminOverrideReason ?? '').trim();
    if (reason.length < 3) {
      return {
        allowed: false,
        code: 'OVERRIDE_REASON_REQUIRED',
        message:
          'Admin override requires adminOverrideReason (at least 3 characters) when changing lines on a locked order.',
      };
    }
    return { allowed: true };
  }

  return cashierPol;
}

function evaluateCashierLineReplacement(order: OrderAmendmentSnapshot): LineReplacementPolicyResult {
  if (order.paymentStatus !== 'completed') {
    return { allowed: true };
  }

  if (order.fulfillmentType === 'delivery' && order.status === 'ready') {
    return {
      allowed: false,
      code: 'DELIVERY_READY_PAID',
      message:
        'This delivery order is ready for dispatch — line items cannot be changed. Start a new order for add-ons.',
    };
  }

  return {
    allowed: false,
    code: 'PAYMENT_COMPLETED',
    message:
      'Payment is recorded — cashier cannot amend lines here. Start a new order for add-ons. Emergency fixes: sign in with Admin staff role → Amend lines in POS → save with an override reason.',
  };
}

export type SupportEditPolicyResult =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

/**
 * Contact / table / schedule patches: blocked for cashier when delivery is ready for dispatch
 * and payment is completed (strict bag). Pending payment still allows corrections.
 * ADMIN always allowed (audit via note on PATCH).
 */
export function evaluateSupportDetailsEditPolicy(
  order: OrderAmendmentSnapshot,
  role: AmendmentStaffRole,
): SupportEditPolicyResult {
  if (TERMINAL_STATUSES.has(order.status)) {
    return {
      allowed: false,
      code: 'TERMINAL_STATE',
      message: 'Cannot edit details on a completed order.',
    };
  }
  if (role === 'ADMIN') {
    return { allowed: true };
  }

  if (
    order.fulfillmentType === 'delivery' &&
    order.status === 'ready' &&
    order.paymentStatus === 'completed'
  ) {
    return {
      allowed: false,
      code: 'DELIVERY_READY_PAID',
      message:
        'This delivery order is ready for dispatch — details cannot be changed. Contact an admin for emergencies.',
    };
  }

  return { allowed: true };
}
