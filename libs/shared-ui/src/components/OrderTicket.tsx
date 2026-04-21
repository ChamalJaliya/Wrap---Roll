import type { ReactNode } from 'react';
import type { WrapOrder } from '@wrap-roll/contracts';
import { OrderStatusBadge } from './OrderStatusBadge';

type OrderTicketProps = {
  /** Header uses `orderId` + `status` only; full `WrapOrder` is accepted for compatibility. */
  order: Pick<WrapOrder, 'orderId' | 'status'>;
  children?: ReactNode;
};

export function OrderTicket({ order, children }: OrderTicketProps) {
  return (
    <article
      className="rounded-xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`Order ${order.orderId}`}
    >
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">#{order.orderId.slice(0, 8)}</h3>
        <OrderStatusBadge status={order.status} />
      </header>
      {children}
    </article>
  );
}
