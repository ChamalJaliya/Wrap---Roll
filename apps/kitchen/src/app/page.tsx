'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKdsStore } from '../store/useKdsStore';
import { OrderCard } from '../components/OrderCard';
import { supabase } from '../lib/supabaseClient';
import { OrderStatus, type KitchenQueueOrder, type QueueOrder } from '@wrap-roll/contracts';
import { Button, EmptyState, Input, OpsHeader, OpsLayout, cn } from '@wrap-roll/shared-ui';
import {
  staffFetchJson,
  getStaffAccessToken,
  hasAllowedStaffRole,
  getSessionRole,
  useQueueDirtyStream,
  resolveApiUrl,
  getOrderItemModifierDisplayLines,
} from '@wrap-roll/order-kit';
import { useNowInterval } from '../hooks/useNowInterval';
import { playKdsChime } from '../lib/kds-chime';
import { type KdsLaneFilter, orderMatchesLane } from '../lib/kds-lane';

type PrepVariantSummary = {
  key: string;
  itemName: string;
  variant: string;
  qty: number;
  ticketCount: number;
};
type PrepTimeBucket = 'now' | 'next' | 'later';
type QueueFocusFilter = 'all' | 'ongoing' | 'incoming';

function bucketForOrder(
  order: KitchenQueueOrder | QueueOrder,
  nowMs: number,
): PrepTimeBucket {
  const targetRaw = order.estimatedReadyTime ?? order.placedAt;
  if (!targetRaw) return 'later';
  const targetMs = new Date(String(targetRaw)).getTime();
  if (!Number.isFinite(targetMs)) return 'later';
  const diffMin = Math.floor((targetMs - nowMs) / 60000);
  if (diffMin <= 15) return 'now';
  if (diffMin <= 45) return 'next';
  return 'later';
}

function buildPrepSummary(orders: (KitchenQueueOrder | QueueOrder)[]): PrepVariantSummary[] {
  const rows = new Map<string, PrepVariantSummary>();
  for (const order of orders) {
    const seenInTicket = new Set<string>();
    for (const item of order.items ?? []) {
      const lines = getOrderItemModifierDisplayLines(item.modifiersJson);
      const variant =
        lines.length > 0
          ? lines.map((line) => `${line.label}: ${line.value}`).join(' | ')
          : 'Standard build';
      const key = `${item.name}__${variant}`;
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, {
          key,
          itemName: item.name,
          variant,
          qty: Number(item.quantity ?? 0),
          ticketCount: 1,
        });
      } else {
        existing.qty += Number(item.quantity ?? 0);
        if (!seenInTicket.has(key)) existing.ticketCount += 1;
      }
      seenInTicket.add(key);
    }
  }
  return [...rows.values()].sort((a, b) => {
    if (b.qty !== a.qty) return b.qty - a.qty;
    if (b.ticketCount !== a.ticketCount) return b.ticketCount - a.ticketCount;
    return a.itemName.localeCompare(b.itemName);
  });
}

