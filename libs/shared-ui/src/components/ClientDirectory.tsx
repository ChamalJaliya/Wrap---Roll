'use client';

import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';

export type ClientDirectoryRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  supabaseUserId: string | null;
  orderCount: number;
  defaultAddress: string | null;
  latestOrderPlacedAt?: string | null;
};

type ClientDirectoryProps = {
  title?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  loading?: boolean;
  rows: ClientDirectoryRow[];
  recentRows?: ClientDirectoryRow[];
  catalogLetter: string;
  onCatalogLetterChange: (value: string) => void;
  catalogType?: 'all' | 'client' | 'guest';
  onCatalogTypeChange?: (value: 'all' | 'client' | 'guest') => void;
  emptyText?: string;
  messageText?: string | null;
  cardActions?: Array<{
    id: string;
    label: string;
    onAction: (row: ClientDirectoryRow) => void;
    variant?: 'default' | 'outline';
  }>;
  pinnedRows?: ClientDirectoryRow[];
  onTogglePin?: (row: ClientDirectoryRow) => void;
  isPinned?: (row: ClientDirectoryRow) => boolean;
  onClearPins?: () => void;
  onCardClick?: (row: ClientDirectoryRow) => void;
};

export function ClientDirectory({
  title = 'Client directory',
  query,
  onQueryChange,
  onSearch,
  loading = false,
  rows,
  recentRows = [],
  catalogLetter,
  onCatalogLetterChange,
  catalogType = 'all',
  onCatalogTypeChange,
  emptyText = 'No matching customers found.',
  messageText = null,
  cardActions = [],
  pinnedRows = [],
  onTogglePin,
  isPinned,
  onClearPins,
  onCardClick,
}: ClientDirectoryProps) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const rainbow = [
    'bg-red-100 text-red-700',
    'bg-orange-100 text-orange-700',
    'bg-amber-100 text-amber-700',
    'bg-lime-100 text-lime-700',
    'bg-emerald-100 text-emerald-700',
    'bg-teal-100 text-teal-700',
    'bg-cyan-100 text-cyan-700',
    'bg-sky-100 text-sky-700',
    'bg-blue-100 text-blue-700',
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-fuchsia-100 text-fuchsia-700',
  ];

  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-foreground">{title}</p>
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Name / email / phone"
          className="h-9"
        />
        <Button type="button" className="h-9" onClick={onSearch}>
          Find
        </Button>
      </div>

      {onCatalogTypeChange ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['all', 'client', 'guest'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                catalogType === t ? 'bg-primary text-white' : 'bg-white text-muted-foreground'
              }`}
              onClick={() => onCatalogTypeChange(t)}
            >
              {t === 'all' ? 'All' : t === 'client' ? 'Clients' : 'Guests'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1">
        <button
          type="button"
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            catalogLetter === 'ALL' ? 'bg-primary text-white' : 'bg-white text-muted-foreground'
          }`}
          onClick={() => onCatalogLetterChange('ALL')}
        >
          ALL
        </button>
        {alphabet.map((ch, i) => (
          <button
            key={ch}
            type="button"
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${catalogLetter === ch ? 'ring-2 ring-primary/60' : ''} ${
              rainbow[i % rainbow.length]
            }`}
            onClick={() => onCatalogLetterChange(ch)}
          >
            {ch}
          </button>
        ))}
      </div>
      {messageText ? <p className="mt-2 text-xs text-muted-foreground">{messageText}</p> : null}

      {onTogglePin ? (
        <div className="mt-3 flex items-center justify-between">
          <Badge variant="secondary">Pinned: {pinnedRows.length}</Badge>
          {onClearPins && pinnedRows.length > 0 ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2"
              onClick={onClearPins}
            >
              Clear all pins
            </button>
          ) : null}
        </div>
      ) : null}

      {pinnedRows.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Pinned
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedRows.map((r) => (
              <button
                key={`pinned-${r.id}`}
                type="button"
                className="rounded-lg border bg-amber-50 p-2 text-left transition hover:border-primary/50"
                onClick={() => onCardClick?.(r)}
              >
                <p className="text-sm font-semibold">{r.name || 'Guest'}</p>
                <p className="text-[11px] text-muted-foreground">Phone: {r.phone || 'No phone'}</p>
                <p className="text-[11px] text-muted-foreground">
                  Delivery: {r.defaultAddress || 'No default delivery address'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {recentRows.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Recently active
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentRows.map((r) => (
              <button
                key={`recent-${r.id}`}
                type="button"
                className="rounded-lg border bg-primary/[0.03] p-2 text-left transition hover:border-primary/50"
                onClick={() => onCardClick?.(r)}
              >
                <p className="text-sm font-semibold">{r.name || 'Guest'}</p>
                <p className="text-[11px] text-muted-foreground">Phone: {r.phone || 'No phone'}</p>
                <p className="text-[11px] text-muted-foreground">
                  Delivery: {r.defaultAddress || 'No default delivery address'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">Searching directory...</p>
        ) : null}
        {!loading &&
          rows.map((r) => (
            <div
              key={`directory-${r.id}`}
              className="rounded-lg border bg-white p-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.03]"
              role={onCardClick ? 'button' : undefined}
              tabIndex={onCardClick ? 0 : undefined}
              onClick={() => onCardClick?.(r)}
              onKeyDown={(e) => {
                if (!onCardClick) return;
                if (e.key === 'Enter' || e.key === ' ') onCardClick(r);
              }}
            >
              <p className="font-semibold">{r.name || 'Guest'}</p>
              <p className="text-xs text-muted-foreground">Phone: {r.phone || 'No phone'}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                Delivery: {r.defaultAddress || 'No default delivery address'}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant={r.supabaseUserId ? 'success' : 'secondary'}>
                  {r.supabaseUserId ? 'Client' : 'Guest'}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{r.orderCount} orders</span>
              </div>
              {onTogglePin ? (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(r);
                    }}
                  >
                    {isPinned?.(r) ? 'Unpin' : 'Pin'}
                  </Button>
                </div>
              ) : null}
              {cardActions.length > 0 ? (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {cardActions.map((action) => (
                    <Button
                      key={`${action.id}-${r.id}`}
                      type="button"
                      variant={action.variant ?? 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onAction(r);
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {cardActions.length > 0 ? (
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  Prefills POS only (does not place order)
                </p>
              ) : null}
            </div>
          ))}
        {!loading && rows.length === 0 ? (
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">{emptyText}</p>
        ) : null}
      </div>
    </div>
  );
}
