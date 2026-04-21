import { cn } from '@wrap-roll/shared-ui';

export const adminPageShellClass = 'min-h-screen bg-neutral-50 px-6 pb-16 pt-24';
export const adminPageContainerClass = 'mx-auto w-full max-w-5xl';
export const adminPageTitleClass = 'font-display text-4xl font-black tracking-tight text-neutral-900';
export const adminPageTitleSpacingClass = 'mb-8';

export const adminSegmentedControlGroupClass = 'grid grid-cols-2 gap-2 rounded-xl border p-1';
export const adminSegmentedControlButtonBaseClass = 'rounded-lg px-3 py-2 text-xs font-bold';

export const getAdminSegmentedControlButtonClass = (isActive: boolean, isDisabled = false) =>
  cn(
    adminSegmentedControlButtonBaseClass,
    isActive ? 'bg-primary text-white' : 'text-slate-600',
    isDisabled && 'cursor-not-allowed opacity-50',
  );
