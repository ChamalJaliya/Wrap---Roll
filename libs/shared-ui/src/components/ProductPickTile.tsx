import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/utils';

export type ProductPickTileProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  category: string;
  name: string;
  priceLabel: string;
  onInfoClick?: () => void;
  infoLabel?: string;
  infoIcon?: ReactNode;
};

/** POS / cashier product cell */
export function ProductPickTile({
  category,
  name,
  priceLabel,
  onInfoClick,
  infoLabel = 'Item info',
  infoIcon,
  className,
  type = 'button',
  ...props
}: ProductPickTileProps) {
  return (
    <button
      type={type}
      className={cn(
        'group flex h-[188px] w-full flex-col items-start justify-between gap-3 rounded-2xl border-2 border-transparent bg-card p-5 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98]',
        className,
      )}
      {...props}
    >
      <div className="flex min-h-[76px] flex-col items-start gap-1">
        <span className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">
          {category}
        </span>
        <span className="line-clamp-2 min-h-[56px] text-lg font-bold leading-tight text-foreground">
          {name}
        </span>
      </div>
      <div className="flex w-full items-end justify-between gap-3">
        <span className="text-xl font-black italic text-foreground underline decoration-primary/40 underline-offset-4">
          {priceLabel}
        </span>
        {onInfoClick ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={infoLabel}
            className="rounded-full border border-neutral-300 bg-white p-1.5 text-muted-foreground shadow-sm transition hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onInfoClick();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onInfoClick();
            }}
          >
            {infoIcon ?? <span className="block text-[10px] font-bold">i</span>}
          </span>
        ) : null}
      </div>
    </button>
  );
}
