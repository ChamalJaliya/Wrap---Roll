import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type OpsHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** Accent strip under header (e.g. kitchen domain color) */
  accentBorder?: boolean;
  className?: string;
};

export function OpsHeader({
  title,
  subtitle,
  children,
  accentBorder = false,
  className,
}: OpsHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
        accentBorder
          ? 'border-b-4 border-b-[var(--color-domain-accent)] border-l-0 border-r-0 border-t-0'
          : 'border-b',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
