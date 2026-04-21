'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../../services/api';
import type {
  NotificationDeliveryRow,
  StaffNotificationRow,
} from '@wrap-roll/contracts';
import {
  NOTIFICATION_PAGE_COPY,
  formatNotificationChannel,
  formatNotificationDeliveryMetaLine,
  formatNotificationDeliveryStatus,
  formatNotificationPageApiError,
  getNotificationDeliveryVisualHints,
  notificationInboxSectionTitle,
  parseNestProxyErrorDetail,
  staffNotificationSummaryLine,
} from '@wrap-roll/contracts';
import { Button, DataPanel, EmptyState, PageHeader, PageStack } from '@wrap-roll/shared-ui';

function fmtDate(value: unknown): string {
  if (!value) return '-';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatApiError(err: unknown, context: 'deliveries' | 'inbox'): string {
  if (axios.isAxiosError(err)) {
    const detail = parseNestProxyErrorDetail(err.response?.data);
    return formatNotificationPageApiError({
      status: err.response?.status,
      detail,
      context,
    });
  }
  return err instanceof Error ? err.message : 'Unknown error.';
}

function deliveryRowToneClass(d: NotificationDeliveryRow): string {
  const { error, skipped } = getNotificationDeliveryVisualHints(d);
  if (error) {
    return 'border-l-4 border-l-red-500/90 bg-red-50/50 dark:bg-red-950/25';
  }
  if (skipped) {
    return 'border-l-4 border-l-amber-500/80 bg-amber-50/40 dark:bg-amber-950/20';
  }
  return 'border-l-4 border-l-emerald-600/50 bg-card';
}

export default function AdminNotificationsPage() {
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRow[]>([]);
  const [deliveryCursor, setDeliveryCursor] = useState<string | null>(null);
  const [inbox, setInbox] = useState<StaffNotificationRow[]>([]);
  const [inboxCursor, setInboxCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const loadDeliveries = useCallback(async (cursor?: string | null) => {
    const res = await api.get<{ items: NotificationDeliveryRow[]; nextCursor: string | null }>(
      '/notifications/deliveries',
      { params: { take: 40, cursor: cursor || undefined } },
    );
    const data = res.data;
    if (cursor) {
      setDeliveries((prev) => [...prev, ...(data.items ?? [])]);
    } else {
      setDeliveries(Array.isArray(data.items) ? data.items : []);
    }
    setDeliveryCursor(data.nextCursor ?? null);
  }, []);

  const loadInbox = useCallback(async (cursor?: string | null) => {
    const res = await api.get<{
      items: StaffNotificationRow[];
      nextCursor: string | null;
      unreadCount: number;
    }>('/notifications/inbox', { params: { take: 30, cursor: cursor || undefined } });
    const data = res.data;
    if (cursor) {
      setInbox((prev) => [...prev, ...(data.items ?? [])]);
    } else {
      setInbox(Array.isArray(data.items) ? data.items : []);
    }
    setInboxCursor(data.nextCursor ?? null);
    setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingDeliveries(true);
      setDeliveryError(null);
      try {
        await loadDeliveries(null);
      } catch (e) {
        if (!cancelled) setDeliveryError(formatApiError(e, 'deliveries'));
      } finally {
        if (!cancelled) setLoadingDeliveries(false);
      }
    })();
    void (async () => {
      setLoadingInbox(true);
      setInboxError(null);
      try {
        await loadInbox(null);
      } catch (e) {
        if (!cancelled) setInboxError(formatApiError(e, 'inbox'));
      } finally {
        if (!cancelled) setLoadingInbox(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDeliveries, loadInbox]);

  const markRead = async (id: string) => {
    try {
      setInboxError(null);
      await api.patch(`/notifications/inbox/${encodeURIComponent(id)}/read`);
      setInbox((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      setInboxError(formatApiError(e, 'inbox'));
    }
  };

  const markAllRead = async () => {
    await api.patch('/notifications/inbox/read-all');
    setInbox((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  };

  return (
    <PageStack>
      <PageHeader title={NOTIFICATION_PAGE_COPY.pageTitle} description={NOTIFICATION_PAGE_COPY.pageDescription} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DataPanel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{NOTIFICATION_PAGE_COPY.smsLogHeading}</h2>
            {deliveryCursor && !deliveryError ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void (async () => {
                    try {
                      setDeliveryError(null);
                      await loadDeliveries(deliveryCursor);
                    } catch (e) {
                      setDeliveryError(formatApiError(e, 'deliveries'));
                    }
                  })();
                }}
              >
                {NOTIFICATION_PAGE_COPY.loadMore}
              </Button>
            ) : null}
          </div>
          {deliveryError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {deliveryError}
            </div>
          ) : null}
          {loadingDeliveries ? (
            <EmptyState title={NOTIFICATION_PAGE_COPY.loadingDeliveries} description={NOTIFICATION_PAGE_COPY.loadingDeliveriesDesc} />
          ) : !deliveryError && deliveries.length === 0 ? (
            <EmptyState title={NOTIFICATION_PAGE_COPY.emptyDeliveriesTitle} description={NOTIFICATION_PAGE_COPY.emptyDeliveriesDesc} />
          ) : !deliveryError ? (
            <ul className="space-y-3 text-sm">
              {deliveries.map((d) => (
                <li key={d.id} className={`rounded-xl border p-4 shadow-sm ${deliveryRowToneClass(d)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground">
                        {formatNotificationDeliveryStatus(d.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatNotificationChannel(d.channel)}</span>
                    </div>
                    <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={String(d.createdAt)}>
                      {fmtDate(d.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-muted-foreground">{formatNotificationDeliveryMetaLine(d)}</p>
                  {d.toMasked ? (
                    <p className="mt-1 text-foreground">
                      {NOTIFICATION_PAGE_COPY.toRecipient}: {d.toMasked}
                    </p>
                  ) : null}
                  {d.bodyPreview ? <p className="mt-2 line-clamp-3 leading-relaxed text-foreground/90">{d.bodyPreview}</p> : null}
                  {d.error ? <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">{d.error}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </DataPanel>

        <DataPanel>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{notificationInboxSectionTitle(unreadCount)}</h2>
            <div className="flex gap-2">
              {unreadCount > 0 && !inboxError ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      try {
                        setInboxError(null);
                        await markAllRead();
                      } catch (e) {
                        setInboxError(formatApiError(e, 'inbox'));
                      }
                    })();
                  }}
                >
                  {NOTIFICATION_PAGE_COPY.markAllRead}
                </Button>
              ) : null}
              {inboxCursor && !inboxError ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      try {
                        setInboxError(null);
                        await loadInbox(inboxCursor);
                      } catch (e) {
                        setInboxError(formatApiError(e, 'inbox'));
                      }
                    })();
                  }}
                >
                  {NOTIFICATION_PAGE_COPY.loadMore}
                </Button>
              ) : null}
            </div>
          </div>
          {inboxError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {inboxError}
            </div>
          ) : null}
          {loadingInbox ? (
            <EmptyState title={NOTIFICATION_PAGE_COPY.loadingInbox} description={NOTIFICATION_PAGE_COPY.loadingInboxDesc} />
          ) : !inboxError && inbox.length === 0 ? (
            <EmptyState title={NOTIFICATION_PAGE_COPY.emptyInboxTitle} description={NOTIFICATION_PAGE_COPY.emptyInboxDesc} />
          ) : !inboxError ? (
            <ul className="space-y-3 text-sm">
              {inbox.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-xl border p-4 shadow-sm ${
                    n.readAt ? 'opacity-85' : 'border-primary/35 bg-primary/5'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {staffNotificationSummaryLine(n)}
                        </span>
                        <span className="text-base font-semibold leading-snug text-foreground">{n.title}</span>
                      </div>
                    </div>
                    <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={String(n.createdAt)}>
                      {fmtDate(n.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 leading-relaxed text-foreground/90">{n.body}</p>
                  {!n.readAt ? (
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void markRead(n.id)}>
                      {NOTIFICATION_PAGE_COPY.markRead}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </DataPanel>
      </div>
    </PageStack>
  );
}
