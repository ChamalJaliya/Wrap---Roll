import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

type SegmentedControlProps = {
  children: ReactNode;
  className?: string;
};

type SegmentedControlItemProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function SegmentedControl({ children, className }: SegmentedControlProps) {
  return <div className={cn('grid grid-cols-2 gap-2 rounded-xl border p-1', className)}>{children}</div>;
}

export function SegmentedControlItem({
  active,
  onClick,
  children,
  disabled,
  className,
}: SegmentedControlItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-xs font-black',
        active ? 'bg-primary text-white' : 'text-slate-600',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}
