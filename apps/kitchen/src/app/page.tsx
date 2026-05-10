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
} from '@wrap-roll/order-kit';
import { useNowInterval } from '../hooks/useNowInterval';
import { playKdsChime } from '../lib/kds-chime';
import { type KdsLaneFilter, orderMatchesLane } from '../lib/kds-lane';

export default function KdsPage() {
  const { activeOrders, setOrders, updateOrderStatus } = useKdsStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [kdsLaneFilter, setKdsLaneFilter] = useState<KdsLaneFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const isSignedIn = useMemo(() => Boolean(sessionToken), [sessionToken]);

  const kdsChimeArmedRef = useRef(false);
  const prevIdsSnapshotRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const v = localStorage.getItem('kds-sound-enabled');
      if (v === '0') setSoundEnabled(false);
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
      const response = await staffFetchJson<(KitchenQueueOrder | QueueOrder)[]>(
        '/orders/queue?status=placed,paid,in_kitchen&date=today',
        { token },
      );
      if (!response.ok) {
        throw new Error(response.error.message);
      }
      const releasable = response.data.filter(
        (o) => o.status === 'in_kitchen' || o.kitchenEligible === true,
      );
      setOrders(releasable);
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
          className="rounded-3xl border border-orange-200/80 bg-white/95 px-5 py-6 shadow-[0_12px_40px_-12px_rgba(249,115,22,0.25),0_8px_24px_-8px_rgba(0,0,0,0.08)] ring-1 ring-orange-500/10 sm:px-7 sm:py-7 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-zinc-900 sm:[&_h1]:text-4xl"
          title="Kitchen Display"
          subtitle={
            <>
              <span className="text-muted-foreground">
                Showing tickets that are <strong className="font-semibold text-zinc-800">eligible</strong> or{' '}
                <strong className="font-semibold text-zinc-800">in kitchen</strong>
              </span>
              {role ? (
                <span className="mt-1 block text-sm font-medium text-muted-foreground">
                  Signed in as {role}
                </span>
              ) : null}
            </>
          }
        >
          <div className="flex w-full flex-wrap items-stretch justify-end gap-3 sm:w-auto sm:items-center">
            <div className="flex min-h-[3.25rem] min-w-[8.5rem] flex-col justify-center rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/90 px-5 py-2.5 text-right shadow-sm touch-manipulation ring-1 ring-orange-500/10">
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-700/90">
                Active queue
              </span>
              <span className="text-3xl font-black tabular-nums leading-none text-orange-950 sm:text-4xl">
                {activeOrders.length}
              </span>
            </div>
            <div className="flex min-h-[3.25rem] min-w-[8.5rem] flex-col justify-center rounded-2xl border-2 border-zinc-200 bg-white px-5 py-2.5 text-right shadow-sm touch-manipulation">
              <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-zinc-500">
                Oldest wait
              </span>
              <span className="text-3xl font-black tabular-nums leading-none text-zinc-900 sm:text-4xl">
                {oldestWaitLabel}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className={cn(
                'min-h-[3.25rem] touch-manipulation px-6 text-base font-semibold shadow-sm',
                soundEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
                  : 'border-border bg-white hover:bg-zinc-50',
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
              className="min-h-[3.25rem] touch-manipulation border-border bg-white px-6 text-base font-semibold shadow-sm hover:bg-zinc-50"
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

        {activeOrders.length === 0 ? (
          <EmptyState
            variant="dashed"
            className="mt-10 rounded-3xl border-2 border-dashed border-orange-200/70 bg-white/80 py-20 shadow-sm backdrop-blur-[2px] [&_h3]:text-3xl [&_h3]:font-black [&_p]:max-w-md [&_p]:text-base"
            decoration={<span className="mb-2 text-6xl">🍔</span>}
            title="All clear"
            description="Standing by for incoming tickets…"
          />
        ) : filteredSortedOrders.length === 0 ? (
          <EmptyState
            variant="dashed"
            className="mt-10 rounded-3xl border-2 border-dashed border-orange-200/70 bg-white/80 py-16 shadow-sm backdrop-blur-[2px] [&_h3]:text-2xl [&_h3]:font-black [&_p]:max-w-md [&_p]:text-base"
            decoration={<span className="mb-2 text-5xl">🔎</span>}
            title="Nothing in this lane"
            description="Choose another lane filter or clear the filter to see all tickets."
          />
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] sm:gap-8 xl:gap-10">
            {filteredSortedOrders.map((order) => (
              <OrderCard key={order.id} queueOrder={order} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>
    </OpsLayout>
  );
}
