'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { OrderService } from '@/services/api';
import { Button } from '@wrap-roll/shared-ui';
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
  clientDisplayHeadingSolidLgClass,
  clientGlassPanelFlatClass,
  clientPageShellClass,
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
    statusSteps.length > 1
      ? (safeActiveIndex / (statusSteps.length - 1)) * 100
      : 0;

  const shell = cn(
    clientPageShellClass,
    'flex items-center justify-center px-4 py-12 font-sans',
  );
  const orderStateSummary = getOrderStateSummary(currentStatus, normalizedFulfillmentType);
  const cashierPublicOrigin =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CASHIER_APP_URL?.trim()) ||
    'http://localhost:3002';
  const staffHandoffUrl =
    orderId && !trackError ? buildCashierResolveOrderUrl(cashierPublicOrigin, orderId) : '';
  /** Staff QR for easy POS lookup — any fulfillment type. */
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
    isCompletedState && statusUpdatedAt
      ? new Date(statusUpdatedAt).toLocaleString()
      : '';

  if (!orderId) {
    return (
      <div className={shell}>
        <div className="w-full max-w-xl text-center">
          <h1 className={cn(clientDisplayHeadingSolidLgClass, 'mb-4')}>
            Order Not Found
          </h1>
          <Button variant="default" onClick={() => router.push('/')}>
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="w-full max-w-xl text-center">
        <header className="mb-12">
          <h1 className={cn(clientDisplayHeadingSolidLgClass, 'mb-2')}>
            Thank You! 🌯
          </h1>
          <p className="text-neutral-600">
            Your order{' '}
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-sm">
              #{orderId.slice(0, 8)}
            </span>{' '}
            {orderStateSummary}
          </p>
          <p className="mt-3 text-sm text-neutral-600">
            Tell staff your <strong>name</strong>, <strong>phone</strong>, or <strong>order reference</strong> above,
            or show this screen — they can look up your order at the counter.
          </p>
        </header>

        <main className={cn(clientGlassPanelFlatClass, 'text-left')}>
          <div className="mb-6 rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Payment
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {paymentMethod || 'N/A'} / {paymentStatus || 'PENDING'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{paymentCollectionLabel}</p>
            <p className="mt-1 text-xs font-medium text-neutral-600">
              Fulfillment: {fulfillmentLabel}
            </p>
            {receiptEmailLine ? (
              <p className="mt-2 text-xs leading-relaxed text-neutral-600">{receiptEmailLine}</p>
            ) : null}
            {completedTimeLabel ? (
              <p className="mt-1 text-xs text-neutral-500">
                Completed at: {completedTimeLabel}
              </p>
            ) : null}
          </div>
          {normalizedFulfillmentType === 'delivery' ? (
            <div className="mb-6 rounded-xl border border-primary/30 bg-[hsl(var(--primary)/0.06)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Delivery details
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                Delivery fee (locked):{' '}
                {deliveryFee != null ? `LKR ${deliveryFee.toLocaleString()}` : 'N/A'}
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Distance: {deliveryDistanceKm != null ? `${deliveryDistanceKm.toFixed(1)} km` : 'N/A'}
              </p>
              {deliveryAddress ? (
                <p className="mt-1 text-xs text-neutral-600">Address: {deliveryAddress}</p>
              ) : null}
              <p className="mt-1 text-xs text-neutral-500">
                Source: {deliveryGeoSource || 'checkout location'}
              </p>
            </div>
          ) : null}
          {showCounterHandoff ? (
            <div className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                {counterHandoffHeading}
              </p>
              <p className="mt-1 text-sm text-neutral-800">{counterHandoffBody}</p>
              <div className="mt-4 flex flex-col items-center gap-3">
                <QRCodeSVG value={staffHandoffUrl} size={176} level="M" />
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyToClipboard('Counter link', staffHandoffUrl)}
                  >
                    Copy staff link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyToClipboard('Order ID', orderId)}
                  >
                    Copy full order ID
                  </Button>
                </div>
                {copyHint ? (
                  <p className="text-xs font-medium text-emerald-700">{copyHint}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="relative mt-4 flex flex-col gap-6">
            <div
              className="absolute left-[15px] top-4 z-[1] w-0.5 bg-neutral-200"
              style={{
                height: 'calc(100% - 2rem)',
              }}
              aria-hidden
            />
            <div
              className="absolute left-[15px] top-4 z-[1] w-0.5 bg-primary transition-[height] duration-1000 ease-out"
              style={{
                height:
                  progressPercentage > 0
                    ? `calc(${progressPercentage}% - 8px)`
                    : '0px',
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
                    (isActive || isPast) && 'opacity-100'
                  )}
                >
                  <div
                    className={cn(
                      'relative z-[2] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-all duration-500',
                      isActive &&
                        'scale-110 bg-primary text-primary-foreground shadow-[0_0_15px_hsla(14,100%,57%,0.3)] animate-step-indicator-pulse',
                      isPast && 'bg-emerald-500 text-white',
                      isFuture && 'bg-neutral-200 text-neutral-600'
                    )}
                  >
                    {isPast ? '✓' : index + 1}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-neutral-900">{step.label}</span>
                    <span className="text-xs text-neutral-400">
                      {isActive
                        ? stepDescription
                        : isPast
                          ? 'Completed'
                          : 'Upcoming'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 border-t border-neutral-100 pt-8 text-center text-sm text-neutral-500">
            <p>Status refreshes every 10 seconds</p>
            {trackError ? (
              <p className="mt-2 text-red-600">{trackError}</p>
            ) : null}
          </div>
        </main>

        <div className="mt-8 flex justify-center gap-3">
          <Button
            variant="default"
            onClick={() => router.push(`/${locale}/order/track`)}
          >
            Track another order
          </Button>
          <Button variant="outline" onClick={() => router.push('/')}>
            Order Something Else
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            clientPageShellClass,
            'flex items-center justify-center text-neutral-500',
          )}
        >
          Loading order status…
        </div>
      }
    >
      <OrderTracking />
    </Suspense>
  );
}
