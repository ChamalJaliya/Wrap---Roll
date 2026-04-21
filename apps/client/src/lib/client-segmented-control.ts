import { cn } from '@/lib/utils';

export const clientSegmentedControlGroupClass = 'grid grid-cols-2 gap-2 rounded-xl border p-1';
export const clientSegmentedControlButtonBaseClass = 'rounded-lg px-3 py-2 text-xs font-black';

export const getClientSegmentedControlButtonClass = (isActive: boolean, isDisabled = false) =>
  cn(
    clientSegmentedControlButtonBaseClass,
    isActive ? 'bg-primary text-white' : 'text-slate-600',
    isDisabled && 'cursor-not-allowed opacity-50',
  );
