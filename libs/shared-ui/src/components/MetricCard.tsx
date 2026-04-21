import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type MetricCardTrend = 'up' | 'down';

export type MetricCardProps = {
  label: string;
  value: ReactNode;
  /** Secondary line under the main metric */
  sub?: ReactNode;
  /** When set with `sub`, shows a trend arrow and tints the footer (analytics-style). */
  subTrend?: MetricCardTrend;
  icon?: LucideIcon;
  /**
   * Accent color (typically hex) for the left border and icon tile.
   * Omit to use the theme primary for the border; icon tile uses primary/15.
   */
  accent?: string;
  loading?: boolean;
  /** `sm` = denser padding and typography for inline summaries (e.g. orders console). */
  size?: 'md' | 'sm';
  className?: string;
};

/**
 * Primary KPI / summary tile for admin dashboards: uppercase label, bold metric,
 * optional footer with trend, icon in the top-right well, left accent stripe.
 */
export function MetricCard({
  label,
  value,
  sub,
  subTrend,
  icon: Icon,
  accent,
  loading,
  size = 'md',
  className,
}: MetricCardProps) {
  const sm = size === 'sm';
  const showFooter = Boolean(sub) || Boolean(subTrend);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border border-l-[3px] bg-card shadow-sm transition-shadow',
        !accent && 'border-l-primary',
        sm ? 'p-3' : 'p-5',
        !sm && 'hover:shadow-md',
        className,
      )}
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-semibold uppercase tracking-widest text-muted-foreground',
              sm ? 'text-[10px] leading-tight' : 'text-xs',
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              'font-black text-foreground',
              sm ? 'mt-1 text-xl tabular-nums' : 'mt-1.5 text-2xl tabular-nums',
            )}
          >
            {loading ? <span className="animate-pulse text-muted-foreground">—</span> : value}
          </p>
          {showFooter && (
            <p
              className={cn(
                'mt-1 flex flex-wrap items-center gap-1',
                sm ? 'text-[11px]' : 'text-xs',
                !subTrend && 'text-muted-foreground',
                subTrend === 'up' && 'font-medium text-emerald-600 dark:text-emerald-400',
                subTrend === 'down' && 'font-medium text-red-600 dark:text-red-400',
              )}
            >
              {subTrend === 'up' ? (
                <ArrowUpRight className={cn('shrink-0', sm ? 'h-3 w-3' : 'h-3 w-3')} />
              ) : null}
              {subTrend === 'down' ? (
                <ArrowDownRight className={cn('shrink-0', sm ? 'h-3 w-3' : 'h-3 w-3')} />
              ) : null}
              {sub}
            </p>
          )}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl',
              sm ? 'h-8 w-8' : 'h-10 w-10',
              !accent && 'bg-primary/15 text-primary',
            )}
            style={accent ? { backgroundColor: `${accent}18`, color: accent } : undefined}
          >
            <Icon className={sm ? 'h-4 w-4' : 'h-5 w-5'} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
