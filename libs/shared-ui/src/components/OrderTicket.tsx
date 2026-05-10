import type { ReactNode } from 'react';
import type { WrapOrder } from '@wrap-roll/contracts';
import { cn } from '../lib/utils';
import { OrderStatusBadge } from './OrderStatusBadge';

type OrderTicketProps = {
  /** Header uses `orderId` + `status` only; full `WrapOrder` is accepted for compatibility. */
  order: Pick<WrapOrder, 'orderId' | 'status'>;
  children?: ReactNode;
  /** `touch` = wall-mounted / finger-friendly KDS (larger type, no hover lift). */
  variant?: 'default' | 'touch';
  className?: string;
};

const shellVariants: Record<'default' | 'touch', string> = {
  default:
    'rounded-xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md',
  touch:
    'rounded-3xl border-2 border-zinc-200/90 bg-card p-6 shadow-xl shadow-zinc-900/[0.08] md:p-8 touch-manipulation',
};

const titleVariants: Record<'default' | 'touch', string> = {
  default: 'text-lg font-bold',
  touch: 'text-2xl font-black tracking-tight md:text-3xl',
};

export function OrderTicket({ order, children, variant = 'default', className }: OrderTicketProps) {
  const badgeClass =
    variant === 'touch'
      ? 'rounded-full border-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wide md:px-4 md:py-1.5 md:text-sm'
      : undefined;

  return (
    <article
      className={cn(shellVariants[variant], className)}
      aria-label={`Order ${order.orderId}`}
    >
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          variant === 'default' ? 'mb-4' : 'mb-5 gap-x-4 gap-y-2',
        )}
      >
        <h3 className={cn(titleVariants[variant], 'text-foreground')}>
          #{order.orderId.slice(0, 8)}
        </h3>
        <OrderStatusBadge status={order.status} className={badgeClass} />
      </header>
      {children}
    </article>
  );
}
