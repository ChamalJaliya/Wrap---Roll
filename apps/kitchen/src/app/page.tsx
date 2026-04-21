'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKdsStore } from '../store/useKdsStore';
import { OrderCard } from '../components/OrderCard';
import { supabase } from '../lib/supabaseClient';
import { OrderStatus, type KitchenQueueOrder, type QueueOrder } from '@wrap-roll/contracts';
import { Button, EmptyState, Input, OpsHeader, OpsLayout } from '@wrap-roll/shared-ui';
import {
  staffFetchJson,
  getStaffAccessToken,
  hasAllowedStaffRole,
  getSessionRole,
  useQueueDirtyStream,
  resolveApiUrl,
} from '@wrap-roll/order-kit';

export default function KdsPage() {
  const { activeOrders, setOrders, updateOrderStatus } = useKdsStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const isSignedIn = useMemo(() => Boolean(sessionToken), [sessionToken]);

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
    <OpsLayout className="px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <OpsHeader
          accentBorder
          className="rounded-2xl border border-border/70 bg-card/95 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
          title="Kitchen Display System (KDS)"
          subtitle={
            <>
              Queueing orders for status: <strong>ELIGIBLE | IN_KITCHEN</strong>
              {role ? (
                <span className="ml-2 text-xs text-muted-foreground">Signed in as {role}</span>
              ) : null}
            </>
          }
        >
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <div className="rounded-xl border border-border/80 bg-background/70 px-4 py-2 text-right shadow-sm">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                Active queue
              </span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {activeOrders.length}
              </span>
            </div>
            <Button type="button" variant="outline" onClick={handleSignOut} disabled={loading}>
              Sign out
            </Button>
          </div>
        </OpsHeader>

        {activeOrders.length === 0 ? (
          <EmptyState
            variant="dashed"
            className="mt-8 rounded-2xl border border-border/60 bg-card/60 py-16 shadow-sm"
            decoration={<span className="mb-2 text-5xl">🍔</span>}
            title="All orders cleared!"
            description="Standing by for incoming tickets…"
          />
        ) : (
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                queueOrder={order}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </OpsLayout>
  );
}
