import { formatPaymentCollectionLabel, type QueueOrder, type QueueOrderStatus } from '@wrap-roll/contracts';
import { Button } from './ui/button';

type QueueOrderCardProps = {
  order: QueueOrder;
  onOpen?: (orderId: string) => void;
  onMove?: (orderId: string, nextStatus: QueueOrderStatus) => void;
  onCollectCash?: (orderId: string) => void;
  onCollectCard?: (orderId: string) => void;
  showMoveAction?: boolean;
  showPaymentActions?: boolean;
  showDeliveryAddress?: boolean;
};

const MOVE_LABELS: Partial<Record<QueueOrderStatus, string>> = {
  paid: 'Mark paid',
  in_kitchen: 'Start prep',
  ready: 'Mark ready',
  in_transit: 'Dispatch',
  delivered: 'Mark delivered',
  cancelled: 'Cancel',
  voided: 'Void',
  refunded: 'Refund',
};

function toTitleWords(value: string): string {
  return String(value)
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function QueueOrderCard({
  order,
  onOpen,
  onMove,
  onCollectCash,
  onCollectCard,
  showMoveAction = true,
  showPaymentActions = true,
  showDeliveryAddress = false,
}: QueueOrderCardProps) {
  const isDelivery = order.fulfillmentType === 'delivery';
  const statusLabel =
    order.status === 'ready'
      ? isDelivery
        ? 'Ready For Delivery'
        : 'Ready For Pickup'
      : toTitleWords(order.status);
  const moveLabel = (next: QueueOrderStatus) => {
    if (next === 'ready') return isDelivery ? 'Mark ready for delivery' : 'Mark ready for pickup';
    if (next === 'delivered') return isDelivery ? 'Mark delivered' : 'Mark collected';
    return MOVE_LABELS[next] ?? `Move to ${next.replace(/_/g, ' ')}`;
  };
  const allowedNext = order.allowedNextStatuses ?? [];
  const preferredKitchenMove =
    order.status === 'placed' &&
    order.kitchenEligible === true &&
    allowedNext.includes('in_kitchen')
      ? 'in_kitchen'
      : null;
  const primaryMove = preferredKitchenMove ?? allowedNext[0];
  const primaryMoveBlockedReason = primaryMove
    ? order.blockedReasonsByStatus?.[primaryMove]
    : undefined;
  const canShowStartPrep =
    order.status === 'placed' &&
    (allowedNext.includes('in_kitchen') || Boolean(order.blockedReasonsByStatus?.in_kitchen));
  const startPrepBlockedReason = order.blockedReasonsByStatus?.in_kitchen;
  const canStartPrep = allowedNext.includes('in_kitchen') && !startPrepBlockedReason;
  const needsOnPickupMarkerForPrep =
    order.status === 'placed' &&
    order.fulfillmentType === 'takeaway' &&
    order.paymentMethod === 'cash' &&
    !String(order.transactionId ?? '')
      .toUpperCase()
      .startsWith('ON_PICKUP_');
  const startPrepHint =
    startPrepBlockedReason === 'KITCHEN_POLICY_BLOCK' && needsOnPickupMarkerForPrep
      ? 'Blocked: add pay-on-pickup marker (transactionId starts with ON_PICKUP_) to release kitchen prep.'
      : startPrepBlockedReason ?? undefined;
  const paymentCollectionLabel =
    order.paymentCollection && order.paymentCollection !== 'immediate'
      ? formatPaymentCollectionLabel(order.paymentCollection)
      : null;

  const fmtTime = (v: string | Date | undefined) => {
    if (v == null || v === '') return '';
    const d = typeof v === 'string' ? new Date(v) : v;
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  const scheduledAt = order.estimatedReadyTime ? fmtTime(order.estimatedReadyTime) : '';
  const releaseAt = order.kitchenReleaseAt ? fmtTime(order.kitchenReleaseAt) : '';
  const slaLabel =
    order.slaBucket === 'overdue'
      ? 'Overdue'
      : order.slaBucket === 'due_soon'
        ? 'Due soon'
        : null;

  return (
    <article className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen?.(order.id)}
        className="w-full text-left"
        aria-label={`Open order ${order.id}`}
      >
        <p className="text-base font-bold text-foreground">{order.id.slice(0, 8).toUpperCase()}</p>
        <p className="text-sm text-muted-foreground">
          {(order.customer?.name || order.customerName || 'Guest') + ' • LKR ' + Number(order.total).toFixed(2)}
        </p>
        {showDeliveryAddress && isDelivery && order.deliveryAddress ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {order.deliveryAddress}
          </p>
        ) : null}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {statusLabel}
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
          {toTitleWords(order.paymentStatus)}
        </span>
        {order.kitchenPriority === 'rush' ? (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
            Rush
          </span>
        ) : null}
        {isDelivery ? (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
            Delivery
          </span>
        ) : null}
        {scheduledAt ? (
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
            Scheduled {scheduledAt}
          </span>
        ) : null}
        {releaseAt && order.releaseReason === 'SCHEDULED_PENDING' ? (
          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900" title="Kitchen release time">
            Release {releaseAt}
          </span>
        ) : null}
        {slaLabel ? (
          <span
            className={
              order.slaBucket === 'overdue'
                ? 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-900'
                : 'rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-900'
            }
          >
            {slaLabel}
          </span>
        ) : null}
        {paymentCollectionLabel ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {toTitleWords(paymentCollectionLabel)}
          </span>
        ) : null}
        {order.paymentRisk ? (
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
            Risk: {toTitleWords(order.paymentRisk)}
          </span>
        ) : null}
        {order.staffScheduleOverride ? (
          <span
            className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"
            title="POS accepted outside public schedule/cutoff (in-store)."
          >
            Staff override
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {showMoveAction && primaryMove ? (
          <Button
            type="button"
            size="sm"
            className="h-9 w-full"
            disabled={!order.actions?.canMove || Boolean(primaryMoveBlockedReason)}
            onClick={() => onMove?.(order.id, primaryMove)}
            title={primaryMoveBlockedReason ?? undefined}
          >
            {moveLabel(primaryMove)}
          </Button>
        ) : null}

        {showMoveAction && canShowStartPrep && primaryMove !== 'in_kitchen' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 w-full"
            disabled={!canStartPrep}
            onClick={() => onMove?.(order.id, 'in_kitchen')}
            title={startPrepHint}
          >
            Start prep
          </Button>
        ) : null}

        {showPaymentActions && order.actions?.canCollectPayment && order.paymentStatus !== 'completed' ? (
          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full whitespace-nowrap"
              onClick={() => onCollectCash?.(order.id)}
            >
              Collect cash
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full whitespace-nowrap"
              onClick={() => onCollectCard?.(order.id)}
            >
              Collect card
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
