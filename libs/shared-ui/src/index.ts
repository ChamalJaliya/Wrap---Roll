// libs/shared-ui/src/index.ts
// ⛔ LSA-ONLY — Public API for @wrap-roll/shared-ui

/** Import once in each app root layout (tokens + domains + Tailwind + shell). */
export const APP_CSS_PATH = '@wrap-roll/shared-ui/src/app.css';

/** @deprecated Use APP_CSS_PATH — tokens are included in app.css */
export const TOKENS_CSS_PATH = '@wrap-roll/shared-ui/src/tokens.css';

// Domain identifiers
export const DOMAINS = ['client', 'admin', 'cashier', 'kitchen', 'delivery'] as const;
export type Domain = typeof DOMAINS[number];

// Domain accent CSS class names (apply to root layout wrapper)
export const DOMAIN_ACCENT_CLASS: Record<Domain, string> = {
  client:   'domain-client',
  admin:    'domain-admin',
  cashier:  'domain-cashier',
  kitchen:  'domain-kitchen',
  delivery: 'domain-delivery',
};

// —— Primitives (shadcn / Radix)
export * from './components/ui/badge';
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/dialog';
export * from './components/ui/dropdown-menu';
export * from './components/ui/input';
export * from './components/ui/label';
export * from './components/ui/popover';
export * from './components/ui/separator';
export * from './components/ui/sheet';
export * from './components/ui/sonner';
export * from './components/ui/table';
export * from './components/ui/textarea';
export * from './components/ui/skeleton';

// —— Composites & layouts
export * from './components/Navbar';
export * from './components/Footer';
export * from './components/ThemeToggle';
export * from './components/AppShell';
export * from './components/SidebarClock';
export * from './components/PageStack';
export * from './components/PageHeader';
export * from './components/MetricCard';
export * from './components/EmptyState';
export * from './components/PlaceholderPanel';
export * from './components/OpsLayout';
export * from './components/OpsHeader';
export * from './components/StatusPill';
export * from './components/OrderStatusBadge';
export * from './components/OrderTicket';
export * from './components/OrderQueueBoard';
export * from './components/QueueOrderCard';
export * from './components/SectionHeading';
export * from './components/SearchInput';
export * from './components/IconTextRow';
export * from './components/HighlightStat';
export * from './components/ProductPickTile';
export * from './components/NativeSelect';
export * from './components/IconButton';
export * from './components/AvailabilityBadge';
export * from './components/DataPanel';
export * from './components/AuthLayout';
export * from './components/AvatarCell';
export * from './components/SharedDataGrid';
export * from './components/OpsCalendar';
export * from './components/ClientDirectory';
export * from './components/OrderDetailsModal';
export * from './components/SegmentedControl';
export * from './components/PageHeroHeader';
export * from './components/InlineFormPanel';
export * from './components/FormToggleRow';
export * from './lib/client-directory';
export * from './lib/utils';

/** @deprecated Alias of app.css — use APP_CSS_PATH */
export const GLOBALS_CSS_PATH = '@wrap-roll/shared-ui/src/globals.css';
