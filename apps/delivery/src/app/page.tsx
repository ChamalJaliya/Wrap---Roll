'use client';

import React, { useEffect, useState } from 'react';
import { useDeliveryStore } from '../store/useDeliveryStore';
import { supabase } from '../lib/supabaseClient';
import {
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Phone,
  User,
  Power,
  Map,
} from 'lucide-react';
import {
  Button,
  EmptyState,
  OpsLayout,
  OpsHeader,
  SectionHeading,
  Input,
} from '@wrap-roll/shared-ui';
import {
  getSessionRole,
  hasAllowedStaffRole,
  useQueueDirtyStream,
  resolveApiUrl,
  getStaffAccessToken,
} from '@wrap-roll/order-kit';

export default function DeliveryDispatchPage() {
  const {
    readyOrders,
    transitOrders,
    courierStatus,
    courierId,
    staffRole,
    setCourierId,
    setAuthSub,
    setStaffRole,
    setCourierStatus,
    fetchReadyOrders,
    fetchMyTransitOrders,
    assignOrder,
    updateStatus,
    collectCash,
    collectCard,
  } = useDeliveryStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [role, setRole] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const allowed = hasAllowedStaffRole(data.session, ['COURIER', 'ADMIN']);
      setIsSignedIn(Boolean(data.session) && allowed);
      setRole(getSessionRole(data.session));
      const metadata = (data.session?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const derivedCourierId = String(metadata.courier_id ?? data.session?.user?.id ?? '');
      if (derivedCourierId) setCourierId(derivedCourierId);
      setAuthSub(data.session?.user?.id ?? null);
      setStaffRole(getSessionRole(data.session));
      if (data.session && !allowed) {
        setAuthError('This account is not permitted for Delivery. Use COURIER or ADMIN role.');
      }
      setLoading(false);
    };
    bootstrap();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const allowed = hasAllowedStaffRole(session, ['COURIER', 'ADMIN']);
      setIsSignedIn(Boolean(session) && allowed);
      setRole(getSessionRole(session));
      const metadata = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const derivedCourierId = String(metadata.courier_id ?? session?.user?.id ?? '');
      if (derivedCourierId) setCourierId(derivedCourierId);
      setAuthSub(session?.user?.id ?? null);
      setStaffRole(getSessionRole(session));
    });
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [setCourierId, setAuthSub, setStaffRole]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchReadyOrders();
    fetchMyTransitOrders();
  }, [courierId, staffRole, isSignedIn, fetchReadyOrders, fetchMyTransitOrders]);

  useQueueDirtyStream({
    enabled: isSignedIn,
    apiBaseUrl: resolveApiUrl(),
    getAccessToken: () =>
      getStaffAccessToken(async () => {
        const { data } = await supabase.auth.getSession();
        return { data };
      }),
    onDirty: () => {
      void fetchReadyOrders();
      void fetchMyTransitOrders();
    },
  });

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      setLoading(false);
      return;
    }
    if (!hasAllowedStaffRole(data.session, ['COURIER', 'ADMIN'])) {
      await supabase.auth.signOut();
      setAuthError('Signed in, but this account is not authorized for Delivery.');
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  const toggleStatus = () => {
    setCourierStatus(courierStatus === 'Active' ? 'Idle' : 'Active');
  };

  const openMap = (address: string, lat?: number | null, lng?: number | null) => {
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    const url = hasCoords
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address ?? '').trim())}`;
    if (!hasCoords && (!address || address === 'N/A')) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const orderCardClass =
    'rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(0,0,0,0.12)]';

  if (!isSignedIn) {
    return (
      <OpsLayout className="px-4 py-8 sm:px-6">
        <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-7 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
          <h1 className="text-xl font-bold text-foreground">Delivery sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use a COURIER or ADMIN account to access dispatch.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSignIn}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="delivery1@wrapnroll.com"
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
              {loading ? 'Signing in...' : 'Sign in to Delivery'}
            </Button>
          </form>
        </div>
      </OpsLayout>
    );
  }

  return (
    <OpsLayout className="px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <OpsHeader
          className="rounded-2xl border border-border/70 bg-card/95 px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
          title="Courier dashboard"
          subtitle={`Courier ID: ${courierId || 'Checking…'}${role ? ` · ${role}` : ''}`}
        >
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              variant={courierStatus === 'Active' ? 'default' : 'secondary'}
              className="flex items-center gap-2"
              onClick={toggleStatus}
            >
              <Power size={16} /> {courierStatus}
            </Button>
            <Button type="button" variant="outline" onClick={handleSignOut} disabled={loading}>
              Sign out
            </Button>
          </div>
        </OpsHeader>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <section className="space-y-4">
            <SectionHeading icon={Package}>
              Ready for pickup ({readyOrders.length})
            </SectionHeading>
            <div className="flex flex-col gap-4">
              {readyOrders.length > 0 ? (
                readyOrders.map((order) => (
                  <div key={order.id} className={orderCardClass}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-bold text-primary">{order.orderNumber}</span>
                      <span className="text-sm font-semibold text-foreground">
                        LKR {order.total_amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User size={14} /> {order.customerName}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} /> {order.customerAddress}
                      </div>
                      <div className="flex items-center gap-2">
                        <Package size={14} /> {order.items_count} items
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck size={14} />
                        {order.deliveryDistanceKm != null
                          ? `${order.deliveryDistanceKm.toFixed(1)} km`
                          : 'Distance pending'}
                        {order.deliveryFee != null ? ` · Fee LKR ${order.deliveryFee.toFixed(0)}` : ''}
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        type="button"
                        className="w-full"
                        disabled={courierStatus !== 'Active'}
                        onClick={() => assignOrder(order.id)}
                      >
                        Assign to me
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  className="rounded-2xl border border-border/60 bg-card/60 py-12 shadow-sm"
                  icon={Package}
                  title="No orders ready"
                  description="Nothing waiting for pickup right now."
                />
              )}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading icon={Truck}>
              In transit ({transitOrders.length})
            </SectionHeading>
            <div className="flex flex-col gap-4">
              {transitOrders.length > 0 ? (
                transitOrders.map((order) => (
                  <div key={order.id} className={orderCardClass}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-bold text-foreground">{order.orderNumber}</span>
                      <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                        EN ROUTE
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User size={14} /> {order.customerName}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} /> {order.customerAddress}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} /> {order.customerPhone}
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck size={14} />
                        {order.deliveryDistanceKm != null
                          ? `${order.deliveryDistanceKm.toFixed(1)} km`
                          : 'Distance pending'}
                        {order.deliveryFee != null ? ` · Fee LKR ${order.deliveryFee.toFixed(0)}` : ''}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {order.deliveryDistanceKm != null && order.deliveryDistanceKm >= 8 ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            Far delivery
                          </span>
                        ) : null}
                        {order.deliveryDistanceKm != null &&
                        order.deliveryDistanceKm >= 0 &&
                        order.deliveryDistanceKm < 0.4 ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            Boundary address
                          </span>
                        ) : null}
                        {!order.deliveryLatitude || !order.deliveryLongitude ? (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            No precise pin
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {order.paymentStatus !== 'completed' ? (
                      <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Payment collection
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full min-w-0"
                            onClick={() => collectCash(order.id, order.total_amount)}
                          >
                            Collect cash
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full min-w-0"
                            onClick={() => collectCard(order.id)}
                          >
                            Collect card
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() =>
                          openMap(order.customerAddress, order.deliveryLatitude, order.deliveryLongitude)
                        }
                        disabled={
                          (!order.customerAddress || order.customerAddress === 'N/A') &&
                          (!order.deliveryLatitude || !order.deliveryLongitude)
                        }
                      >
                        <Map size={16} /> Map
                      </Button>
                      <Button
                        type="button"
                        className="w-full gap-2"
                        disabled={order.paymentStatus !== 'completed'}
                        title={
                          order.paymentStatus !== 'completed'
                            ? 'Record payment with Collect cash or Collect card first'
                            : undefined
                        }
                        onClick={() => updateStatus(order.id, 'delivered')}
                      >
                        <CheckCircle size={16} /> Delivered
                      </Button>
                    </div>
                    {order.paymentStatus !== 'completed' ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Record payment with Collect cash or card before marking delivered.
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  className="rounded-2xl border border-border/60 bg-card/60 py-12 shadow-sm"
                  icon={Truck}
                  title="No active deliveries"
                  description="You have no orders in transit."
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </OpsLayout>
  );
}
