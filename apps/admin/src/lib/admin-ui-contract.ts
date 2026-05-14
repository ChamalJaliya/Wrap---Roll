import type { CSSProperties } from 'react';
import { cn } from '@wrap-roll/shared-ui';

/** Root wrapper inside `AppShell` main — padding/background come from shared-ui `.main-content`. */
export const adminPageRootClass = 'w-full';

/**
 * @deprecated Alias of {@link adminPageRootClass}. Older pages imported `adminPageShellClass`; keep imports working.
 */
export const adminPageShellClass = adminPageRootClass;

/** Match Orders Console: wide readable canvas without touching viewport edges (`main-content` still pads). */
export const adminPageContainerClass = 'mx-auto w-full max-w-[min(100%,88rem)]';

export const adminPageTitleClass =
  'font-display text-4xl font-black tracking-tight text-neutral-900';

/** Prefer {@link AdminPageHeader}; kept for rare cases that render a bare `<h1>`. */
export const adminPageTitleSpacingClass = 'mb-8';

/** Title row: heading + optional actions (matches pricing / settings headers). */
export const adminPageHeaderRowClass =
  'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between';

export const adminPageSubtitleClass = 'mt-2 max-w-2xl text-sm text-neutral-600';

/** Same vertical rhythm as shared-ui `PageStack` — use either this class or `<PageStack>`. */
export const adminPageBodyStackClass = 'space-y-8';

/** Tighter stacks (menu / inventory patterns). */
export const adminPageDenseStackClass = 'space-y-6';

export const adminInlineAlertErrorClass =
  'mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700';

/** Large bordered panels (menu editor sections, etc.). */
export const adminElevatedPanelClass =
  'space-y-4 rounded-2xl border bg-card p-6 shadow-sm sm:p-8';

export const adminSectionEyebrowClass =
  'text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500';

export const adminSegmentedControlGroupClass = 'grid grid-cols-2 gap-2 rounded-xl border p-1';
export const adminSegmentedControlButtonBaseClass = 'rounded-lg px-3 py-2 text-xs font-bold';

export const getAdminSegmentedControlButtonClass = (isActive: boolean, isDisabled = false) =>
  cn(
    adminSegmentedControlButtonBaseClass,
    isActive ? 'bg-primary text-white' : 'text-slate-600',
    isDisabled && 'cursor-not-allowed opacity-50',
  );

/* ─── Dynamic hex accents (charts, pipeline bars) — keep computed color in one place ─── */

export function adminHexTintStyle(hex: string, alphaSuffix = '20'): CSSProperties {
  return { backgroundColor: `${hex}${alphaSuffix}`, color: hex };
}

/** Solid fill only (status dots, chart markers). */
export function adminHexBackground(hex: string): CSSProperties {
  return { backgroundColor: hex };
}

export function adminHexSolidStyle(hex: string, foreground = '#fff'): CSSProperties {
  return { backgroundColor: hex, color: foreground };
}

export function adminHexBarGradientStyle(hex: string, heightPx: number): CSSProperties {
  const h = Math.max(4, heightPx);
  return {
    height: `${h}px`,
    background: `linear-gradient(to top, ${hex}cc, ${hex}55)`,
  };
}

export function adminRankBadgeStyle(rank: number): CSSProperties {
  return {
    background:
      rank === 1
        ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
        : rank === 2
          ? 'linear-gradient(135deg,#94a3b8,#64748b)'
          : rank === 3
            ? 'linear-gradient(135deg,#b45309,#92400e)'
            : '#e2e8f0',
    color: rank <= 3 ? '#fff' : '#64748b',
  };
}

export function adminAccentBorderStyle(accentColor: string, widthPx = 3): CSSProperties {
  return { borderLeftColor: accentColor, borderLeftWidth: widthPx };
}

/** Analytics → POS card reconciliation summary tiles (left accent bar). */
export const ADMIN_ANALYTICS_POS_CARD_EVENTS_ACCENT = '#6366f1';
export const ADMIN_ANALYTICS_POS_CARD_TOTAL_ACCENT = '#8b5cf6';
