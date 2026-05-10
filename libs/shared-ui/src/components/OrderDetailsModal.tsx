'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  formatPaymentCollectionDisplayLabel,
  formatPersistedDiscountCaption,
  type OpsActivityEventRow,
  type QueueOrder,
  type SupportOrderDetails,
} from '@wrap-roll/contracts';
import { getOrderItemModifierDisplayLines, isModifierLinePriority } from '@wrap-roll/order-kit';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

type OrderDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: QueueOrder | null;
  details?: SupportOrderDetails | null;
  paymentEvents?: OpsActivityEventRow[];
  loading?: boolean;
  onEditCustomer?: () => void;
  onEditFulfillment?: () => void;
};

function fmtDate(value: unknown): string {
  if (!value) return '-';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function fmtMoney(value: unknown): string {
  return `LKR ${Number(value ?? 0).toFixed(2)}`;
}

function toTitleWords(value: unknown): string {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function shortRef(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (/^[0-9a-fA-F-]{32,}$/.test(raw)) return `${raw.slice(0, 8)}...`;
  return raw;
}

function activitySummary(ev: OpsActivityEventRow): string {
  const fallback = ev.summary || ev.eventType || '-';
  if (ev.eventType === 'activity.queue_processed') {
    const meta =
      ev.metadataJson && typeof ev.metadataJson === 'object'
        ? (ev.metadataJson as Record<string, unknown>)
        : null;
    const sourceEvent = typeof meta?.sourceEventType === 'string' ? meta.sourceEventType : '';
    if (sourceEvent) return `Queue worker processed ${sourceEvent}`;
    return 'Queue worker processed an event';
  }
  return fallback;
}

function hasCheckoutAbortedEvent(events: OpsActivityEventRow[]): boolean {
  return events.some(
    (ev) => ev.eventType === 'payment.checkout_aborted' || ev.eventType === 'online_checkout_aborted',
  );
}

function CopyInline({
  label,
  copied,
  onCopy,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
      onClick={onCopy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function OrderDetailsModal({
  open,
  onOpenChange,
  order,
  details,
  paymentEvents = [],
  loading = false,
  onEditCustomer,
  onEditFulfillment,
}: OrderDetailsModalProps) {
  const [tab, setTab] = useState<'overview' | 'items' | 'timeline'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTab('overview');
  }, [open, order?.id]);

  if (!order) return null;

  const detailsAny = (details ?? {}) as Record<string, unknown>;
  const orderAny = order as Record<string, unknown>;
  const kitchenRef =
    detailsAny.kitchenStaffId ??
    detailsAny.kitchenUserId ??
    orderAny.kitchenStaffId ??
    orderAny.kitchenUserId ??
    null;
  const cashierRef =
    detailsAny.cashierStaffId ??
    detailsAny.cashierUserId ??
    orderAny.cashierStaffId ??
    orderAny.cashierUserId ??
    null;

  const resolvedStatus = toTitleWords(details?.status ?? order.status ?? '-');
  const resolvedFulfillment = toTitleWords(details?.fulfillmentType ?? order.fulfillmentType ?? '-');
  const resolvedPaymentCollection = formatPaymentCollectionDisplayLabel(
    details?.paymentCollection ?? order.paymentCollection ?? 'immediate',
    details?.fulfillmentType ?? order.fulfillmentType,
  );
  const staffScheduleOverride = Boolean(
    details?.staffScheduleOverride ?? orderAny.staffScheduleOverride,
  );
  const clientName = details?.customer?.name || order.customer?.name || 'Guest';
  const clientPhone = details?.customer?.phone || order.customer?.phone || '-';
  const resolvedAddress = details?.deliveryAddress || order.deliveryAddress || '-';
  const resolvedTable = details?.tableNumber || order.tableNumber || '-';
  const resolvedCourier = order.courierId ?? '-';
  const resolvedCourierName =
    (typeof detailsAny.courierName === 'string' && detailsAny.courierName.trim()) || '-';
  const resolvedKitchen = kitchenRef ? String(kitchenRef) : '-';
  const resolvedKitchenName =
    (typeof detailsAny.kitchenName === 'string' && detailsAny.kitchenName.trim()) || '-';
  const resolvedCashier = cashierRef
    ? String(cashierRef)
    : (details?.source ?? order.source)?.toString().startsWith('cashier_pos')
      ? 'POS'
      : '-';
  const resolvedCashierName =
    (typeof detailsAny.cashierName === 'string' && detailsAny.cashierName.trim()) || '-';
  const checkoutAborted = hasCheckoutAbortedEvent(paymentEvents);
  const discountCaption = formatPersistedDiscountCaption({
    discountCode: details?.discountCode ?? order.discountCode ?? null,
    discountAmount: detailsAny.discountAmount ?? orderAny.discountAmount ?? 0,
  });

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1300);
    } catch {
      // noop
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-4xl sm:rounded-[28px]"
      >
        <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
          <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
            Order details
          </DialogTitle>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Full order, payment, and support context
          </p>
        </DialogHeader>

        <div className="max-h-[calc(88vh-92px)] space-y-5 overflow-y-auto bg-neutral-50/40 px-6 py-6 sm:px-8 sm:py-7">
          <div className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                {resolvedFulfillment}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {resolvedStatus}
              </span>
            </div>
            <p className="font-display text-xl font-black text-neutral-900">
              #{String(order.id).slice(0, 8).toUpperCase()}
              <CopyInline
                label="order id"
                copied={copiedKey === 'order-id'}
                onCopy={() => void copyText('order-id', String(order.id))}
              />
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                Payment {toTitleWords(details?.paymentMethod ?? order.paymentMethod ?? '-')}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                {toTitleWords(resolvedPaymentCollection)}
              </span>
              <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                {(details?.items?.length ?? 0) || 0} item{(details?.items?.length ?? 0) === 1 ? '' : 's'}
              </span>
              {staffScheduleOverride ? (
                <span
                  className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900"
                  title="Order accepted on POS outside public opening / cutoff window (in-store)."
                >
                  Staff schedule override
                </span>
              ) : null}
              <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                Total {fmtMoney(details?.total ?? order.total)}
              </span>
              {checkoutAborted ? (
                <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-800">
                  Checkout aborted
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-1">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-black ${tab === 'overview' ? 'bg-primary text-white' : 'text-slate-600'}`}
                onClick={() => setTab('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-black ${tab === 'items' ? 'bg-primary text-white' : 'text-slate-600'}`}
                onClick={() => setTab('items')}
              >
                Items
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-black ${tab === 'timeline' ? 'bg-primary text-white' : 'text-slate-600'}`}
                onClick={() => setTab('timeline')}
              >
                Activity log
              </button>
            </div>
          </div>

          {loading ? <p className="text-xs text-muted-foreground">Loading full order details...</p> : null}

          {tab === 'overview' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-800">Customer and fulfillment</p>
                </div>
                <div className="space-y-1.5 text-sm text-neutral-700">
                  <p><strong>Source:</strong> {details?.source ?? order.source ?? '-'}</p>
                  <p>
                    <strong>Client:</strong> {clientName}{' '}
                    {clientPhone !== '-' ? `(${clientPhone})` : ''}
                  </p>
                  <p>
                    <strong>Phone:</strong> {clientPhone}{' '}
                    <CopyInline
                      label="client phone"
                      copied={copiedKey === 'client-phone'}
                      onCopy={() => void copyText('client-phone', clientPhone)}
                    />
                  </p>
                  <p>
                    <strong>Address:</strong> {resolvedAddress}{' '}
                    <CopyInline
                      label="delivery address"
                      copied={copiedKey === 'address'}
                      onCopy={() => void copyText('address', resolvedAddress)}
                    />
                  </p>
                  <p><strong>Table:</strong> {resolvedTable}</p>
                  <p>
                    <strong>Kitchen:</strong> {resolvedKitchenName}{' '}
                    {resolvedKitchen !== '-' ? (
                      <span className="text-[11px] text-neutral-400">
                        ({shortRef(resolvedKitchen)})
                      </span>
                    ) : null}
                  </p>
                  <p>
                    <strong>Cashier:</strong> {resolvedCashierName}{' '}
                    {resolvedCashier !== '-' ? (
                      <span className="text-[11px] text-neutral-400">
                        ({shortRef(resolvedCashier)})
                      </span>
                    ) : null}
                  </p>
                  <p>
                    <strong>Courier:</strong> {resolvedCourierName}{' '}
                    {resolvedCourier !== '-' ? (
                      <span className="text-[11px] text-neutral-400">
                        ({shortRef(resolvedCourier)})
                      </span>
                    ) : null}
                  </p>
                  <p><strong>Scheduled:</strong> {fmtDate(details?.estimatedReadyTime ?? order.estimatedReadyTime) === '-' ? 'ASAP' : fmtDate(details?.estimatedReadyTime ?? order.estimatedReadyTime)}</p>
                  <p><strong>Placed:</strong> {fmtDate(details?.placedAt ?? order.placedAt)}</p>
                  <p><strong>Updated:</strong> {fmtDate(details?.updatedAt ?? order.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-800">Payment and totals</p>
                </div>
                <div className="space-y-1.5 text-sm text-neutral-700">
                  <p><strong>Payment method:</strong> {details?.paymentMethod ?? order.paymentMethod ?? '-'}</p>
                  <p><strong>Payment status:</strong> {details?.paymentStatus ?? order.paymentStatus ?? '-'}</p>
                  <p><strong>Total:</strong> {fmtMoney(details?.total ?? order.total)}</p>
                  <p><strong>Subtotal:</strong> {fmtMoney((details as any)?.subtotal ?? order.subtotal ?? 0)}</p>
                  <p>
                    <strong>Discount:</strong>{' '}
                    {fmtMoney((details as any)?.discountAmount ?? order.discountAmount ?? 0)}
                    {discountCaption ? (
                      <span className="text-neutral-500"> ({discountCaption})</span>
                    ) : null}
                  </p>
                  <p><strong>Tax:</strong> {fmtMoney((details as any)?.tax ?? order.tax ?? 0)}</p>
                  <p><strong>Delivery fee:</strong> {fmtMoney((details as any)?.deliveryFee ?? order.deliveryFee ?? 0)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'items' ? (
            details?.items?.length ? (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="mb-2 text-sm font-semibold text-neutral-800">Purchased items</p>
                <div className="space-y-3">
                  {details.items.map((it) => {
                    const modifierLines = getOrderItemModifierDisplayLines(it.modifiers);
                    return (
                      <div key={it.id}>
                        <p className="text-sm text-neutral-700">
                          {it.quantity}x {it.name} - {fmtMoney(it.lineTotal)}
                          {it.unitPrice !== undefined ? ` (unit ${fmtMoney(it.unitPrice)})` : ''}
                        </p>
                        {modifierLines.length > 0 ? (
                          <div className="mt-1.5 border-l-2 border-neutral-200 pl-3 text-xs text-neutral-600">
                            {modifierLines.map((line, idx) => (
                              <p
                                key={`${it.id}-m-${idx}`}
                                className={
                                  isModifierLinePriority(line.label)
                                    ? 'font-semibold text-amber-800'
                                    : undefined
                                }
                              >
                                {line.label}: {line.value}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">No item details available.</p>
              </div>
            )
          ) : null}

          {tab === 'timeline' ? (
            paymentEvents.length ? (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="mb-2 text-sm font-semibold text-neutral-800">Activity timeline</p>
                <div className="space-y-1.5">
                  {paymentEvents.map((ev) => (
                    <p key={ev.id} className="text-sm text-neutral-700">
                      {new Date(ev.createdAt).toLocaleString()} • {activitySummary(ev)}
                      {ev.actor?.name ? ` • ${ev.actor.name}` : ''}
                      {ev.actor?.role ? ` • ${ev.actor.role}` : ''}
                      {ev.eventType ? ` • ${ev.eventType}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">No activity events found.</p>
              </div>
            )
          ) : null}

          <div className="grid gap-2 md:grid-cols-2">
            <Button type="button" variant="outline" onClick={onEditCustomer}>
              Edit customer
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={onEditFulfillment}>
                Edit fulfillment
              </Button>
              <div className="flex items-center justify-end pr-2 text-xs text-muted-foreground">
                Copy fields where needed.
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
