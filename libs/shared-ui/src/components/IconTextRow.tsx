import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type IconTextRowProps = {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
};

/** Contact / settings rows with icon, title, and body copy */
export function IconTextRow({
  icon: Icon,
  title,
  children,
  className,
}: IconTextRowProps) {
  return (
    <div className={cn('flex gap-4', className)}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-foreground">{title}</h3>
        <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
