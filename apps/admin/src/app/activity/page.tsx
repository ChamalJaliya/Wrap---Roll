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
  type ActivityCountBeforeResult,
  type ActivityPurgeResult,
  type OpsActivityEventRow,
  type OpsActivityFeedPage,
} from '@wrap-roll/contracts';
import {
  Button,
  DataPanel,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  NativeSelect,
  PageStack,
  toast,
} from '@wrap-roll/shared-ui';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import {
  adminInlineAlertErrorClass,
  adminPageContainerClass,
  adminPageRootClass,
} from '../../lib/admin-ui-contract';

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

function toMetaRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function titleWords(value: unknown): string {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function humanActivitySummary(event: OpsActivityEventRow): string {
  const meta = toMetaRecord(event.metadataJson);
  const fallback =
    event.summary || formatActivityEventTypeLabel(event.eventType);
  switch (event.eventType) {
    case 'order.status_changed': {
      const to = titleWords(meta?.toStatus ?? '');
      const from = titleWords(meta?.fromStatus ?? '');
      if (to && from) return `Order moved from ${from} to ${to}`;
      if (to) return `Order moved to ${to}`;
      return fallback;
    }
    case 'order.courier_assigned':
      return 'Courier assigned and order moved to In Transit';
    case 'order.payment_collected': {
      const method = String(meta?.method ?? '').toUpperCase();
      if (method) return `${method} payment collected`;
      return 'Payment collected';
    }
    case 'order.created':
      return 'Order placed';
    case 'order.lines_replaced':
      return 'Order items were updated';
    case 'order.support_updated':
      return 'Customer or fulfillment details were updated';
    case 'order.delivery_attempt_failed':
      return 'Delivery attempt failed (retry needed)';
    case 'order.delivery_handover_released':
      return 'Delivery was handed back to queue';
    case 'order.delivery_handover_reassigned':
      return 'Delivery was handed over to another courier';
    default:
      return fallback;
  }
}

function humanEventTagLabel(eventType: string): string {
  switch (eventType) {
    case 'order.status_changed':
      return 'Order stage updated';
    case 'order.created':
      return 'Order placed';
    case 'order.payment_collected':
      return 'Payment received';
    case 'order.lines_replaced':
      return 'Items updated';
    case 'order.support_updated':
      return 'Order details updated';
    case 'order.courier_assigned':
      return 'Courier assigned';
    case 'order.delivery_attempt_failed':
      return 'Delivery retry needed';
    case 'order.delivery_handover_released':
      return 'Delivery returned to queue';
    case 'order.delivery_handover_reassigned':
      return 'Delivery reassigned';
    default:
      return formatActivityEventTypeLabel(eventType);
  }
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

/** `datetime-local` value is usually `YYYY-MM-DDTHH:mm`; browsers may omit seconds. */
function parsePurgeCutoffLocal(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function AdminActivityPage() {
  const [events, setEvents] = useState<OpsActivityEventRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [app, setApp] = useState<(typeof appOptions)[number]>('all');
  const [entityType, setEntityType] =
    useState<(typeof entityOptions)[number]>('all');
  const [actorRole, setActorRole] =
    useState<(typeof actorRoleOptions)[number]>('all');
  const [eventType, setEventType] = useState('');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [limit, setLimit] = useState(120);

  const [purgeBeforeLocal, setPurgeBeforeLocal] = useState('');
  const [purgePreviewCount, setPurgePreviewCount] = useState<number | null>(
    null,
  );
  const [purgePreviewLoading, setPurgePreviewLoading] = useState(false);
  const [purgePreviewForbidden, setPurgePreviewForbidden] = useState(false);
  const [purgePreviewError, setPurgePreviewError] = useState<string | null>(
    null,
  );
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purging, setPurging] = useState(false);

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

  const resetFilters = () => {
    setApp('all');
    setEntityType('all');
    setActorRole('all');
    setEventType('');
    setQuery('');
    setFromDate('');
    setToDate('');
    setLimit(120);
  };

  const exportCsv = () => {
    const headers = [
      'createdAt',
      'app',
      'entityType',
      'entityId',
      'eventType',
      'summary',
      'actorRole',
      'actorName',
    ];
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
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
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

  useEffect(() => {
    if (!purgeBeforeLocal.trim()) {
      setPurgePreviewCount(null);
      setPurgePreviewLoading(false);
      setPurgePreviewForbidden(false);
      setPurgePreviewError(null);
      return;
    }
    const cutoff = parsePurgeCutoffLocal(purgeBeforeLocal);
    if (!cutoff) {
      setPurgePreviewCount(null);
      setPurgePreviewForbidden(false);
      setPurgePreviewError(null);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        setPurgePreviewLoading(true);
        setPurgePreviewForbidden(false);
        setPurgePreviewError(null);
        try {
          const { data } = await api.get<ActivityCountBeforeResult>(
            '/activity/count-before',
            {
              params: { before: cutoff.toISOString() },
            },
          );
          if (cancelled) return;
          setPurgePreviewCount(
            typeof data?.count === 'number' ? data.count : 0,
          );
        } catch (error: unknown) {
          if (cancelled) return;
          setPurgePreviewCount(null);
          if (axios.isAxiosError(error) && error.response?.status === 403) {
            setPurgePreviewForbidden(true);
            setPurgePreviewError(null);
          } else {
            setPurgePreviewForbidden(false);
            const st = axios.isAxiosError(error)
              ? error.response?.status
              : undefined;
            setPurgePreviewError(
              st === 404
                ? 'Preview endpoint missing — redeploy or restart the API so /activity/count-before is available.'
                : axios.isAxiosError(error) && !error.response
                  ? 'Could not reach the API. Check your connection and that the server is running.'
                  : 'Could not load row count. Try again or ask an admin to verify the activity API.',
            );
          }
        } finally {
          if (!cancelled) setPurgePreviewLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [purgeBeforeLocal]);

  const purgeCutoffParsed = parsePurgeCutoffLocal(purgeBeforeLocal);
  const purgeCutoffInvalid =
    Boolean(purgeBeforeLocal.trim()) && purgeCutoffParsed === null;

  const executePurge = async () => {
    const cutoff = parsePurgeCutoffLocal(purgeBeforeLocal);
    if (!purgeBeforeLocal.trim() || !cutoff) {
      toast.error('Choose a valid date and time first.');
      return;
    }
    setPurging(true);
    try {
      const { data } = await api.post<ActivityPurgeResult>('/activity/purge', {
        before: cutoff.toISOString(),
      });
      const n = data?.deleted ?? 0;
      toast.success(
        n === 0
          ? 'No matching activity logs to remove.'
          : `Removed ${n.toLocaleString()} activity log${n === 1 ? '' : 's'}.`,
      );
      setPurgeDialogOpen(false);
      await load();
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        toast.error('Only admins can delete activity logs.');
      } else {
        const msg =
          axios.isAxiosError(error) && error.response?.data?.message
            ? String(error.response.data.message)
            : 'Could not delete activity logs.';
        toast.error(msg);
      }
    } finally {
      setPurging(false);
    }
  };

  const groupedCount = useMemo(() => {
    const byType = new Map<string, number>();
    for (const e of events) {
      byType.set(e.eventType, (byType.get(e.eventType) ?? 0) + 1);
    }
    return [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <PageStack>
          <AdminPageHeader
            title="Activity Log"
            description="Plain-language timeline across storefront, POS, kitchen, delivery, and admin. Expand “System details” only when you need technical context."
          />

          <DataPanel className="border-border/80 shadow-sm">
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  What to show
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-app">App</Label>
                    <NativeSelect
                      id="activity-filter-app"
                      className="h-10 min-h-10 py-2"
                      value={app}
                      onChange={(e) =>
                        setApp(e.target.value as (typeof appOptions)[number])
                      }
                    >
                      {appOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all'
                            ? 'All apps'
                            : formatActivityApp(option)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-entity">Record type</Label>
                    <NativeSelect
                      id="activity-filter-entity"
                      className="h-10 min-h-10 py-2"
                      value={entityType}
                      onChange={(e) =>
                        setEntityType(
                          e.target.value as (typeof entityOptions)[number],
                        )
                      }
                    >
                      {entityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all'
                            ? 'All types'
                            : formatActivityEntityType(option)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-role">Who (role)</Label>
                    <NativeSelect
                      id="activity-filter-role"
                      className="h-10 min-h-10 py-2"
                      value={actorRole}
                      onChange={(e) =>
                        setActorRole(
                          e.target.value as (typeof actorRoleOptions)[number],
                        )
                      }
                    >
                      {actorRoleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === 'all'
                            ? 'Everyone'
                            : formatActivityActorRole(option)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-event-type">
                      Event keyword
                    </Label>
                    <Input
                      id="activity-filter-event-type"
                      className="h-10"
                      placeholder="e.g. payment, courier, status"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Time & search
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-from">From</Label>
                    <Input
                      id="activity-filter-from"
                      className="h-10"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-to">To</Label>
                    <Input
                      id="activity-filter-to"
                      className="h-10"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="activity-filter-q">
                      Search people / orders
                    </Label>
                    <Input
                      id="activity-filter-q"
                      className="h-10"
                      placeholder="Name, text, or order ID…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="activity-filter-limit">Max rows</Label>
                    <Input
                      id="activity-filter-limit"
                      className="h-10 max-w-[8rem]"
                      type="number"
                      min={20}
                      max={300}
                      value={limit}
                      onChange={(e) =>
                        setLimit(
                          Math.min(
                            300,
                            Math.max(20, Number(e.target.value) || 120),
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </section>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  className="h-10 w-full sm:w-auto"
                  onClick={() => void load()}
                >
                  Apply filters
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full sm:w-auto"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full sm:w-auto"
                  onClick={() => exportCsv()}
                  disabled={events.length === 0}
                >
                  Export CSV
                </Button>
              </div>
            </div>
          </DataPanel>

          <DataPanel className="border-border/80 border-amber-500/25 bg-amber-50/25 shadow-sm dark:bg-amber-950/10">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Log retention
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Bulk-delete older ops activity so the database does not grow
                  forever. Removes every event with a timestamp{' '}
                  <strong className="text-foreground">strictly before</strong>{' '}
                  the cutoff you pick.{' '}
                  <strong className="text-foreground">Admin only</strong> —
                  cashiers cannot purge.
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label htmlFor="activity-purge-before">
                    Delete logs before (local)
                  </Label>
                  <Input
                    id="activity-purge-before"
                    className="h-10 max-w-md"
                    type="datetime-local"
                    step={60}
                    value={purgeBeforeLocal}
                    onChange={(e) => setPurgeBeforeLocal(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:pb-0.5">
                  {purgePreviewForbidden ? (
                    <span className="text-amber-900 dark:text-amber-100">
                      Preview unavailable — admin role required to purge.
                    </span>
                  ) : purgePreviewLoading ? (
                    <span>Counting matching rows…</span>
                  ) : purgeCutoffInvalid ? (
                    <span className="text-destructive">
                      That value is not a usable date/time. Open the picker
                      again or type{' '}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        YYYY-MM-DDTHH:mm
                      </code>
                      .
                    </span>
                  ) : purgePreviewError ? (
                    <span className="text-destructive">
                      {purgePreviewError}
                    </span>
                  ) : purgePreviewCount !== null ? (
                    <span>
                      <strong className="tabular-nums text-foreground">
                        {purgePreviewCount.toLocaleString()}
                      </strong>{' '}
                      row{purgePreviewCount === 1 ? '' : 's'} would be removed.
                      {purgePreviewCount === 0 ? (
                        <span className="block pt-1 text-muted-foreground">
                          Nothing to delete at or before this cutoff.
                        </span>
                      ) : null}
                    </span>
                  ) : purgeBeforeLocal.trim() ? (
                    <span>Waiting for preview…</span>
                  ) : (
                    <span>Pick a cutoff to see how many rows match.</span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="h-10 w-full sm:w-auto"
                disabled={
                  !purgeBeforeLocal.trim() ||
                  purgeCutoffInvalid ||
                  Boolean(purgePreviewError) ||
                  purgePreviewLoading ||
                  purgePreviewForbidden ||
                  purgePreviewCount === 0 ||
                  purgePreviewCount === null
                }
                onClick={() => setPurgeDialogOpen(true)}
              >
                Remove old logs…
              </Button>
            </div>
          </DataPanel>

          <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
            <DialogContent className="max-w-md" showCloseButton>
              <DialogHeader>
                <DialogTitle>Delete activity logs?</DialogTitle>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This permanently deletes{' '}
                <strong className="text-foreground">
                  {purgePreviewCount !== null
                    ? purgePreviewCount.toLocaleString()
                    : '—'}{' '}
                  event
                  {purgePreviewCount === 1 ? '' : 's'}
                </strong>{' '}
                with timestamps before{' '}
                <strong className="text-foreground">
                  {purgeCutoffParsed
                    ? fmtDate(purgeCutoffParsed)
                    : 'the selected cutoff'}
                </strong>
                . This cannot be undone.
              </p>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={() => setPurgeDialogOpen(false)}
                  disabled={purging}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-10"
                  disabled={purging}
                  onClick={() => void executePurge()}
                >
                  {purging ? 'Deleting…' : 'Delete permanently'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {loadError ? (
            <div
              className={
                loadError.includes('404')
                  ? 'rounded-xl border border-amber-500/35 bg-amber-50 px-4 py-3 text-sm text-amber-950'
                  : adminInlineAlertErrorClass
              }
            >
              {loadError}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
            <DataPanel className="border-border/80 shadow-sm">
              {loading ? (
                <EmptyState
                  title="Loading activity..."
                  description="Fetching critical ops events."
                />
              ) : events.length === 0 ? (
                <EmptyState
                  title="No events found"
                  description="Try broader filters. If this is a fresh setup, run the API migration and perform a few admin/order actions to generate activity."
                />
              ) : (
                <div className="space-y-3">
                  {events.map((event) => {
                    const showOrderLink =
                      event.entityType === 'order' && event.entityId.length > 0;
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
                                  <AlertTriangle
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden
                                  />
                                  Needs attention
                                </span>
                              ) : null}
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                {humanEventTagLabel(event.eventType)}
                              </span>
                            </div>
                            <h3 className="text-base font-semibold leading-snug text-foreground">
                              {humanActivitySummary(event)}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <User
                                  className="h-4 w-4 shrink-0 opacity-70"
                                  aria-hidden
                                />
                                <span className="text-foreground">
                                  {event.actor?.name?.trim() || 'Unknown actor'}
                                </span>
                                {event.actor?.role ? (
                                  <span className="text-muted-foreground">
                                    ·{' '}
                                    {formatActivityActorRole(event.actor.role)}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-md border border-border/80 bg-background/80 px-2 py-1 text-xs">
                                Where:{' '}
                                <strong className="font-medium text-foreground">
                                  {formatActivityApp(event.app)}
                                </strong>
                              </span>
                              <span className="rounded-md border border-border/80 bg-background/80 px-2 py-1 text-xs">
                                {formatActivityEntityType(event.entityType)}
                                {event.entityId ? (
                                  <span
                                    className="text-muted-foreground"
                                    title={event.entityId}
                                  >
                                    {' '}
                                    ·{' '}
                                    <code className="text-xs">
                                      {shortId(event.entityId)}
                                    </code>
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <details className="group text-sm">
                              <summary className="cursor-pointer list-none text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                                System details
                              </summary>
                              <dl className="mt-2 space-y-1 rounded-lg bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                                <div>
                                  <dt className="inline text-foreground/80">
                                    Action:
                                  </dt>{' '}
                                  <dd className="inline">
                                    {humanActivitySummary(event)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline text-foreground/80">
                                    {formatActivityEntityType(event.entityType)}{' '}
                                    ID:
                                  </dt>{' '}
                                  <dd className="inline break-all">
                                    {event.entityId}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline text-foreground/80">
                                    System code:
                                  </dt>{' '}
                                  <dd className="inline">{event.eventType}</dd>
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
                          <div className="mt-4 border-t border-border/60 pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-10 font-semibold"
                              asChild
                            >
                              <Link
                                href={`/orders?openOrder=${encodeURIComponent(event.entityId)}`}
                              >
                                Open order in Orders
                              </Link>
                            </Button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  {nextCursor ? (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full sm:w-auto"
                        disabled={loadingMore}
                        onClick={() => void loadMore()}
                      >
                        {loadingMore ? 'Loading…' : 'Load more'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </DataPanel>

            <DataPanel className="border-border/80 shadow-sm lg:sticky lg:top-4 lg:self-start">
              <div className="mb-4 border-b border-border/60 pb-4">
                <p className="text-sm font-semibold text-foreground">
                  In this list
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Most common event types in the current results.
                </p>
              </div>
              <ul className="space-y-2">
                {groupedCount.length ? (
                  groupedCount.map(([name, count]) => (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 font-medium leading-tight text-foreground">
                        {humanEventTagLabel(name)}
                      </span>
                      <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">
                    No events loaded yet.
                  </li>
                )}
              </ul>
            </DataPanel>
          </div>
        </PageStack>
      </div>
    </div>
  );
}
