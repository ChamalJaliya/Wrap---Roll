import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type PageStackProps = {
  children: ReactNode;
  className?: string;
};

/** Vertical rhythm wrapper for dashboard / ops content (`space-y-8`). */
export function PageStack({ children, className }: PageStackProps) {
  return <div className={cn('space-y-8', className)}>{children}</div>;
}
