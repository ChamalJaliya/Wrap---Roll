'use client';

import React from 'react';
import type { KitchenQueueOrder, OrderStatus, QueueOrder } from '@wrap-roll/contracts';
import { Button, OrderTicket } from '@wrap-roll/shared-ui';
import { getOrderItemModifierDisplayLines, isModifierLinePriority } from '@wrap-roll/order-kit';

type KdsQueueOrder = KitchenQueueOrder | QueueOrder;

interface OrderCardProps {
  queueOrder: KdsQueueOrder;
  onStatusChange?: (id: string, status: OrderStatus) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ queueOrder, onStatusChange }) => {
  const customerName =
    queueOrder.customer?.name?.trim() ||
    ('customerName' in queueOrder && queueOrder.customerName
      ? String(queueOrder.customerName).trim()
      : '') ||
    'Guest';
  const tableNumber = queueOrder.tableNumber ?? undefined;
  const isDelivery = queueOrder.fulfillmentType === 'delivery';
  const placedAtRaw = queueOrder.placedAt;
  const placedAt =
    placedAtRaw != null && placedAtRaw !== ''
      ? typeof placedAtRaw === 'string'
        ? new Date(placedAtRaw)
        : placedAtRaw
      : new Date();

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

  return (
    <OrderTicket order={{ orderId: queueOrder.id, status: queueOrder.status }}>
      <div className="mb-3 flex flex-wrap gap-2">
        {queueOrder.kitchenPriority === 'rush' ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-rose-800">
            Rush
          </span>
        ) : null}
        {queueOrder.estimatedReadyTime ? (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-900">
            Target {fmtTime(queueOrder.estimatedReadyTime)}
          </span>
        ) : null}
        {queueOrder.kitchenReleaseAt && queueOrder.releaseReason === 'SCHEDULED_PENDING' ? (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[0.65rem] font-semibold text-orange-900">
            Release {fmtTime(queueOrder.kitchenReleaseAt)}
          </span>
        ) : null}
        {queueOrder.slaBucket === 'overdue' ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-red-900">
            Overdue
          </span>
        ) : queueOrder.slaBucket === 'due_soon' ? (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[0.65rem] font-semibold text-yellow-900">
            Due soon
          </span>
        ) : null}
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">{customerName}</strong>
        </p>
        {tableNumber ? <p>Table: {tableNumber}</p> : null}
        {isDelivery ? <p className="text-xs font-semibold text-blue-600">DELIVERY</p> : null}
        <p>Placed: {placedAt.toLocaleTimeString()}</p>
      </div>

      <ul className="mb-5 list-none border-t border-border pt-3">
        {items.map((item) => {
          const rawModifiers = item.modifiersJson;
          const modifierLines = getOrderItemModifierDisplayLines(rawModifiers);
          return (
            <li key={item.id} className="mb-3">
              <div className="flex justify-between text-[0.9375rem]">
                <span>
                  {item.quantity}x {item.name}
                </span>
              </div>

              <div className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
                {modifierLines.length > 0 ? (
                  modifierLines.map((line) => (
                    <p
                      key={`${item.id}-${line.label}`}
                      className={
                        isModifierLinePriority(line.label)
                          ? 'font-semibold text-amber-700'
                          : undefined
                      }
                    >
                      {line.label}: {line.value}
                    </p>
                  ))
                ) : (
                  <p>Options: -</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 rounded-xl border border-border/70 bg-background/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Kitchen action
        </p>
        {canStartPrep ? (
          <Button
            type="button"
            className="w-full"
            onClick={() => onStatusChange?.(queueOrder.id, 'in_kitchen')}
          >
            Start prep
          </Button>
        ) : null}
        {queueOrder.status === 'in_kitchen' ? (
          <Button
            type="button"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 hover:opacity-100"
            onClick={() => onStatusChange?.(queueOrder.id, 'ready')}
          >
            Mark as ready
          </Button>
        ) : null}
      </div>
    </OrderTicket>
  );
};
