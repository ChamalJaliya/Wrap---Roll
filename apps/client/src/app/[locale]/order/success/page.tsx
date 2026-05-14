'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { CheckCircle2, PartyPopper } from 'lucide-react';
import { OrderService } from '@/services/api';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@wrap-roll/shared-ui';
import { buildCashierResolveOrderUrl, type OrderStatus } from '@wrap-roll/contracts';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import {
  buildStatusFlow,
  getFulfillmentLabel,
  getOrderStateSummary,
  getPaymentCollectionLabel,
  getStepDescription,
  isDeferredPaymentCollection,
  normalizeFulfillmentType,
  STATUS_STEP_CONTENT,
} from '@/lib/client-order-tracking-contract';
import {
  clientAccountStackClass,
  clientContentWideClass,
  clientElevatedCardClass,
  clientElevatedCardHeaderClass,
  clientHeroGradientOrbClass,
  clientHeroGradientOrbSecondaryClass,
  clientHeroGradientShellClass,
  clientPageShellClass,
  clientPrimaryCtaClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';

function maskCustomerEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf('@');
  if (at <= 1) return 'your email';
  return `${e[0]}***${e.slice(at)}`;
}

function OrderTracking() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>('placed');
  const [trackError, setTrackError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentCollection, setPaymentCollection] = useState<string>('');
  const [fulfillmentType, setFulfillmentType] = useState<string>('');
  const [statusUpdatedAt, setStatusUpdatedAt] = useState<string>('');
  const [estimatedReadyTime, setEstimatedReadyTime] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [deliveryGeoSource, setDeliveryGeoSource] = useState<string>('');
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [receiptEmail, setReceiptEmail] = useState('');

  useEffect(() => {
    if (!orderId || typeof window === 'undefined') return;
    const sid = localStorage.getItem('last_order_id');
    const em = localStorage.getItem('last_order_email');
    if (sid === orderId && em && em.includes('@')) {
      setReceiptEmail(em.trim());
    } else {
      setReceiptEmail('');
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const phone =
      typeof window !== 'undefined' ? localStorage.getItem('last_order_phone') : '';
    if (!phone) {
      setTrackError('Phone verification missing. Please use Track Order.');
      return;
    }
    const poll = async () => {
      try {
        const data = await OrderService.trackOrder(orderId, phone);
        setCurrentStatus(data.status as OrderStatus);
        setPaymentMethod(String(data.paymentMethod ?? '').toUpperCase());
        setPaymentStatus(String(data.paymentStatus ?? '').toUpperCase());
        setPaymentCollection(String(data.paymentCollection ?? ''));
        setFulfillmentType(String(data.fulfillmentType ?? '').toLowerCase());
        setStatusUpdatedAt(String(data.updatedAt ?? ''));
        setEstimatedReadyTime(String(data.estimatedReadyTime ?? ''));
        setDeliveryAddress(String(data.deliveryAddress ?? ''));
        const dkm = Number(data.deliveryDistanceKm);
        setDeliveryDistanceKm(Number.isFinite(dkm) ? dkm : null);
        const fee = Number(data.deliveryFee);
        setDeliveryFee(Number.isFinite(fee) ? fee : null);
        setDeliveryGeoSource(String(data.deliveryGeoSource ?? ''));
        setTrackError('');
      } catch (e: unknown) {
        const errorObj = e as { response?: { data?: { message?: string } }; message?: string };
        setTrackError(
          String(
            errorObj?.response?.data?.message ??
              errorObj?.message ??
              'Unable to fetch latest order status',
          ),
        );
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const normalizedFulfillmentType = normalizeFulfillmentType(fulfillmentType);
  const isDeferredCollection = isDeferredPaymentCollection({
    paymentCollection,
    paymentMethod,
    paymentStatus,
  });
  const paymentCollectionLabel = getPaymentCollectionLabel(paymentCollection, isDeferredCollection);
  const fulfillmentLabel = getFulfillmentLabel(normalizedFulfillmentType);
  const paymentDone = paymentStatus.toLowerCase() === 'completed';
  const receiptEmailLine =
    receiptEmail && paymentDone
      ? `Check your inbox (and spam) for your receipt at ${maskCustomerEmail(receiptEmail)}.`
      : receiptEmail
        ? `We’ll email your receipt to ${maskCustomerEmail(receiptEmail)} when payment is confirmed.`
        : '';
  const statusFlow = buildStatusFlow({
    fulfillmentType: normalizedFulfillmentType,
    isDeferredCollection,
    currentStatus,
  });
  const statusSteps = statusFlow
    .filter(
      (
        status,
      ): status is Extract<
        OrderStatus,
        'placed' | 'paid' | 'in_kitchen' | 'ready' | 'in_transit' | 'delivered'
      > => status in STATUS_STEP_CONTENT,
    )
    .map((status) => ({
      status,
      label: STATUS_STEP_CONTENT[status].label,
      description: STATUS_STEP_CONTENT[status].description,
    }));
  const activeIndex = statusSteps.findIndex((s) => s.status === currentStatus);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const progressPercentage =
    statusSteps.length > 1 ? (safeActiveIndex / (statusSteps.length - 1)) * 100 : 0;

  const orderStateSummary = getOrderStateSummary(currentStatus, normalizedFulfillmentType);
  const cashierPublicOrigin =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CASHIER_APP_URL?.trim()) ||
    'http://localhost:3002';
  const staffHandoffUrl =
    orderId && !trackError ? buildCashierResolveOrderUrl(cashierPublicOrigin, orderId) : '';
  const showCounterHandoff = Boolean(orderId && !trackError && staffHandoffUrl);
  const counterHandoffHeading = 'Cashier lookup';
  const counterHandoffBody =
    'Staff can scan this QR in the POS to open your order. You can also copy the link or order ID.';

  const copyToClipboard = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${label} copied`);
      window.setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint('Could not copy — select and copy manually');
      window.setTimeout(() => setCopyHint(null), 3000);
    }
  };

  const isCompletedState = currentStatus === 'delivered';
  const completedTimeLabel =
    isCompletedState && statusUpdatedAt ? new Date(statusUpdatedAt).toLocaleString() : '';

  const pageShell = cn(clientPageShellClass, 'overflow-hidden');

  if (!orderId) {
    return (
      <div className={pageShell}>
        <div className={clientContentWideClass}>
          <div className={clientAccountStackClass}>
            <header className={clientHeroGradientShellClass}>
              <div className={clientHeroGradientOrbClass} aria-hidden />
              <div className={clientHeroGradientOrbSecondaryClass} aria-hidden />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">
                  Order status
                </p>
                <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
                  No order linked
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
                  Open this page from your confirmation link or paste your order ID on Track order.
                </p>
              </div>
            </header>
            <Card className={cn(clientElevatedCardClass, 'mx-auto max-w-lg')}>
              <CardContent className="flex flex-col gap-4 px-6 py-8 sm:px-8">
                <p className="text-sm text-muted-foreground">
                  We could not read an order ID in the URL. Use track order if you have your reference
                  and phone handy.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className={cn(clientPrimaryCtaClass, 'rounded-full')}
                    onClick={() => router.push(`/${locale}/order/track`)}
                  >
                    Track order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full px-6"
                    onClick={() => router.push(`/${locale}`)}
                  >
                    Back to menu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <header className={clientHeroGradientShellClass}>
            <div className={clientHeroGradientOrbClass} aria-hidden />
            <div className={clientHeroGradientOrbSecondaryClass} aria-hidden />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">
                  Live order status
                </p>
                <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                  <span>Thank you</span>
                  <PartyPopper className="h-9 w-9 shrink-0 text-amber-200/90 sm:h-10 sm:w-10" aria-hidden />
                </h1>
                <p className="mt-4 text-sm leading-relaxed text-white/80 sm:text-base">
                  Your order{' '}
                  <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[0.8125rem] font-semibold text-white tabular-nums">
                    #{orderId.slice(0, 8)}
                  </span>{' '}
                  {orderStateSummary}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  Tell staff your <strong className="text-white/90">name</strong>,{' '}
                  <strong className="text-white/90">phone</strong>, or{' '}
                  <strong className="text-white/90">order reference</strong> — or show this screen for
                  counter lookup.
                </p>
                {trackError ? (
                  <p
                    className="mt-4 rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-100"
                    role="alert"
                  >
                    {trackError}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center justify-center lg:pt-1">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm sm:h-24 sm:w-24">
                  <CheckCircle2 className="h-10 w-10 text-emerald-300 sm:h-12 sm:w-12" aria-hidden />
                </div>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="space-y-6 lg:col-span-7">
              <Card className={clientElevatedCardClass}>
                <CardHeader className={clientElevatedCardHeaderClass}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">
                    Payment
                  </p>
                  <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
                    Payment & fulfillment
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    How you paid and how your order is being fulfilled.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 px-6 py-6 sm:px-8 sm:py-8">
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50/80 px-4 py-3 sm:px-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      Method / status
                    </p>
                    <p className="mt-1 text-sm font-bold text-neutral-900">
                      {paymentMethod || 'N/A'} / {paymentStatus || 'PENDING'}
                    </p>
                    <p className="mt-1 text-xs text-neutral-600">{paymentCollectionLabel}</p>
                    <p className="mt-2 text-xs font-semibold text-neutral-700">
                      Fulfillment: {fulfillmentLabel}
                    </p>
                    {receiptEmailLine ? (
                      <p className="mt-2 border-t border-neutral-200/80 pt-2 text-xs leading-relaxed text-neutral-600">
                        {receiptEmailLine}
                      </p>
                    ) : null}
                    {completedTimeLabel ? (
                      <p className="mt-1 text-xs text-neutral-500">Completed at: {completedTimeLabel}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {normalizedFulfillmentType === 'delivery' ? (
                <Card className={clientElevatedCardClass}>
                  <CardHeader className={clientElevatedCardHeaderClass}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">
                      Delivery
                    </p>
                    <CardTitle
                      className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}
                    >
                      Delivery details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-6 py-6 sm:px-8 sm:py-8">
                    <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3 sm:px-5">
                      <p className="text-sm font-bold text-neutral-900">
                        Delivery fee (locked):{' '}
                        {deliveryFee != null ? `LKR ${deliveryFee.toLocaleString()}` : 'N/A'}
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        Distance:{' '}
                        {deliveryDistanceKm != null ? `${deliveryDistanceKm.toFixed(1)} km` : 'N/A'}
                      </p>
                      {deliveryAddress ? (
                        <p className="mt-1 text-xs text-neutral-700">Address: {deliveryAddress}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-neutral-500">
                        Source: {deliveryGeoSource || 'checkout location'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card className={clientElevatedCardClass}>
                <CardHeader className={clientElevatedCardHeaderClass}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">
                    Progress
                  </p>
                  <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
                    Order journey
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Status refreshes every 10 seconds.</p>
                </CardHeader>
                <CardContent className="px-6 pb-8 pt-2 sm:px-8">
                  <div className="relative mt-2 flex flex-col gap-6 pl-1">
                    <div
                      className="absolute left-[15px] top-4 z-[1] w-0.5 bg-neutral-200"
                      style={{ height: 'calc(100% - 2rem)' }}
                      aria-hidden
                    />
                    <div
                      className="absolute left-[15px] top-4 z-[1] w-0.5 bg-primary transition-[height] duration-1000 ease-out"
                      style={{
                        height:
                          progressPercentage > 0 ? `calc(${progressPercentage}% - 8px)` : '0px',
                      }}
                      aria-hidden
                    />

                    {statusSteps.map((step, index) => {
                      const isPast = index < safeActiveIndex;
                      const isActive = index === safeActiveIndex;
                      const isFuture = index > safeActiveIndex;
                      const stepDescription = getStepDescription({
                        stepStatus: step.status,
                        isDeferredCollection,
                        paymentCollection,
                        fulfillmentType: normalizedFulfillmentType,
                        estimatedReadyTime,
                        currentStatus,
                      });

                      return (
                        <div
                          key={step.status}
                          className={cn(
                            'relative flex items-center gap-4 transition-opacity duration-500',
                            isFuture && 'opacity-30',
                            (isActive || isPast) && 'opacity-100',
                          )}
                        >
                          <div
                            className={cn(
                              'relative z-[2] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-all duration-500',
                              isActive &&
                                'scale-110 bg-primary text-primary-foreground shadow-[0_0_15px_hsla(14,100%,57%,0.3)] animate-step-indicator-pulse',
                              isPast && 'bg-emerald-500 text-white',
                              isFuture && 'bg-neutral-200 text-neutral-600',
                            )}
                          >
                            {isPast ? '✓' : index + 1}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="font-bold text-neutral-900">{step.label}</span>
                            <span className="text-xs text-neutral-500">
                              {isActive ? stepDescription : isPast ? 'Completed' : 'Upcoming'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 lg:col-span-5">
              {showCounterHandoff ? (
                <Card
                  className={cn(
                    clientElevatedCardClass,
                    'border-amber-200/60 ring-amber-500/[0.06]',
                  )}
                >
                  <CardHeader className="border-b border-amber-100/80 bg-gradient-to-r from-amber-50/90 to-orange-50/50 px-6 py-5 sm:px-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800/90">
                      {counterHandoffHeading}
                    </p>
                    <CardTitle
                      className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}
                    >
                      Show at the counter
                    </CardTitle>
                    <p className="mt-1 text-sm text-neutral-700">{counterHandoffBody}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4 px-6 py-8 sm:px-8">
                    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-inner">
                      <QRCodeSVG value={staffHandoffUrl} size={200} level="M" />
                    </div>
                    <div className="flex w-full flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyToClipboard('Counter link', staffHandoffUrl)}
                      >
                        Copy staff link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyToClipboard('Order ID', orderId)}
                      >
                        Copy full order ID
                      </Button>
                    </div>
                    {copyHint ? (
                      <p className="text-center text-xs font-medium text-emerald-700">{copyHint}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card className={clientElevatedCardClass}>
                <CardHeader className={clientElevatedCardHeaderClass}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">
                    Next steps
                  </p>
                  <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
                    Hungry for more?
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track another reference or jump back to the menu.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 px-6 py-6 sm:px-8 sm:py-8">
                  <Button
                    type="button"
                    className={cn(clientPrimaryCtaClass, 'w-full rounded-full')}
                    onClick={() => router.push(`/${locale}/order/track`)}
                  >
                    Track another order
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-full border-neutral-200 font-semibold"
                    onClick={() => router.push(`/${locale}`)}
                  >
                    Order something else
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessPageSkeleton() {
  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <div
            className="relative h-52 animate-pulse overflow-hidden rounded-3xl border border-neutral-200/60 bg-gradient-to-br from-neutral-800 to-neutral-900 sm:h-60"
            aria-hidden
          />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="h-64 animate-pulse rounded-3xl border border-neutral-200/80 bg-neutral-100/80 lg:col-span-7" />
            <div className="h-72 animate-pulse rounded-3xl border border-neutral-200/80 bg-neutral-100/80 lg:col-span-5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<SuccessPageSkeleton />}>
      <OrderTracking />
    </Suspense>
  );
}
