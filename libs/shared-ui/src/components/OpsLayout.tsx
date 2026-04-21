import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type OpsLayoutProps = {
  children: ReactNode;
  className?: string;
};

/** Full-height ops shell (POS, KDS, dispatch) aligned to design tokens */
export function OpsLayout({ children, className }: OpsLayoutProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-background font-sans text-foreground antialiased',
        className,
      )}
    >
      {children}
    </div>
  );
}
