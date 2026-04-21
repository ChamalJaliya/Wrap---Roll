import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type HighlightStatProps = {
  value: ReactNode;
  label: string;
  className?: string;
};

/** Large marketing / about-page stat block */
export function HighlightStat({ value, label, className }: HighlightStatProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-8 text-center shadow-sm',
        className,
      )}
    >
      <span className="block text-4xl font-black text-primary">{value}</span>
      <span className="mt-2 block text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
