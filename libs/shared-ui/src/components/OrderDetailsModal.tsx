'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, MapPin, UserRound } from 'lucide-react';
import {
  formatPaymentCollectionDisplayLabel,
  formatPersistedDiscountCaption,
  formatStaffPaymentMethodLabel,
  type OpsActivityEventRow,
  type QueueOrder,
  type SupportOrderDetails,
} from '@wrap-roll/contracts';
import { getOrderItemModifierDisplayLines, isModifierLinePriority } from '@wrap-roll/order-kit';
import { cn } from '../lib/utils';
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

function latestActorByRole(
  events: OpsActivityEventRow[],
  role: string,
): { name: string; userId: string } | null {
  const upper = role.toUpperCase();
  for (const ev of events) {
    const actorRole = String(ev.actor?.role ?? '').toUpperCase();
    const name = String(ev.actor?.name ?? '').trim();
    const userId = String(ev.actor?.userId ?? '').trim();
    if (actorRole !== upper) continue;
    if (!name && !userId) continue;
    return { name: name || '-', userId: userId || '-' };
  }
  return null;
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

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-neutral-100 py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3 sm:py-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 sm:w-36">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-snug text-neutral-900">{children}</div>
    </div>
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
  const fulfillmentRaw = String(details?.fulfillmentType ?? order.fulfillmentType ?? '').toLowerCase();
  const isDeliveryOrder = fulfillmentRaw === 'delivery';
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
  const latestKitchenActor = latestActorByRole(paymentEvents, 'KITCHEN');
  const latestCashierActor = latestActorByRole(paymentEvents, 'CASHIER');
  const latestCourierActor = latestActorByRole(paymentEvents, 'COURIER');

  const resolvedCourierNameRaw =
    (typeof detailsAny.courierName === 'string' && detailsAny.courierName.trim()) || '-';
  const resolvedCourierName =
    resolvedCourierNameRaw !== '-' ? resolvedCourierNameRaw : latestCourierActor?.name || '-';
  const resolvedCourierRef = resolvedCourier !== '-' ? String(resolvedCourier) : latestCourierActor?.userId || '-';
  const resolvedKitchen = kitchenRef ? String(kitchenRef) : '-';
  const resolvedKitchenNameRaw =
    (typeof detailsAny.kitchenName === 'string' && detailsAny.kitchenName.trim()) || '-';
  const resolvedKitchenName =
    resolvedKitchenNameRaw !== '-' ? resolvedKitchenNameRaw : latestKitchenActor?.name || '-';
  const resolvedKitchenRef = resolvedKitchen !== '-' ? resolvedKitchen : latestKitchenActor?.userId || '-';
  const resolvedCashier = cashierRef
    ? String(cashierRef)
    : (details?.source ?? order.source)?.toString().startsWith('cashier_pos')
      ? 'POS'
      : '-';
  const resolvedCashierNameRaw =
    (typeof detailsAny.cashierName === 'string' && detailsAny.cashierName.trim()) || '-';
  const resolvedCashierName =
    resolvedCashierNameRaw !== '-' ? resolvedCashierNameRaw : latestCashierActor?.name || '-';
  const resolvedCashierRef =
    resolvedCashier !== '-' ? resolvedCashier : latestCashierActor?.userId || '-';
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
        className="flex max-h-[min(92vh,900px)] flex-col overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-4xl sm:rounded-[28px]"
      >
        <DialogHeader className="shrink-0 border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
          <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
            Order details
          </DialogTitle>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Full order, payment, and support context
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-neutral-50/40 px-6 py-6 sm:px-8 sm:py-7">
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
                Payment {formatStaffPaymentMethodLabel(details?.paymentMethod ?? order.paymentMethod ?? '-')}
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

          <div className="rounded-xl border border-neutral-200/80 bg-white p-1 shadow-sm">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  tab === 'overview'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-50',
                )}
                onClick={() => setTab('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  tab === 'items'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-50',
                )}
                onClick={() => setTab('items')}
              >
                Items
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  tab === 'timeline'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-50',
                )}
                onClick={() => setTab('timeline')}
              >
                Activity log
              </button>
            </div>
          </div>

          {loading ? <p className="text-xs text-muted-foreground">Loading full order details...</p> : null}

          {tab === 'overview' ? (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Customer & fulfillment
                </p>
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/40 px-1">
                  <DetailField label="Source">{details?.source ?? order.source ?? '-'}</DetailField>
                  <DetailField label="Fulfillment">{resolvedFulfillment}</DetailField>
                  <DetailField label={isDeliveryOrder ? 'Delivery status' : 'Order status'}>
                    {resolvedStatus}
                  </DetailField>
                  <DetailField label="Client">
                    {clientName}
                    {clientPhone !== '-' ? (
                      <span className="text-neutral-500"> · {clientPhone}</span>
                    ) : null}
                  </DetailField>
                  <DetailField label="Phone">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {clientPhone}
                      <CopyInline
                        label="client phone"
                        copied={copiedKey === 'client-phone'}
                        onCopy={() => void copyText('client-phone', clientPhone)}
                      />
                    </span>
                  </DetailField>
                  <DetailField label="Address">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {resolvedAddress}
                      <CopyInline
                        label="delivery address"
                        copied={copiedKey === 'address'}
                        onCopy={() => void copyText('address', resolvedAddress)}
                      />
                    </span>
                  </DetailField>
                  <DetailField label="Table">{resolvedTable}</DetailField>
                  <DetailField label="Kitchen">
                    {resolvedKitchenName}{' '}
                    {resolvedKitchenRef !== '-' ? (
                      <span className="text-[11px] text-neutral-400">({shortRef(resolvedKitchenRef)})</span>
                    ) : null}
                  </DetailField>
                  <DetailField label="Cashier">
                    {resolvedCashierName}{' '}
                    {resolvedCashierRef !== '-' ? (
                      <span className="text-[11px] text-neutral-400">({shortRef(resolvedCashierRef)})</span>
                    ) : null}
                  </DetailField>
                  <DetailField label="Courier">
                    {resolvedCourierName}{' '}
                    {resolvedCourierRef !== '-' ? (
                      <span className="text-[11px] text-neutral-400">({shortRef(resolvedCourierRef)})</span>
                    ) : null}
                  </DetailField>
                  <DetailField label="Scheduled">
                    {fmtDate(details?.estimatedReadyTime ?? order.estimatedReadyTime) === '-'
                      ? 'ASAP'
                      : fmtDate(details?.estimatedReadyTime ?? order.estimatedReadyTime)}
                  </DetailField>
                  <DetailField label="Placed">{fmtDate(details?.placedAt ?? order.placedAt)}</DetailField>
                  <DetailField label="Updated">{fmtDate(details?.updatedAt ?? order.updatedAt)}</DetailField>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Payment & totals
                </p>
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/40 px-1">
                  <DetailField label="Payment method">
                    {formatStaffPaymentMethodLabel(details?.paymentMethod ?? order.paymentMethod ?? '-')}
                  </DetailField>
                  <DetailField label="Payment status">
                    {details?.paymentStatus ?? order.paymentStatus ?? '-'}
                  </DetailField>
                  <DetailField label="Subtotal">
                    {fmtMoney(details?.subtotal ?? order.subtotal ?? 0)}
                  </DetailField>
                  <DetailField label="Discount">
                    {fmtMoney(details?.discountAmount ?? order.discountAmount ?? 0)}
                    {discountCaption ? (
                      <span className="text-neutral-500"> ({discountCaption})</span>
                    ) : null}
                  </DetailField>
                  <DetailField label="Tax">
                    {fmtMoney(details?.tax ?? order.tax ?? 0)}
                  </DetailField>
                  <DetailField label="Delivery fee">
                    {fmtMoney(details?.deliveryFee ?? order.deliveryFee ?? 0)}
                  </DetailField>
                  <div className="mt-1 border-t border-neutral-200 pt-1">
                    <DetailField label="Total">
                      <span className="font-semibold tabular-nums text-neutral-900">
                        {fmtMoney(details?.total ?? order.total)}
                      </span>
                    </DetailField>
                  </div>
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
        </div>

        <div className="shrink-0 border-t border-neutral-200 bg-gradient-to-b from-neutral-50/60 to-white px-6 py-4 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 font-semibold shadow-sm"
                onClick={onEditCustomer}
              >
                <UserRound className="h-4 w-4 opacity-80" aria-hidden />
                Edit customer
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 font-semibold shadow-sm"
                onClick={onEditFulfillment}
              >
                <MapPin className="h-4 w-4 opacity-80" aria-hidden />
                Edit fulfillment
              </Button>
            </div>
            <p className="text-[11px] text-neutral-500">
              Tip: use the copy icons beside phone & address in Overview.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
