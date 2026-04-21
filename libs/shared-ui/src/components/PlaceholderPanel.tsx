import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type PlaceholderPanelProps = {
  children?: ReactNode;
  className?: string;
  minHeight?: number | string;
};

/** Muted panel for charts / widgets not yet implemented */
export function PlaceholderPanel({
  children = 'Coming soon',
  className,
  minHeight = 300,
}: PlaceholderPanelProps) {
  return (
    <div
      className={cn(
        'stat-card flex items-center justify-center',
        className,
      )}
      style={{
        minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
      }}
    >
      <p className="font-medium italic text-muted-foreground">{children}</p>
    </div>
  );
}
