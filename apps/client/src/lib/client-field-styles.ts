import { cn } from '@/lib/utils';

/**
 * Storefront form controls — same look on contact, profile, checkout, and auth-style flows.
 * Composes with shadcn Input/Textarea from @wrap-roll/shared-ui.
 */
export const surfaceInputClass = cn(
  'h-12 rounded-[var(--radius-lg)] border border-neutral-200/90 bg-white/95 text-neutral-900 shadow-sm',
  'placeholder:text-neutral-400',
  'focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25',
);

export const surfaceTextareaClass = cn(
  'min-h-[120px] resize-y rounded-[var(--radius-lg)] border border-neutral-200/90 bg-white/95 text-neutral-900 shadow-sm',
  'placeholder:text-neutral-400 [field-sizing:fixed]',
  'focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25',
);
