import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  titleAs?: 'h1' | 'h2';
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  titleAs = 'h2',
  className,
}: PageHeaderProps) {
  const Title = titleAs;
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Title className="text-3xl font-bold tracking-tight text-foreground">
          {title}
        </Title>
        {description ? (
          <p className="text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
