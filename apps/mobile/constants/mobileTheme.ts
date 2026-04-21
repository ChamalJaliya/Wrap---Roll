export const mobileTheme = {
  colors: {
    // Core
    bg: '#f3f4f6',
    card: '#ffffff',
    text: '#111827',
    subtext: '#6b7280',
    muted: '#9ca3af',
    border: '#e5e7eb',
    borderSoft: '#f3f4f6',
    borderStrong: '#d1d5db',

    // Brand
    primary: '#ea580c',
    primaryText: '#ffffff',
    primaryDeep: '#c2410c',
    heroBg: '#111827',
    heroText: '#ffffff',
    heroSubtext: '#d1d5db',
    accent: '#f59e0b',

    // State
    success: '#16a34a',
    successSoft: '#dcfce7',
    danger: '#b91c1c',
    dangerSoft: '#fff5f5',
    warningText: '#9a3412',
    warningBg: '#fff7ed',
    warningBorder: '#fed7aa',

    // Surface variants
    surfaceMuted: '#f9fafb',
    surfaceHighlight: '#fffaf5',
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 18,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  layout: {
    screenX: 10,
    contentBottom: 28,
    headerTop: 6,
    headerBottom: 10,
    sectionGap: 12,
  },
} as const;

export type MobileTheme = typeof mobileTheme;
