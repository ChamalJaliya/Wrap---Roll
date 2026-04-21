import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Shown above title when you prefer emoji or custom markup */
  decoration?: ReactNode;
  action?: ReactNode;
  /** `dashed` = prominent bordered panel (e.g. KDS empty queue) */
  variant?: 'simple' | 'dashed';
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  decoration,
  action,
  variant = 'simple',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-500',
        variant === 'dashed' &&
          'rounded-[var(--radius-3xl)] border-2 border-dashed border-neutral-100 bg-white shadow-sm py-20 px-8',
        className,
      )}
    >
      <div className="mb-8 empty-state-decoration">
        {decoration || (Icon && (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/5 text-primary shadow-[0_20px_40px_rgba(0,0,0,0.05)]">
            <Icon className="h-10 w-10 opacity-80" aria-hidden />
          </div>
        ))}
      </div>
      <h3 className="font-display text-2xl font-black tracking-tight text-neutral-900">{title}</h3>
      {description ? (
        <p className="mt-4 max-w-[280px] text-sm font-medium leading-relaxed text-neutral-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-10">{action}</div> : null}
    </div>
  );
}
