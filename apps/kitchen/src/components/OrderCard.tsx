'use client';

import React from 'react';
import type { KitchenQueueOrder, OrderStatus, QueueOrder } from '@wrap-roll/contracts';
import { Button, cn, OrderTicket } from '@wrap-roll/shared-ui';
import { getOrderItemModifierDisplayLines, isModifierLinePriority } from '@wrap-roll/order-kit';
import { useNowInterval } from '../hooks/useNowInterval';
import { fulfillmentTypeLabel } from '../lib/kds-lane';

type KdsQueueOrder = KitchenQueueOrder | QueueOrder;

interface OrderCardProps {
  queueOrder: KdsQueueOrder;
  onStatusChange?: (id: string, status: OrderStatus) => void;
}

function formatElapsedSincePlaced(placedMs: number, nowMs: number): string {
  let ms = nowMs - placedMs;
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
  }
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export const OrderCard: React.FC<OrderCardProps> = ({ queueOrder, onStatusChange }) => {
  const nowMs = useNowInterval(15_000);

  const customerName =
    queueOrder.customer?.name?.trim() ||
    ('customerName' in queueOrder && queueOrder.customerName
      ? String(queueOrder.customerName).trim()
      : '') ||
    'Guest';
  const tableNumber = queueOrder.tableNumber ?? undefined;
  const fulfillmentType = queueOrder.fulfillmentType;
  const isDineIn = fulfillmentType === 'dine_in';
  const laneTitle = fulfillmentTypeLabel(fulfillmentType);
  const placedAtRaw = queueOrder.placedAt;
  const placedAt =
    placedAtRaw != null && placedAtRaw !== ''
      ? typeof placedAtRaw === 'string'
        ? new Date(placedAtRaw)
        : placedAtRaw
      : new Date();

  const placedMs = placedAt.getTime();
  const elapsedLabel = formatElapsedSincePlaced(placedMs, nowMs);

  const laneStripClass = cn(
    'mb-4 rounded-2xl px-4 py-3 text-center text-lg font-black uppercase tracking-[0.12em] text-white shadow-md md:text-xl',
    fulfillmentType === 'delivery' && 'bg-sky-600',
    fulfillmentType === 'dine_in' && 'bg-violet-600',
    fulfillmentType === 'takeaway' && 'bg-emerald-600',
    fulfillmentType !== 'delivery' &&
      fulfillmentType !== 'dine_in' &&
      fulfillmentType !== 'takeaway' &&
      'bg-zinc-600',
  );

  const fmtTime = (v: string | Date | undefined) => {
    if (v == null || v === '') return '';
    const d = typeof v === 'string' ? new Date(v) : v;
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const canStartPrep =
    (queueOrder.status === 'paid' || queueOrder.status === 'placed') &&
    (queueOrder.allowedNextStatuses?.includes('in_kitchen') ?? false);

  const items = queueOrder.items ?? [];

  const pill =
    'inline-flex min-h-[2rem] items-center rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide md:min-h-[2.25rem] md:px-4 md:text-base';

  const ticketAccent = cn(
    'overflow-hidden',
    queueOrder.slaBucket === 'overdue' &&
      'border-l-[8px] border-l-red-500 ring-2 ring-red-500/25 ring-offset-2 ring-offset-card',
    queueOrder.slaBucket === 'due_soon' &&
      queueOrder.slaBucket !== 'overdue' &&
      'border-l-[8px] border-l-amber-400',
    queueOrder.kitchenPriority === 'rush' &&
      queueOrder.slaBucket !== 'overdue' &&
      queueOrder.slaBucket !== 'due_soon' &&
      'border-l-[8px] border-l-rose-500',
    queueOrder.slaBucket !== 'overdue' &&
      queueOrder.slaBucket !== 'due_soon' &&
      queueOrder.kitchenPriority !== 'rush' &&
      'border-l-[8px] border-l-[var(--color-domain-accent)]',
  );

  const actionBtn =
    'min-h-[3.25rem] w-full touch-manipulation text-lg font-bold shadow-md active:scale-[0.99] md:min-h-14 md:text-xl';

  return (
    <OrderTicket
      variant="touch"
      className={ticketAccent}
      order={{ orderId: queueOrder.id, status: queueOrder.status }}
    >
      <p className={laneStripClass}>{laneTitle}</p>

      <div className="mb-4 flex flex-wrap gap-2 md:mb-5 md:gap-2.5">
        {queueOrder.kitchenPriority === 'rush' ? (
          <span className={`${pill} bg-rose-500 text-white shadow-sm`}>Rush</span>
        ) : null}
        {queueOrder.estimatedReadyTime ? (
          <span className={`${pill} bg-sky-600 text-white shadow-sm`}>
            Target {fmtTime(queueOrder.estimatedReadyTime)}
          </span>
        ) : null}
        {queueOrder.kitchenReleaseAt && queueOrder.releaseReason === 'SCHEDULED_PENDING' ? (
          <span className={`${pill} bg-orange-500 text-white shadow-sm`}>
            Release {fmtTime(queueOrder.kitchenReleaseAt)}
          </span>
        ) : null}
        {queueOrder.slaBucket === 'overdue' ? (
          <span className={`${pill} bg-red-600 text-white shadow-sm`}>Overdue</span>
        ) : queueOrder.slaBucket === 'due_soon' ? (
          <span className={`${pill} bg-amber-400 text-amber-950 shadow-sm`}>Due soon</span>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-stretch gap-3 md:mb-5">
        <div className="min-w-[8rem] flex-1 rounded-2xl border-2 border-zinc-800 bg-zinc-900 px-4 py-3 text-white shadow-inner">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Waiting</p>
          <p className="font-display text-3xl font-black tabular-nums leading-none md:text-4xl">{elapsedLabel}</p>
        </div>
      </div>

      <div className="mb-5 space-y-1.5 text-zinc-600 md:mb-6">
        <p className="text-2xl font-black leading-tight tracking-tight text-zinc-900 md:text-3xl">
          {customerName}
        </p>
        {tableNumber ? (
          <p
            className={cn(
              'font-semibold text-zinc-800',
              isDineIn ? 'text-3xl font-black md:text-4xl' : 'text-lg md:text-xl',
            )}
          >
            Table {tableNumber}
          </p>
        ) : null}
        <p className="text-base font-medium tabular-nums md:text-lg">
          Placed {placedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>

      <ul className="mb-6 list-none space-y-5 border-t-2 border-zinc-200 pt-5 md:mb-8 md:space-y-6 md:pt-6">
        {items.map((item) => {
          const rawModifiers = item.modifiersJson;
          const modifierLines = getOrderItemModifierDisplayLines(rawModifiers);
          return (
            <li key={item.id}>
              <div className="text-lg font-bold leading-snug text-zinc-900 md:text-xl">
                <span className="tabular-nums text-orange-600">{item.quantity}×</span>{' '}
                {item.name}
              </div>

              <div className="mt-3 space-y-1 border-l-4 border-orange-200 bg-orange-50/50 py-2 pl-4 pr-2 text-base leading-relaxed text-zinc-700 md:text-lg">
                {modifierLines.length > 0 ? (
                  modifierLines.map((line) => (
                    <p
                      key={`${item.id}-${line.label}`}
                      className={
                        isModifierLinePriority(line.label) ? 'font-bold text-amber-900' : undefined
                      }
                    >
                      <span className="text-zinc-500">{line.label}:</span> {line.value}
                    </p>
                  ))
                ) : (
                  <p className="text-zinc-500">Standard build</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 rounded-2xl border-2 border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-4 shadow-inner md:p-5">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 md:text-sm">
          Kitchen action
        </p>
        {canStartPrep ? (
          <Button
            type="button"
            size="lg"
            className={actionBtn}
            onClick={() => onStatusChange?.(queueOrder.id, 'in_kitchen')}
          >
            Start prep
          </Button>
        ) : null}
        {queueOrder.status === 'in_kitchen' ? (
          <Button
            type="button"
            size="lg"
            className={`${actionBtn} bg-emerald-600 text-white hover:bg-emerald-700 hover:opacity-100`}
            onClick={() => onStatusChange?.(queueOrder.id, 'ready')}
          >
            Mark as ready
          </Button>
        ) : null}
      </div>
    </OrderTicket>
  );
};
