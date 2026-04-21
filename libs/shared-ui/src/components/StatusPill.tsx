import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const pillVariants = cva(
  'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
  {
    variants: {
      variant: {
        online: 'border-green-200 bg-green-50 text-green-700',
        offline: 'border-red-200 bg-red-50 text-red-700 ring-2 ring-red-100',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        info: 'border-border bg-muted text-foreground',
        neutral: 'border-border bg-background text-muted-foreground',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface StatusPillProps
  extends VariantProps<typeof pillVariants> {
  children: ReactNode;
  className?: string;
}

export function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span className={cn(pillVariants({ variant }), className)}>{children}</span>
  );
}