export default function KdsPage() {
  const {
    activeOrders,
    setOrders,
    updateOrderStatus,
    orderUpdateAlerts,
    acknowledgeOrderUpdate,
  } = useKdsStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [kdsLaneFilter, setKdsLaneFilter] = useState<KdsLaneFilter>('all');
  const [queueFocus, setQueueFocus] = useState<QueueFocusFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [visualMode, setVisualMode] = useState<'classic' | 'modern'>('modern');
  const [preparedTodayOrders, setPreparedTodayOrders] = useState<(KitchenQueueOrder | QueueOrder)[]>([]);
  const isModern = visualMode === 'modern';
  const isSignedIn = useMemo(() => Boolean(sessionToken), [sessionToken]);

  const kdsChimeArmedRef = useRef(false);
  const prevIdsSnapshotRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const v = localStorage.getItem('kds-sound-enabled');
      if (v === '0') setSoundEnabled(false);
      const mode = localStorage.getItem('kds-visual-mode');
      if (mode === 'classic' || mode === 'modern') setVisualMode(mode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kds-sound-enabled', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleVisualMode = useCallback(() => {
    setVisualMode((prev) => {
      const next = prev === 'modern' ? 'classic' : 'modern';
      try {
        localStorage.setItem('kds-visual-mode', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const allowed = hasAllowedStaffRole(data.session, ['KITCHEN', 'ADMIN']);
      setSessionToken(allowed ? data.session?.access_token ?? null : null);
      setRole(getSessionRole(data.session));
      setAuthError(
        data.session && !allowed
          ? 'This account is not permitted for Kitchen. Use KITCHEN or ADMIN role.'
          : null,
      );
      setLoading(false);
    };
    bootstrap();
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const allowed = hasAllowedStaffRole(session, ['KITCHEN', 'ADMIN']);
      setSessionToken(allowed ? session?.access_token ?? null : null);
      setRole(getSessionRole(session));
      if (session && !allowed) {
        setAuthError('This account is not permitted for Kitchen. Use KITCHEN or ADMIN role.');
      }
    });
    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const token = await getStaffAccessToken(async () => {
        const { data } = await supabase.auth.getSession();
        return { data };
      });
      const [activeRes, preparedRes] = await Promise.all([
        staffFetchJson<(KitchenQueueOrder | QueueOrder)[]>(
          '/orders/queue?status=placed,paid,in_kitchen&date=today',
          { token },
        ),
        staffFetchJson<(KitchenQueueOrder | QueueOrder)[]>(
          '/orders/queue?status=ready,delivered&date=today',
          { token },
        ),
      ]);
      if (!activeRes.ok) throw new Error(activeRes.error.message);
      if (!preparedRes.ok) throw new Error(preparedRes.error.message);
      setOrders(activeRes.data);
      setPreparedTodayOrders(preparedRes.data);
    } catch (error) {
      console.error('Failed to fetch KDS queue:', error);
    }
  }, [setOrders]);

  useQueueDirtyStream({
    enabled: isSignedIn,
    apiBaseUrl: resolveApiUrl(),
    getAccessToken: () =>
      getStaffAccessToken(async () => {
        const { data } = await supabase.auth.getSession();
        return { data };
      }),
    onDirty: () => void fetchActiveOrders(),
  });

  useEffect(() => {
    if (!isSignedIn) {
      setOrders([]);
      return;
    }
    void fetchActiveOrders();
    const poll = window.setInterval(() => void fetchActiveOrders(), 120_000);
    return () => {
      window.clearInterval(poll);
    };
  }, [setOrders, isSignedIn, fetchActiveOrders]);

  /** New ticket arrival — short chime (after initial snapshot for this session). */
  useEffect(() => {
    if (!isSignedIn) {
      kdsChimeArmedRef.current = false;
      prevIdsSnapshotRef.current = new Set();
      return;
    }
    const ids = new Set(activeOrders.map((o) => o.id));
    if (!kdsChimeArmedRef.current) {
      kdsChimeArmedRef.current = true;
      prevIdsSnapshotRef.current = ids;
      return;
    }
    let added = false;
    for (const id of ids) {
      if (!prevIdsSnapshotRef.current.has(id)) added = true;
    }
    prevIdsSnapshotRef.current = ids;
    if (added && soundEnabled) void playKdsChime();
  }, [isSignedIn, activeOrders, soundEnabled]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      const current = activeOrders.find((o) => o.id === orderId)?.status;
      if (current === status) return;
      const token = await getStaffAccessToken(async () => {
        const { data } = await supabase.auth.getSession();
        return { data };
      });
      const response = await staffFetchJson<{ id: string }>(`/orders/${orderId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      if (response.ok) {
        updateOrderStatus(orderId, status);
      } else {
        console.error('Failed to update status via API:', response.error.message);
      }
    } catch (err) {
      console.error('Handshake failed:', err);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    } else if (!hasAllowedStaffRole(data.session, ['KITCHEN', 'ADMIN'])) {
      await supabase.auth.signOut();
      setAuthError('Signed in, but this account is not authorized for Kitchen.');
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setOrders([]);
    setLoading(false);
  };

  /** Most urgent + oldest-first within the same band — easier to scan on a wall display. */
  const sortedActiveOrders = useMemo(() => {
    const rank = (o: KitchenQueueOrder | QueueOrder) => {
      let band = 0;
      if (o.slaBucket === 'overdue') band = 400;
      else if (o.slaBucket === 'due_soon') band = 200;
      else if (o.kitchenPriority === 'rush') band = 100;
      const placedMs = o.placedAt ? new Date(String(o.placedAt)).getTime() : 0;
      return band * 1e15 - placedMs;
    };
    return [...activeOrders].sort((a, b) => rank(b) - rank(a));
  }, [activeOrders]);

  const headerNow = useNowInterval(60_000);

  const laneCounts = useMemo(() => {
    const c = { all: activeOrders.length, takeaway: 0, dine_in: 0, delivery: 0 };
    for (const o of activeOrders) {
      const ft = String(o.fulfillmentType ?? '').toLowerCase();
      if (ft === 'takeaway') c.takeaway++;
      else if (ft === 'dine_in') c.dine_in++;
      else if (ft === 'delivery') c.delivery++;
    }
    return c;
  }, [activeOrders]);

  const filteredSortedOrders = useMemo(() => {
    if (kdsLaneFilter === 'all') return sortedActiveOrders;
    return sortedActiveOrders.filter((o) => orderMatchesLane(o.fulfillmentType, kdsLaneFilter));
  }, [sortedActiveOrders, kdsLaneFilter]);

  const focusCounts = useMemo(() => {
    let ongoing = 0;
    let incoming = 0;
    for (const o of filteredSortedOrders) {
      if (o.status === 'in_kitchen') ongoing++;
      else if (o.status === 'placed' || o.status === 'paid') incoming++;
    }
    return {
      all: filteredSortedOrders.length,
      ongoing,
      incoming,
    };
  }, [filteredSortedOrders]);

  const queueFocusedOrders = useMemo(() => {
    if (queueFocus === 'ongoing') {
      return filteredSortedOrders.filter((o) => o.status === 'in_kitchen');
    }
    if (queueFocus === 'incoming') {
      return filteredSortedOrders.filter((o) => o.status === 'placed' || o.status === 'paid');
    }
    return filteredSortedOrders;
  }, [filteredSortedOrders, queueFocus]);

  const oldestWaitLabel = useMemo(() => {
    const list = kdsLaneFilter === 'all' ? sortedActiveOrders : filteredSortedOrders;
    if (list.length === 0) return '—';
    let oldestMs = 0;
    for (const o of list) {
      const t = o.placedAt ? new Date(String(o.placedAt)).getTime() : headerNow;
      const age = headerNow - t;
      if (age > oldestMs) oldestMs = age;
    }
    const min = Math.floor(oldestMs / 60000);
    return min < 1 ? '<1m' : `${min}m`;
  }, [kdsLaneFilter, filteredSortedOrders, sortedActiveOrders, headerNow]);

  const prepSummary = useMemo<PrepVariantSummary[]>(
    () => buildPrepSummary(queueFocusedOrders),
    [queueFocusedOrders],
  );

  const preparedTodayByLane = useMemo(() => {
    if (kdsLaneFilter === 'all') return preparedTodayOrders;
    return preparedTodayOrders.filter((o) => orderMatchesLane(o.fulfillmentType, kdsLaneFilter));
  }, [preparedTodayOrders, kdsLaneFilter]);

  const preparedMealsSummary = useMemo<PrepVariantSummary[]>(
    () => buildPrepSummary(preparedTodayByLane),
    [preparedTodayByLane],
  );

  const prepBuckets = useMemo(() => {
    const nowOrders: (KitchenQueueOrder | QueueOrder)[] = [];
    const nextOrders: (KitchenQueueOrder | QueueOrder)[] = [];
    const laterOrders: (KitchenQueueOrder | QueueOrder)[] = [];
    for (const order of queueFocusedOrders) {
      const bucket = bucketForOrder(order, headerNow);
      if (bucket === 'now') nowOrders.push(order);
      else if (bucket === 'next') nextOrders.push(order);
      else laterOrders.push(order);
    }
    return {
      now: buildPrepSummary(nowOrders),
      next: buildPrepSummary(nextOrders),
      later: buildPrepSummary(laterOrders),
    };
  }, [queueFocusedOrders, headerNow]);

  if (!isSignedIn) {
    return (
      <OpsLayout className="px-4 py-8 sm:px-6">
        <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-7 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
          <h1 className="text-xl font-bold text-foreground">Kitchen sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use a KITCHEN (or ADMIN) account to access the live queue.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="chef1@wrapnroll.com"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            {authError ? (
              <p className="text-sm font-medium text-red-600">{authError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in to KDS'}
            </Button>
          </form>
        </div>
      </OpsLayout>
    );
  }

  return (
    <OpsLayout className="bg-gradient-to-b from-orange-50/90 via-zinc-50 to-zinc-100/95 px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <OpsHeader
          accentBorder
          className={cn(
            'rounded-3xl px-5 py-5 sm:px-7 sm:py-6 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:tracking-tight sm:[&_h1]:text-4xl',
            isModern
              ? 'border border-white/70 bg-gradient-to-r from-white/96 via-orange-50/45 to-white/92 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.35)] ring-1 ring-orange-200/60 backdrop-blur-[2px] [&_h1]:text-zinc-950'
              : 'border-2 border-orange-200/80 bg-white/95 shadow-sm [&_h1]:text-zinc-900',
          )}
          title="Kitchen Display"
          subtitle={
            <div className="space-y-1">
              <span className="text-sm font-medium text-zinc-600">
                Today&apos;s active kitchen tickets
              </span>
              {role ? (
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Signed in as {role}
                </span>
              ) : null}
            </div>
          }
        >
          <div className="flex w-full flex-wrap items-center justify-end gap-2.5 sm:w-auto sm:gap-3">
            <div
              className={cn(
                'flex min-h-[3.35rem] min-w-[8.3rem] flex-col justify-center rounded-2xl px-4 py-2 text-right touch-manipulation',
                isModern
                  ? 'border border-orange-200/80 bg-gradient-to-b from-white to-orange-50/80 shadow-[0_10px_24px_-18px_rgba(249,115,22,0.45)]'
                  : 'border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/90 shadow-sm',
              )}
            >
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-orange-700/90">
                Active queue
              </span>
              <span className="text-[2rem] font-black tabular-nums leading-none text-orange-950 sm:text-[2.2rem]">
                {activeOrders.length}
              </span>
            </div>
            <div
              className={cn(
                'flex min-h-[3.35rem] min-w-[8.3rem] flex-col justify-center rounded-2xl px-4 py-2 text-right touch-manipulation',
                isModern
                  ? 'border border-zinc-200/80 bg-white shadow-[0_10px_24px_-18px_rgba(0,0,0,0.32)]'
                  : 'border-2 border-zinc-200 bg-white shadow-sm',
              )}
            >
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-zinc-500">
                Oldest wait
              </span>
              <span className="text-[2rem] font-black tabular-nums leading-none text-zinc-900 sm:text-[2.2rem]">
                {oldestWaitLabel}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(
                'min-h-[3.35rem] touch-manipulation rounded-2xl px-4 text-sm font-semibold',
                isModern
                  ? 'border-zinc-200 bg-white text-zinc-800 shadow-[0_8px_20px_-16px_rgba(0,0,0,0.4)] hover:bg-zinc-50'
                  : 'border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50',
              )}
              onClick={toggleVisualMode}
            >
              {isModern ? 'Modern UI' : 'Classic UI'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(
                'min-h-[3.35rem] touch-manipulation rounded-2xl px-4 text-sm font-semibold',
                soundEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
              )}
              onClick={toggleSound}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? 'Sound on' : 'Muted'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-[3.35rem] touch-manipulation rounded-2xl border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-[0_8px_20px_-16px_rgba(0,0,0,0.4)] hover:bg-zinc-50"
              onClick={handleSignOut}
              disabled={loading}
            >
              Sign out
            </Button>
          </div>
        </OpsHeader>

        {activeOrders.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ['all', 'All', laneCounts.all] as const,
                ['takeaway', 'Pickup', laneCounts.takeaway] as const,
                ['dine_in', 'Dine-in', laneCounts.dine_in] as const,
                ['delivery', 'Delivery', laneCounts.delivery] as const,
              ] as const
            ).map(([lane, label, count]) => (
              <button
                key={lane}
                type="button"
                aria-pressed={kdsLaneFilter === lane}
                className={cn(
                  'touch-manipulation inline-flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-colors',
                  kdsLaneFilter === lane
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md'
                    : 'border-border bg-white text-zinc-800 hover:bg-zinc-50',
                )}
                onClick={() => setKdsLaneFilter(lane)}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-black tabular-nums',
                    kdsLaneFilter === lane ? 'bg-white/25 text-white' : 'bg-zinc-100 text-zinc-700',
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {activeOrders.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'All queue', focusCounts.all] as const,
                ['ongoing', 'Ongoing', focusCounts.ongoing] as const,
                ['incoming', 'Incoming', focusCounts.incoming] as const,
              ] as const
            ).map(([focus, label, count]) => (
              <button
                key={focus}
                type="button"
                aria-pressed={queueFocus === focus}
                className={cn(
                  'touch-manipulation inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-colors',
                  queueFocus === focus
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
                onClick={() => setQueueFocus(focus)}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[0.65rem] font-black tabular-nums',
                    queueFocus === focus ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700',
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
            {focusCounts.all >= 10 ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-800">
                Crowded mode: use Ongoing/Incoming
              </span>
            ) : null}
          </div>
        ) : null}

        {prepSummary.length > 0 ? (
          <section
            className={cn(
              'mt-6 overflow-hidden rounded-3xl p-4 sm:p-5',
              isModern
                ? 'border border-white/60 bg-gradient-to-br from-white/95 via-orange-50/70 to-amber-50/70 shadow-[0_18px_50px_-20px_rgba(249,115,22,0.45)] ring-1 ring-orange-300/25 backdrop-blur-[2px]'
                : 'border-2 border-orange-200/70 bg-white/90 shadow-sm',
            )}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black tracking-tight text-zinc-900 sm:text-xl">
                Pending recipes by variant
              </h2>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-orange-800',
                  isModern
                    ? 'border border-orange-200/80 bg-white/90 shadow-sm'
                    : 'bg-orange-100',
                )}
              >
                {prepSummary.length} variants
              </span>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {([
                ['now', 'Now (<=15m)', prepBuckets.now, 'bg-red-500'],
                ['next', 'Next (15-45m)', prepBuckets.next, 'bg-amber-500'],
                ['later', 'Later (45m+)', prepBuckets.later, 'bg-zinc-500'],
              ] as const).map(([, label, rows, accent]) => (
                <div
                  key={label}
                  className={cn(
                    'rounded-2xl p-3.5',
                    isModern
                      ? 'border border-white/70 bg-white/85 shadow-[0_8px_22px_-12px_rgba(0,0,0,0.2)] ring-1 ring-zinc-200/60'
                      : 'border border-zinc-200 bg-white',
                  )}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-700">{label}</p>
                    <span className={cn('h-2.5 w-2.5 rounded-full shadow-sm', accent)} />
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-sm font-medium text-zinc-400">No variants</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rows.slice(0, 3).map((row) => (
                        <li key={`${label}-${row.key}`} className="text-sm text-zinc-700">
                          <span className="font-black tabular-nums text-zinc-900">{row.qty}x</span>{' '}
                          <span className="font-semibold">{row.itemName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {prepSummary.slice(0, 12).map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    'group rounded-2xl p-3.5',
                    isModern
                      ? 'border border-white/70 bg-white/85 shadow-[0_10px_28px_-14px_rgba(0,0,0,0.25)] ring-1 ring-zinc-200/60 transition-transform duration-150 hover:-translate-y-0.5'
                      : 'border border-zinc-200 bg-zinc-50/75 shadow-sm',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-zinc-900">{row.itemName}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{row.variant}</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 px-2.5 py-1 text-right text-white shadow-sm">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em]">Qty</p>
                      <p className="text-xl font-black leading-none tabular-nums">{row.qty}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    Across {row.ticketCount} ticket{row.ticketCount === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {preparedTodayByLane.length > 0 ? (
          <section
            className={cn(
              'mt-6 rounded-3xl p-4 sm:p-5',
              isModern
                ? 'border border-white/60 bg-gradient-to-br from-white/95 via-emerald-50/60 to-white/92 shadow-[0_18px_44px_-24px_rgba(16,185,129,0.35)] ring-1 ring-emerald-200/60'
                : 'border-2 border-emerald-200/70 bg-white shadow-sm',
            )}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black tracking-tight text-zinc-900 sm:text-xl">
                Prepared today
              </h2>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
                {preparedTodayByLane.length} tickets
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preparedMealsSummary.slice(0, 9).map((meal) => (
                <div
                  key={`prepared-${meal.key}`}
                  className="rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-zinc-900">{meal.itemName}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{meal.variant}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-600 px-2.5 py-1 text-right text-white">
                      <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em]">Qty</p>
                      <p className="text-lg font-black leading-none tabular-nums">{meal.qty}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeOrders.length === 0 ? (
          <EmptyState
            variant="dashed"
            className="mt-10 rounded-3xl border-2 border-dashed border-orange-200/70 bg-white/80 py-20 shadow-sm backdrop-blur-[2px] [&_h3]:text-3xl [&_h3]:font-black [&_p]:max-w-md [&_p]:text-base"
            decoration={<span className="mb-2 text-6xl">🍔</span>}
            title="All clear"
            description="Standing by for incoming tickets…"
          />
        ) : queueFocusedOrders.length === 0 ? (
          <EmptyState
            variant="dashed"
            className="mt-10 rounded-3xl border-2 border-dashed border-orange-200/70 bg-white/80 py-16 shadow-sm backdrop-blur-[2px] [&_h3]:text-2xl [&_h3]:font-black [&_p]:max-w-md [&_p]:text-base"
            decoration={<span className="mb-2 text-5xl">🔎</span>}
            title="Nothing in this queue focus"
            description="Try switching between Ongoing, Incoming, or All queue."
          />
        ) : (
          <section
            className={cn(
              'mt-8 rounded-3xl p-4 sm:p-5',
              isModern
                ? 'border border-white/60 bg-gradient-to-b from-white/90 via-zinc-50/75 to-zinc-100/70 shadow-[0_16px_44px_-22px_rgba(0,0,0,0.28)] ring-1 ring-zinc-200/60'
                : 'border-2 border-zinc-200 bg-white shadow-sm',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight text-zinc-900 sm:text-xl">
                Live ticket board
              </h2>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-700',
                  isModern ? 'border border-zinc-200 bg-white/90 shadow-sm' : 'bg-zinc-100',
                )}
              >
                {queueFocusedOrders.length} tickets
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] sm:gap-6 xl:gap-7">
              {queueFocusedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  queueOrder={order}
                  onStatusChange={handleStatusChange}
                  visualMode={visualMode}
                  updateAlert={orderUpdateAlerts[order.id]}
                  onAcknowledgeUpdate={acknowledgeOrderUpdate}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </OpsLayout>
  );
}
