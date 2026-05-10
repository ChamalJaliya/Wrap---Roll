import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';

export type ProductPickTileProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  category: string;
  name: string;
  priceLabel: string;
  thumbnailUrl?: string;
  onInfoClick?: () => void;
  infoLabel?: string;
  infoIcon?: ReactNode;
};

/** POS / cashier product cell */
export function ProductPickTile({
  category,
  name,
  priceLabel,
  thumbnailUrl,
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
        'group relative flex min-h-[260px] w-full touch-manipulation flex-col items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-[0_12px_32px_-24px_rgba(15,23,42,0.65)] transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.55)] active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      <div className="flex w-full flex-col items-center">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className="h-[120px] w-[120px] rounded-full border-2 border-slate-100 object-cover shadow-sm"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-slate-100 bg-muted text-3xl font-black text-muted-foreground shadow-sm">
            {String(name ?? '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="mt-3 line-clamp-2 min-h-[52px] text-xl font-black leading-tight text-foreground">
          {name}
        </span>
        <span className="mt-1 text-xs font-bold uppercase tracking-wider text-primary/90">
          {category}
        </span>
      </div>
      <div className="flex w-full items-end justify-between gap-3">
        <span className="text-3xl font-black text-primary">
          {priceLabel}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {onInfoClick ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={infoLabel}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-neutral-300 bg-white p-2 text-muted-foreground shadow-sm transition hover:text-primary"
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
          <span
            className="pointer-events-none flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30"
            aria-hidden
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </button>
  );
}
