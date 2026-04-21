'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { AlertTriangle, User } from 'lucide-react';
import api from '../../services/api';
import {
  OPS_ACTIVITY_ACTOR_ROLE_FILTERS,
  OPS_ACTIVITY_APP_FILTERS,
  OPS_ACTIVITY_ENTITY_TYPE_FILTERS,
  activityEventLooksLikeFailure,
  formatActivityActorRole,
  formatActivityApp,
  formatActivityEntityType,
  formatActivityEventTypeLabel,
  getActivityEventVisualHints,
  type OpsActivityEventRow,
  type OpsActivityFeedPage,
} from '@wrap-roll/contracts';
import { DataPanel, EmptyState, PageHeader, PageStack } from '@wrap-roll/shared-ui';

const appOptions = ['all', ...OPS_ACTIVITY_APP_FILTERS] as const;
const entityOptions = ['all', ...OPS_ACTIVITY_ENTITY_TYPE_FILTERS] as const;
const actorRoleOptions = ['all', ...OPS_ACTIVITY_ACTOR_ROLE_FILTERS] as const;

function fmtDate(value: unknown): string {
  if (!value) return '-';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function activityEventCardToneClass(event: OpsActivityEventRow): string {
  const { failure, systemSurface } = getActivityEventVisualHints(event);
  if (failure) {
    return 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20';
  }
  if (systemSurface) {
    return 'border-l-4 border-l-slate-400/80 bg-muted/20';
  }
  return 'border-l-4 border-l-primary/50 bg-card';
}

export default function AdminActivityPage() {
  const [events, setEvents] = useState<OpsActivityEventRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [app, setApp] = useState<(typeof appOptions)[number]>('all');
  const [entityType, setEntityType] = useState<(typeof entityOptions)[number]>('all');
  const [actorRole, setActorRole] = useState<(typeof actorRoleOptions)[number]>('all');
  const [eventType, setEventType] = useState('');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [limit, setLimit] = useState(120);

  const fetchPage = async (cursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<OpsActivityFeedPage>('/activity', {
        params: {
          take: limit,
          cursor: cursor || undefined,
          app: app === 'all' ? undefined : app,
          entityType: entityType === 'all' ? undefined : entityType,
          actorRole: actorRole === 'all' ? undefined : actorRole,
          eventType: eventType.trim() || undefined,
          q: query.trim() || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });
      const data = res.data;
      const items = Array.isArray(data?.items) ? data.items : [];
      if (append) setEvents((prev) => [...prev, ...items]);
      else setEvents(items);
      setNextCursor(data?.nextCursor ?? null);
    } catch (error: unknown) {
      if (!append) setEvents([]);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setLoadError(
          'Activity endpoint not found (404). Restart the API server so latest routes are loaded, then retry.',
        );
      } else {
        setLoadError('Failed to load activity feed. Please retry.');
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const load = async () => {
    await fetchPage(null, false);
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    await fetchPage(nextCursor, true);
  };

  const exportCsv = () => {
    const headers = ['createdAt', 'app', 'entityType', 'entityId', 'eventType', 'summary', 'actorRole', 'actorName'];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...events.map((e) =>
        [
          escape(String(e.createdAt)),
          escape(e.app),
          escape(e.entityType),
          escape(e.entityId),
          escape(e.eventType),
          escape(e.summary),
          escape(e.actor?.role ?? ''),
          escape(e.actor?.name ?? ''),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    void fetchPage(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedCount = useMemo(() => {
    const byType = new Map<string, number>();
    for (const e of events) {
      byType.set(e.eventType, (byType.get(e.eventType) ?? 0) + 1);
    }
    return [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  return (
    <PageStack>
      <PageHeader
        title="Activity Log"
        description="See who did what across storefront, POS, kitchen, and admin. Filters below narrow the list; each card shows the story first, with technical IDs tucked under “Details”."
      />

      <DataPanel>
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to show</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">App</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  value={app}
                  onChange={(e) => setApp(e.target.value as (typeof appOptions)[number])}
                >
                  {appOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All apps' : formatActivityApp(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">Record type</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as (typeof entityOptions)[number])}
                >
                  {entityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'All types' : formatActivityEntityType(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">Who (role)</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  value={actorRole}
                  onChange={(e) => setActorRole(e.target.value as (typeof actorRoleOptions)[number])}
                >
                  {actorRoleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'Everyone' : formatActivityActorRole(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">Event name contains</span>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  placeholder="e.g. payment, courier"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time & search</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">From</span>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">To</span>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <span className="text-sm text-foreground">Search</span>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  placeholder="Name, summary, or ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm text-foreground">Max rows</span>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  type="number"
                  min={20}
                  max={300}
                  value={limit}
                  onChange={(e) => setLimit(Math.min(300, Math.max(20, Number(e.target.value) || 120)))}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button
              type="button"
              className="h-10 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm"
              onClick={() => void load()}
            >
              Apply filters
            </button>
            <button
              type="button"
              className="h-10 rounded-md border border-input bg-background px-5 text-sm font-medium"
              onClick={() => {
                setApp('all');
                setEntityType('all');
                setActorRole('all');
                setEventType('');
                setQuery('');
                setFromDate('');
                setToDate('');
                setLimit(120);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="h-10 rounded-md border border-input bg-background px-5 text-sm font-medium disabled:opacity-50"
              onClick={() => exportCsv()}
              disabled={events.length === 0}
            >
              Export CSV
            </button>
          </div>
        </div>
      </DataPanel>

      {loadError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <DataPanel>
          {loading ? (
            <EmptyState title="Loading activity..." description="Fetching critical ops events." />
          ) : events.length === 0 ? (
            <EmptyState
              title="No events found"
              description="Try broader filters. If this is a fresh setup, run the API migration and perform a few admin/order actions to generate activity."
            />
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const showOrderLink = event.entityType === 'order' && event.entityId.length > 0;
                return (
                  <article
                    key={event.id}
                    className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${activityEventCardToneClass(event)}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {activityEventLooksLikeFailure(event) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Needs attention
                            </span>
                          ) : null}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {formatActivityEventTypeLabel(event.eventType)}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold leading-snug text-foreground">{event.summary}</h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                            <span className="text-foreground">
                              {event.actor?.name?.trim() || 'Unknown actor'}
                            </span>
                            {event.actor?.role ? (
                              <span className="text-muted-foreground">
                                · {formatActivityActorRole(event.actor.role)}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-md border border-border/80 bg-background/80 px-2 py-1 text-xs">
                            Where: <strong className="font-medium text-foreground">{formatActivityApp(event.app)}</strong>
                          </span>
                          <span className="rounded-md border border-border/80 bg-background/80 px-2 py-1 text-xs">
                            {formatActivityEntityType(event.entityType)}
                            {event.entityId ? (
                              <span className="text-muted-foreground" title={event.entityId}>
                                {' '}
                                · <code className="text-xs">{shortId(event.entityId)}</code>
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <details className="group text-sm">
                          <summary className="cursor-pointer list-none text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                            Technical details
                          </summary>
                          <dl className="mt-2 space-y-1 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                            <div>
                              <dt className="inline text-foreground/80">eventType:</dt>{' '}
                              <dd className="inline">{event.eventType}</dd>
                            </div>
                            <div>
                              <dt className="inline text-foreground/80">entityId:</dt>{' '}
                              <dd className="inline break-all">{event.entityId}</dd>
                            </div>
                          </dl>
                        </details>
                      </div>
                      <time
                        className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-right"
                        dateTime={String(event.createdAt)}
                      >
                        {fmtDate(event.createdAt)}
                      </time>
                    </div>
                    {showOrderLink ? (
                      <div className="mt-4 border-t border-border/60 pt-3">
                        <Link
                          href={`/orders?openOrder=${encodeURIComponent(event.entityId)}`}
                          className="inline-flex items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                        >
                          Open order in Orders
                        </Link>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {nextCursor ? (
                <div className="pt-3">
                  <button
                    type="button"
                    className="h-9 rounded border bg-background px-4 text-xs font-semibold hover:bg-muted/50"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </DataPanel>

        <DataPanel>
          <p className="mb-1 text-sm font-semibold text-foreground">In this list</p>
          <p className="mb-4 text-xs text-muted-foreground">Most common event types in the results above.</p>
          <ul className="space-y-2">
            {groupedCount.length ? (
              groupedCount.map(([name, count]) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 font-medium leading-tight text-foreground">{formatActivityEventTypeLabel(name)}</span>
                  <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No events loaded yet.</li>
            )}
          </ul>
        </DataPanel>
      </div>
    </PageStack>
  );
}
