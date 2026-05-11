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
  MessageCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
    deliveredOrders,
    pendingActionByOrder,
    pendingQueueCount,
    courierStatus,
    courierId,
    staffRole,
    setCourierId,
    setAuthSub,
    setStaffRole,
    setCourierStatus,
    fetchReadyOrders,
    fetchMyTransitOrders,
    fetchDeliveredOrders,
    assignOrder,
    updateStatus,
    collectCash,
    collectCard,
    reportDeliveryAttempt,
    handoverDelivery,
    flushPendingActions,
  } = useDeliveryStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [role, setRole] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [deliveryChecksByOrder, setDeliveryChecksByOrder] = useState<Record<string, boolean>>({});
  const [compactMode, setCompactMode] = useState(false);
  const [failedAttemptByOrder, setFailedAttemptByOrder] = useState<Record<string, string>>({});
  const [cashModalOrderId, setCashModalOrderId] = useState<string | null>(null);
  const [cashModalTender, setCashModalTender] = useState('');

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
    fetchDeliveredOrders();
    void flushPendingActions();
  }, [
    courierId,
    staffRole,
    isSignedIn,
    fetchReadyOrders,
    fetchMyTransitOrders,
    fetchDeliveredOrders,
    flushPendingActions,
  ]);

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
      void fetchDeliveredOrders();
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
    'rounded-3xl border border-white/70 bg-gradient-to-b from-white/95 to-zinc-50/85 p-4 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-24px_rgba(0,0,0,0.4)]';

  const toggleDeliveryCheck = (orderId: string) => {
    setDeliveryChecksByOrder((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const getEtaRisk = (order: (typeof transitOrders)[number]): 'on_time' | 'tight' | 'late' => {
    const placedRaw = (order as { placedAt?: string | Date }).placedAt;
    if (!placedRaw) return 'on_time';
    const placedMs = new Date(String(placedRaw)).getTime();
    if (!Number.isFinite(placedMs)) return 'on_time';
    const ageMin = Math.floor((Date.now() - placedMs) / 60000);
    if (ageMin >= 55) return 'late';
    if (ageMin >= 40) return 'tight';
    return 'on_time';
  };

  const sortedReadyOrders = [...readyOrders].sort((a, b) => {
    const ad = Number(a.deliveryDistanceKm ?? 999);
    const bd = Number(b.deliveryDistanceKm ?? 999);
    if (ad !== bd) return ad - bd;
    return a.total_amount - b.total_amount;
  });

  const sortedTransitOrders = [...transitOrders].sort((a, b) => {
    const ar = getEtaRisk(a);
    const br = getEtaRisk(b);
    const score = { late: 3, tight: 2, on_time: 1 } as const;
    if (score[br] !== score[ar]) return score[br] - score[ar];
    return Number(a.deliveryDistanceKm ?? 999) - Number(b.deliveryDistanceKm ?? 999);
  });

  const todayDeliveredCount = deliveredOrders.length;
  const todayDeliveredRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const todayPendingCollectionCount = transitOrders.filter(
    (order) => order.paymentStatus !== 'completed',
  ).length;
  const todayPendingCollectionValue = transitOrders
    .filter((order) => order.paymentStatus !== 'completed')
    .reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

  const handleFailedAttempt = (orderId: string) => {
    const reason = window.prompt(
      'Reason for failed attempt?\nExamples: customer unreachable, no answer, wrong address',
    );
    if (!reason || reason.trim().length < 3) return;
    const trimmed = reason.trim();
    setFailedAttemptByOrder((prev) => ({ ...prev, [orderId]: trimmed }));
    void reportDeliveryAttempt(orderId, trimmed);
  };

  const handleHandover = (orderId: string) => {
    const reason = window.prompt('Reason for handover? (required)');
    if (!reason || reason.trim().length < 3) return;
    void handoverDelivery(orderId, undefined, reason.trim());
  };

  const openDialer = (phone: string) => {
    const clean = String(phone ?? '').trim();
    if (!clean || clean === 'N/A') return;
    window.open(`tel:${clean}`, '_self');
  };

  const openWhatsApp = (phone: string, msg: string) => {
    const clean = String(phone ?? '').replace(/[^\d+]/g, '');
    if (!clean) return;
    window.open(
      `https://wa.me/${encodeURIComponent(clean)}?text=${encodeURIComponent(msg)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const openCashModal = (orderId: string, total: number) => {
    setCashModalOrderId(orderId);
    setCashModalTender(total.toFixed(2));
  };

  const cashModalOrder =
    cashModalOrderId == null ? null : sortedTransitOrders.find((o) => o.id === cashModalOrderId) ?? null;
  const cashDue = Number(cashModalOrder?.total_amount ?? 0);
  const cashTenderValue = Number(cashModalTender);
  const hasValidTender = Number.isFinite(cashTenderValue) && cashTenderValue >= cashDue;
  const cashChange = hasValidTender ? Math.max(0, cashTenderValue - cashDue) : 0;

  const confirmCashCollection = () => {
    if (!cashModalOrder) return;
    const note = hasValidTender
      ? `Cash collected by courier at doorstep · Tender Rs ${cashTenderValue.toFixed(2)} · Change Rs ${cashChange.toFixed(2)}`
      : 'Cash collected by courier at doorstep';
    void collectCash(cashModalOrder.id, cashModalOrder.total_amount, note);
    setCashModalOrderId(null);
  };

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
    <OpsLayout className="bg-gradient-to-b from-orange-50/55 via-zinc-50 to-zinc-100/80 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <OpsHeader
          className="rounded-3xl border border-white/70 bg-gradient-to-r from-white/95 via-orange-50/70 to-white/95 px-5 py-5 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.3)] ring-1 ring-orange-200/50"
          title="Courier dashboard"
          subtitle={`Courier ID: ${courierId || 'Checking…'}${role ? ` · ${role}` : ''}`}
        >
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              variant={courierStatus === 'Active' ? 'default' : 'secondary'}
              className="flex items-center gap-2 rounded-xl shadow-sm"
              onClick={toggleStatus}
            >
              <Power size={16} /> {courierStatus}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCompactMode((v) => !v)}>
              {compactMode ? 'Expanded' : 'Compact'} mode
            </Button>
            <Button type="button" variant="outline" onClick={() => void flushPendingActions()}>
              <RefreshCw size={14} className="mr-1" />
              Sync queued {pendingQueueCount > 0 ? `(${pendingQueueCount})` : ''}
            </Button>
            <Button type="button" variant="outline" onClick={handleSignOut} disabled={loading}>
              Sign out
            </Button>
          </div>
        </OpsHeader>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Delivered today
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-zinc-900">{todayDeliveredCount}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Delivered revenue
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-700">
              LKR {todayDeliveredRevenue.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Pending collections
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-700">
              {todayPendingCollectionCount}
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Pending value
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-700">
              LKR {todayPendingCollectionValue.toFixed(2)}
            </p>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <section className="space-y-4 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60 sm:p-5">
            <SectionHeading icon={Package}>
              Ready for pickup ({readyOrders.length})
            </SectionHeading>
            <div className="flex flex-col gap-4">
              {sortedReadyOrders.length > 0 ? (
                sortedReadyOrders.map((order) => (
                  <div key={order.id} className={orderCardClass}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black tracking-wide text-orange-600">{order.orderNumber}</span>
                        <span
                          className={
                            order.paymentStatus === 'completed'
                              ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-emerald-800'
                              : 'rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-800'
                          }
                        >
                          {order.paymentStatus === 'completed' ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">LKR {order.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User size={14} /> {order.customerName}
                      </div>
                      {compactMode ? null : (
                        <div className="flex items-center gap-2">
                          <Phone size={14} /> {order.customerPhone}
                        </div>
                      )}
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
                        className="w-full rounded-xl"
                        disabled={courierStatus !== 'Active' || Boolean(pendingActionByOrder[order.id])}
                        onClick={() => assignOrder(order.id)}
                      >
                        {pendingActionByOrder[order.id] === 'assigning' ? 'Assigning…' : 'Assign to me'}
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-1 rounded-xl"
                        onClick={() =>
                          openWhatsApp(
                            order.customerPhone,
                            `Hi ${order.customerName}, your Wrap & Roll order ${order.orderNumber} is ready for dispatch.`,
                          )
                        }
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-1 rounded-xl"
                        onClick={() => openDialer(order.customerPhone)}
                      >
                        <Phone size={14} /> Call
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  className="rounded-2xl border border-zinc-200/70 bg-white/80 py-12 shadow-sm"
                  icon={Package}
                  title="No orders ready"
                  description="Nothing waiting for pickup right now."
                />
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60 sm:p-5">
            <SectionHeading icon={Truck}>
              In transit ({transitOrders.length})
            </SectionHeading>
            <div className="flex flex-col gap-4">
              {sortedTransitOrders.length > 0 ? (
                sortedTransitOrders.map((order) => (
                  <div key={order.id} className={orderCardClass}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black tracking-wide text-zinc-900">{order.orderNumber}</span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-900">
                          En route
                        </span>
                        <span
                          className={
                            order.paymentStatus === 'completed'
                              ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-emerald-800'
                              : 'rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-800'
                          }
                        >
                          {order.paymentStatus === 'completed' ? 'Paid' : 'Pending'}
                        </span>
                        <span
                          className={
                            getEtaRisk(order) === 'late'
                              ? 'rounded-full bg-red-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-red-800'
                              : getEtaRisk(order) === 'tight'
                                ? 'rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-800'
                                : 'rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-emerald-800'
                          }
                        >
                          {getEtaRisk(order) === 'late'
                            ? 'Late risk'
                            : getEtaRisk(order) === 'tight'
                              ? 'Tight'
                              : 'On time'}
                        </span>
                      </div>
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
                      {failedAttemptByOrder[order.id] ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                          Retry needed: {failedAttemptByOrder[order.id]}
                        </div>
                      ) : null}
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
                      <div className="mt-4 rounded-2xl border border-zinc-200/80 bg-white/90 p-3 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)]">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Payment collection
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full min-w-0 rounded-xl"
                            disabled={Boolean(pendingActionByOrder[order.id])}
                            onClick={() => openCashModal(order.id, order.total_amount)}
                          >
                            {pendingActionByOrder[order.id] === 'collecting_cash'
                              ? 'Recording cash…'
                              : 'Collect cash (change)'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full min-w-0 rounded-xl"
                            disabled={Boolean(pendingActionByOrder[order.id])}
                            onClick={() => collectCard(order.id)}
                          >
                            {pendingActionByOrder[order.id] === 'collecting_card'
                              ? 'Recording card…'
                              : 'Collect card (terminal)'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-[0_8px_20px_-16px_rgba(5,150,105,0.55)]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          Payment complete
                        </p>
                        <p className="mt-1 text-sm font-medium text-emerald-900">
                          {String(order.paymentMethod ?? '').toUpperCase()} confirmed
                        </p>
                      </div>
                    )}
                    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-200/80 bg-white/90 p-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={Boolean(deliveryChecksByOrder[order.id])}
                        onChange={() => toggleDeliveryCheck(order.id)}
                      />
                      <span className="text-xs font-medium text-muted-foreground">
                        I confirmed handoff to customer (or authorized receiver).
                      </span>
                    </label>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2 rounded-xl"
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
                        className="w-full gap-2 rounded-xl"
                        disabled={
                          order.paymentStatus !== 'completed' ||
                          !deliveryChecksByOrder[order.id] ||
                          Boolean(pendingActionByOrder[order.id])
                        }
                        title={
                          order.paymentStatus !== 'completed'
                            ? 'Record payment with Collect cash or Collect card (terminal) first'
                            : !deliveryChecksByOrder[order.id]
                              ? 'Confirm customer handoff first'
                            : undefined
                        }
                        onClick={() => updateStatus(order.id, 'delivered')}
                      >
                        <CheckCircle size={16} />{' '}
                        {pendingActionByOrder[order.id] === 'delivering'
                          ? 'Marking delivered…'
                          : 'Delivered'}
                      </Button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-1 rounded-xl"
                        onClick={() =>
                          openWhatsApp(
                            order.customerPhone,
                            `Hi ${order.customerName}, your Wrap & Roll order is on the way. I am arriving shortly.`,
                          )
                        }
                      >
                        <MessageCircle size={14} /> Notify
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-1 rounded-xl"
                        onClick={() => openDialer(order.customerPhone)}
                      >
                        <Phone size={14} /> Call
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-1 rounded-xl text-amber-900"
                        onClick={() => handleFailedAttempt(order.id)}
                      >
                        <AlertTriangle size={14} /> Retry
                      </Button>
                    </div>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl text-zinc-700"
                        onClick={() => handleHandover(order.id)}
                      >
                        Handover to queue
                      </Button>
                    </div>
                    {order.paymentStatus !== 'completed' || !deliveryChecksByOrder[order.id] ? (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        {order.paymentStatus !== 'completed'
                          ? 'Record payment before marking delivered.'
                          : 'Tick handoff confirmation before marking delivered.'}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  className="rounded-2xl border border-zinc-200/70 bg-white/80 py-12 shadow-sm"
                  icon={Truck}
                  title="No active deliveries"
                  description="You have no orders in transit."
                />
              )}
            </div>
          </section>
        </div>
        <section className="mt-8 space-y-4 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60 sm:p-5">
          <SectionHeading icon={CheckCircle}>Delivered today ({deliveredOrders.length})</SectionHeading>
          {deliveredOrders.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {deliveredOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.35)] ring-1 ring-zinc-200/60"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-black tracking-wide text-zinc-900">{order.orderNumber}</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-emerald-800">
                      Delivered
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <User size={13} /> {order.customerName}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone size={13} /> {order.customerPhone}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin size={13} /> {order.customerAddress}
                    </p>
                    <p className="font-semibold text-zinc-800">Total LKR {order.total_amount.toFixed(2)}</p>
                    <p>
                      Payment:{' '}
                      <span
                        className={
                          order.paymentStatus === 'completed'
                            ? 'font-semibold text-emerald-700'
                            : 'font-semibold text-amber-700'
                        }
                      >
                        {order.paymentStatus === 'completed' ? 'Paid' : 'Pending'}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              className="rounded-2xl border border-zinc-200/70 bg-white/80 py-10 shadow-sm"
              icon={CheckCircle}
              title="No delivered orders yet"
              description="Delivered history for today will appear here."
            />
          )}
        </section>
      </div>
      <Dialog open={cashModalOrderId != null} onOpenChange={(open) => !open && setCashModalOrderId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cash collection and change</DialogTitle>
            <DialogDescription>
              Confirm tender amount for order {cashModalOrder?.orderNumber ?? '—'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-semibold text-zinc-700">Amount due</p>
              <p className="text-2xl font-black text-zinc-900">LKR {cashDue.toFixed(2)}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">
                Tender received
              </label>
              <Input
                type="number"
                min={cashDue}
                step="0.01"
                value={cashModalTender}
                onChange={(e) => setCashModalTender(e.target.value)}
                placeholder={`Min ${cashDue.toFixed(2)}`}
              />
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-semibold text-emerald-800">Change to return</p>
              <p className="text-xl font-black text-emerald-900">
                LKR {hasValidTender ? cashChange.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashModalOrderId(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmCashCollection}
              disabled={
                !cashModalOrder ||
                !hasValidTender ||
                Boolean(cashModalOrderId && pendingActionByOrder[cashModalOrderId])
              }
            >
              Confirm cash received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OpsLayout>
  );
}
