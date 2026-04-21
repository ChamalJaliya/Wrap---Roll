'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@wrap-roll/shared-ui';
import { useClientStore, type CartItem } from '../store/useClientStore';

type CartLineBreakdownProps = {
  item: CartItem;
  className?: string;
  /** Tighter copy + simpler chrome for the cart drawer */
  compact?: boolean;
  /** Quantity stepper + remove (e.g. checkout order summary) */
  lineControls?: boolean;
};

export function CartLineBreakdown({ item, className, compact, lineControls }: CartLineBreakdownProps) {
  const t = useTranslations('Cart');
  const updateQuantity = useClientStore((s) => s.updateQuantity);
  const removeFromCart = useClientStore((s) => s.removeFromCart);
  const currency = t('currency');
  const unitTotal = item.totalItemPrice;
  const lineTotal = unitTotal * item.quantity;

  const optionRows = item.modifiers.flatMap((g) =>
    g.options.map((o) => ({
      key: `${g.groupId}-${o.optionId}`,
      label: o.label,
      adjust: o.priceAdjust,
    })),
  );

  const fmt = (n: number) => n.toLocaleString();
  const hasOptions = optionRows.length > 0;
  const showBreakdown = hasOptions || item.quantity > 1;

  const rowLine = (k: string, label: React.ReactNode, value: React.ReactNode, isCompact: boolean) => (
    <div
      key={k}
      className={cn('flex justify-between gap-3', !isCompact && 'px-3.5 py-2.5')}
    >
      <span className="text-neutral-600">{label}</span>
      <span className="shrink-0 tabular-nums text-neutral-800">{value}</span>
    </div>
  );

  return (
    <div
      className={cn(
        'w-full min-w-0',
        !compact &&
          showBreakdown &&
          'rounded-2xl border border-neutral-200/80 bg-gradient-to-b from-neutral-50/90 to-white p-4 shadow-sm',
        !compact && !showBreakdown && 'rounded-xl border border-neutral-100/90 bg-white px-4 py-3.5 shadow-sm',
        compact && 'rounded-none border-0 bg-transparent p-0 shadow-none',
        className,
      )}
    >
      {/* One headline total — no duplicate “per item” row */}
      <div
        className={cn(
          'flex items-start justify-between gap-3',
          compact ? 'text-sm' : 'items-baseline',
        )}
      >
        <p
          className={cn(
            'min-w-0 flex-1 leading-snug',
            compact
              ? 'font-medium text-neutral-800'
              : 'font-display text-[1.0625rem] font-bold tracking-tight text-neutral-900',
          )}
        >
          {item.quantity}× {item.name}
        </p>
        <span
          className={cn(
            'shrink-0 tabular-nums text-primary',
            compact ? 'font-display text-lg font-black' : 'font-display text-xl font-black',
          )}
        >
          {currency} {fmt(lineTotal)}
        </span>
      </div>

      {showBreakdown ? (
        <div className={cn(!compact ? 'mt-3' : 'mt-2')}>
          {!compact ? (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {t('pricingDetailsCaption')}
            </p>
          ) : null}

          <div
            className={cn(
              compact
                ? 'space-y-1 border-l-2 border-neutral-200 pl-3 text-[11px] leading-relaxed text-neutral-600'
                : 'overflow-hidden rounded-xl bg-white/80 ring-1 ring-neutral-100/90',
            )}
          >
            <div className={cn(!compact && 'divide-y divide-neutral-100/90')}>
              {rowLine(
                'base',
                t('pricingBase'),
                `${currency} ${fmt(item.basePrice)}`,
                Boolean(compact),
              )}
              {optionRows.map((row) =>
                rowLine(
                  row.key,
                  <span className="min-w-0 truncate" title={row.label}>
                    {row.label}
                  </span>,
                  row.adjust > 0
                    ? t('pricingOptionPlus', { currency, amount: fmt(row.adjust) })
                    : row.adjust < 0
                      ? t('pricingOptionMinus', { currency, amount: fmt(Math.abs(row.adjust)) })
                      : t('pricingIncluded'),
                  Boolean(compact),
                ),
              )}
            </div>
            {item.quantity > 1 ? (
              <div
                className={cn(
                  'border-t border-neutral-100/90 text-neutral-700',
                  compact ? 'pt-1' : 'bg-neutral-50/60 px-3.5 py-2.5',
                )}
              >
                <p className="text-[11px] leading-relaxed tabular-nums sm:text-xs">
                  {t('pricingQtyMath', {
                    currency,
                    unit: fmt(unitTotal),
                    qty: item.quantity,
                    line: fmt(lineTotal),
                  })}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {lineControls ? (
        <div
          className={cn(
            'mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100/90 pt-3',
            compact && 'mt-2 pt-2',
          )}
        >
          <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-1">
            <button
              type="button"
              className={cn(
                'flex items-center justify-center rounded-full bg-white text-sm font-black shadow-sm transition-all hover:scale-110 hover:bg-primary hover:text-white',
                compact ? 'h-8 w-8' : 'h-9 w-9',
              )}
              aria-label={t('decreaseQty')}
              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
            >
              −
            </button>
            <span
              className={cn(
                'min-w-8 text-center font-display font-black tabular-nums text-neutral-900',
                compact ? 'text-sm' : 'text-base',
              )}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              className={cn(
                'flex items-center justify-center rounded-full bg-white text-sm font-black shadow-sm transition-all hover:scale-110 hover:bg-primary hover:text-white',
                compact ? 'h-8 w-8' : 'h-9 w-9',
              )}
              aria-label={t('increaseQty')}
              onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-wide text-red-600 transition-colors hover:text-red-700"
            onClick={() => removeFromCart(item.cartId)}
          >
            {t('removeLine')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
