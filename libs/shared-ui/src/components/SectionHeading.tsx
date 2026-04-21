import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type SectionHeadingProps = {
  children: ReactNode;
  icon?: LucideIcon;
  as?: 'h2' | 'h3';
  className?: string;
};

export function SectionHeading({
  children,
  icon: Icon,
  as: Tag = 'h2',
  className,
}: SectionHeadingProps) {
  return (
    <Tag
      className={cn(
        'flex items-center gap-2 text-lg font-bold text-foreground',
        className,
      )}
    >
      {Icon ? <Icon className="h-5 w-5 shrink-0 text-muted-foreground" /> : null}
      {children}
    </Tag>
  );
}
