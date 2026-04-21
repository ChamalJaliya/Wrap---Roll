import { cn } from '@/lib/utils';

/** Radial wash used across marketing, account, checkout, and legal pages */
export const clientAmbientBackgroundClass =
  'bg-[radial-gradient(circle_at_top_right,rgba(232,93,4,0.055),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(27,67,50,0.055),transparent_55%)]';

/** Full viewport page wrapper */
export const clientPageShellClass = cn(
  'min-h-screen',
  clientAmbientBackgroundClass,
);

/** Home: menu section under hero — neutral base + same ambient as other pages */
export const clientHomeLowerClass = cn('bg-neutral-50', clientAmbientBackgroundClass);

/** Horizontal frame only (compose with your own vertical spacing) */
export const clientMaxNarrowClass = 'mx-auto w-full max-w-3xl px-4';

export const clientMaxWideClass = 'mx-auto w-full max-w-5xl px-4';

export const clientMaxMenuClass = 'mx-auto w-full max-w-6xl px-4 sm:px-8';

/** Full section: width + vertical rhythm */
export const clientContentNarrowClass = cn(
  clientMaxNarrowClass,
  'py-16 sm:py-20 md:py-24',
);

export const clientContentWideClass = cn(
  clientMaxWideClass,
  'py-16 sm:py-20 md:py-24',
);

/** Frosted panels (contact, profile cards, checkout blocks, success tracker) */
export const clientGlassPanelClass = cn(
  'rounded-[var(--radius-xl)] border border-white/35 bg-white/72 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] backdrop-blur-md',
  'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_56px_rgba(0,0,0,0.1)]',
);

/** Same glass without hover motion (forms, prose, tracking) */
export const clientGlassPanelFlatClass = cn(
  'rounded-[var(--radius-xl)] border border-white/35 bg-white/75 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.05)] backdrop-blur-md',
);

/** Hero / marketing H1 with gradient text */
export const clientDisplayHeadingGradientClass = cn(
  'bg-gradient-to-br from-neutral-900 to-primary bg-clip-text font-display text-[clamp(2.5rem,8vw,4rem)] font-black leading-tight text-transparent',
);

/** Large solid display title (menu, about) */
export const clientDisplayHeadingSolidXlClass =
  'font-display text-[clamp(2.5rem,9vw,4.75rem)] font-black leading-[0.95] tracking-tighter text-neutral-900';

/** Page title (profile, checkout header, legal) */
export const clientDisplayHeadingSolidLgClass =
  'font-display text-3xl font-black tracking-tight text-neutral-900 sm:text-4xl';

export const clientCheckoutTitleClass =
  'text-center font-display text-4xl font-black tracking-tight text-neutral-900 sm:text-5xl';

/** Section title inside a card */
export const clientSectionTitleClass =
  'font-display text-2xl font-extrabold text-neutral-900 sm:text-3xl';

/** Subtitle under display headings */
export const clientLeadClass = 'text-lg text-neutral-600 sm:text-xl';

/** Shared centered page header block for account/track style pages */
export const clientPageHeaderCenteredClass = 'mb-10 max-w-4xl text-center md:mx-auto';

/** Shared title spacing under display heading */
export const clientPageTitleSpacingClass = 'mb-3';

/** Large hero-style centered page header (about/contact and promoted pages) */
export const clientHeroHeaderCenteredClass = 'mb-16 max-w-4xl text-center md:mx-auto';

/** Shared spacing for XL hero titles */
export const clientHeroTitleSpacingClass = 'mb-6';

/** Shared hero lead rhythm */
export const clientHeroLeadClass = 'mx-auto max-w-2xl font-medium leading-snug';

/** Stacked field label */
export const clientFormLabelClass = 'block text-sm font-semibold text-neutral-700';

/** Primary full-width / hero CTAs */
export const clientPrimaryCtaClass = cn(
  'h-14 rounded-[var(--radius-xl)] px-8 text-base font-black uppercase tracking-wide shadow-lg shadow-primary/25',
);

/** Checkout / wizard numbered step chip */
export const clientStepBadgeClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-md shadow-primary/30';
