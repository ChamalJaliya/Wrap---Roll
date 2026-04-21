import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type InlineFormPanelProps = {
  children: ReactNode;
  className?: string;
};

export function InlineFormPanel({ children, className }: InlineFormPanelProps) {
  return (
    <div
      className={cn(
        'mb-6 grid gap-3 rounded-xl border border-orange-100 bg-white/70 p-4 md:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
