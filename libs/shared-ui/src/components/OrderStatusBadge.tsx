import type { OrderStatus } from '@wrap-roll/contracts';
import { cn } from '../lib/utils';

const STATUS_STYLES: Record<OrderStatus, string> = {
  placed: 'border-slate-300 bg-slate-100 text-slate-800',
  paid: 'border-blue-200 bg-blue-100 text-blue-800',
  in_kitchen: 'border-amber-200 bg-amber-100 text-amber-900',
  ready: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  in_transit: 'border-violet-200 bg-violet-100 text-violet-800',
  delivered: 'border-emerald-300 bg-emerald-200 text-emerald-900',
  cancelled: 'border-rose-200 bg-rose-100 text-rose-800',
  voided: 'border-rose-200 bg-rose-100 text-rose-800',
  refunded: 'border-zinc-300 bg-zinc-100 text-zinc-800',
};

type OrderStatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase',
        STATUS_STYLES[status],
        className,
      )}
      aria-label={`Order status ${status.replace('_', ' ')}`}
    >
      {status}
    </span>
  );
}
