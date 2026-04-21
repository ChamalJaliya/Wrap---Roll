/* apps/client/src/app/checkout/page.tsx */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  computeCheckoutBreakdown,
  computeDeliveryFeeLkr,
  normalizeCheckoutVatRate,
  parseDeliveryJson,
} from '@wrap-roll/contracts';
import { useClientStore } from '../../../store/useClientStore';
import { CartLineBreakdown } from '../../../components/CartLineBreakdown';
import {
  CouponApiService,
  CustomerApiService,
  LocationApiService,
  OrderService,
  PaymentService,
  SettingsApiService,
} from '../../../services/api';
import { AuthService } from '../../../services/auth';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  FormToggleRow,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
  toast,
} from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import {
  checkoutSaveAddressLabelClass,
  emptyNewAddressDraft,
  getCheckoutOptionCardClass,
  parseCoord,
  toCheckoutAddressSavePayload,
  type AddressBookEntry,
} from '@/lib/client-checkout-contract';
import { surfaceInputClass } from '@/lib/client-field-styles';
import {
  clientCheckoutTitleClass,
  clientDisplayHeadingSolidLgClass,
  clientContentWideClass,
  clientFormLabelClass,
  clientGlassPanelFlatClass,
  clientPageShellClass,
  clientStepBadgeClass,
} from '@/lib/client-page-shell';

/**
 * PayHere’s payhere.js reads `.length` on merchant_id, amount, and currency — values must be strings.
 * @see https://www.payhere.lk/lib/payhere.js (startPayment validation)
 */
interface PayHereRequest {
  sandbox: boolean;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  hash: string;
}

function emitDeliveryEvent(name: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({
    event: name,
    ...(payload ?? {}),
  });
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function minutesToTimeInputValue(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Number(totalMinutes) || 0));
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function maxTimeValue(a: string, b: string): string {
  return a >= b ? a : b;
}

function minTimeValue(a: string, b: string): string {
  return a <= b ? a : b;
}

function FulfillmentOption({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'cursor-pointer rounded-[var(--radius-xl)] border bg-white/80 p-6 text-center shadow-sm backdrop-blur-sm transition-all duration-300',
        disabled
          ? 'cursor-not-allowed opacity-40'
          : active
            ? 'scale-[1.02] border-primary bg-[hsl(var(--primary)/0.1)] shadow-lg shadow-primary/15'
            : 'border-neutral-200/90 hover:border-primary/40',
      )}
    >
      <span className="mb-3 block text-3xl">{icon}</span>
      <span className="font-display text-[0.95rem] font-extrabold text-neutral-900">
        {label}
      </span>
    </button>
  );
}

// parseOrderTotal replaced by direct schema access to pricing.total

/** Must match API live/sandbox; default sandbox for local dev. */
const PAYHERE_SANDBOX =
  process.env.NEXT_PUBLIC_PAYHERE_SANDBOX !== 'false';

function payHereErrorHint(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes('unauthorized') ||
    m.includes('invalid payment') ||
    m.includes('merchant')
  ) {
    return (
      '\n\n' +
      'PayHere never reaches the card step when the session is rejected. ' +
      'In sandbox.payhere.lk go to Integrations → Add Domain/App and register your origin (e.g. localhost). ' +
      'Use the Merchant ID and Secret from that same account in services/api/.env, restart the API, then try again.'
    );
  }
  return '';
}

export default function CheckoutPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Checkout');
  const tCart = useTranslations('Cart');
  const { cart, getTotalPrice, clearCart } = useClientStore();
  const cartFingerprint = cart.map((i) => `${i.cartId}:${i.quantity}`).join('|');
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [fulfillmentType, setFulfillmentType] = useState<
    'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  >('TAKEAWAY');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderFor, setOrderFor] = useState<'SELF' | 'OTHER'>('SELF');
  const [selfName, setSelfName] = useState('');
  const [selfPhone, setSelfPhone] = useState('');

  const [addresses, setAddresses] = useState<AddressBookEntry[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'NEW' | null>(null);
  const [newAddress, setNewAddress] = useState({
    ...emptyNewAddressDraft,
  });
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  /** Drop-off coordinates for distance-based delivery (browser geolocation). */
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeResults, setPlaceResults] = useState<Array<{ id: string; label: string }>>([]);
  const [placeSourceLabel, setPlaceSourceLabel] = useState<string | null>(null);

  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [timingMode, setTimingMode] = useState<'ASAP' | 'SCHEDULE'>('ASAP');
  const [scheduledTime, setScheduledTime] = useState(''); // HH:mm
  const [paymentMethod, setPaymentMethod] = useState<'payhere' | 'cash'>(
    'payhere',
  );

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const session = await AuthService.getSession();
      if (!session) {
        router.push(
          `/${locale}/auth/signin?returnTo=${encodeURIComponent(`/${locale}/checkout`)}`,
        );
      } else {
        setUser(session.user);
        const fallbackName = session.user.user_metadata?.full_name || '';
        setSelfName(fallbackName);
        setCustomerName(fallbackName);
        setDeliveryAddress('');
        try {
          const [settings, c, addr, cards] = await Promise.all([
            SettingsApiService.getPublic().catch(() => null),
            CustomerApiService.sync(),
            CustomerApiService.getAddressBook().catch(() => []),
            CustomerApiService.getSavedCards().catch(() => []),
          ]);
          setBusinessSettings(settings);
          const methods = settings?.paymentConfig?.methods;
          if (methods) {
            if (!methods.payhere && methods.cash) setPaymentMethod('cash');
            if (!methods.cash && methods.payhere) setPaymentMethod('payhere');
          }
          setSelfName(c?.name || fallbackName);
          setSelfPhone(c?.phone || '');
          setCustomerPhone(c?.phone || '');

          const list = (Array.isArray(addr) ? addr : []) as AddressBookEntry[];
          setAddresses(list);
          const def = list.find((a) => a?.isDefault);
          setSelectedAddressId(def?.id ?? (list[0]?.id ?? 'NEW'));

          const cardList = Array.isArray(cards) ? cards : [];
          setSavedCards(cardList);
          const defCard = cardList.find((x: any) => x?.isDefault);
          setSelectedCardId(defCard?.id ?? (cardList[0]?.id ?? null));
        } catch {
          // non-blocking
        }
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, [router, locale]);

  useEffect(() => {
    const now = new Date();
    const leadMinutes = Number(businessSettings?.minLeadTimeMinutes ?? 0);
    const minByLead = toTimeInputValue(new Date(now.getTime() + leadMinutes * 60_000));
    const openingTimeValue = minutesToTimeInputValue(Number(businessSettings?.openingTimeMinutes ?? 0));
    const closingTimeMinutes = Number(businessSettings?.closingTimeMinutes ?? 24 * 60 - 1);
    const cutoffMinutes = Math.max(
      0,
      Number(
        (businessSettings?.deliveryJson as { orderCutoffBeforeCloseMinutes?: number } | null)
          ?.orderCutoffBeforeCloseMinutes ?? 60,
      ),
    );
    const lastScheduleMinute = Math.max(0, closingTimeMinutes - cutoffMinutes);
    const closingTimeValue = minutesToTimeInputValue(lastScheduleMinute);
    const minScheduleTime = maxTimeValue(openingTimeValue, minByLead);
    const scheduleWindowAvailable = minScheduleTime <= closingTimeValue;
    if (timingMode === 'SCHEDULE' && !scheduleWindowAvailable) {
      setTimingMode('ASAP');
      setScheduledTime('');
    }
  }, [timingMode, businessSettings]);

  useEffect(() => {
    if (!businessSettings) return;
    const d = parseDeliveryJson(businessSettings.deliveryJson);
    if (!d.enabled && fulfillmentType === 'DELIVERY') {
      setFulfillmentType('TAKEAWAY');
    }
  }, [businessSettings, fulfillmentType]);

  useEffect(() => {
    setAppliedCoupon(null);
  }, [cartFingerprint]);

  useEffect(() => {
    if (fulfillmentType !== 'DELIVERY') {
      setDeliveryLat(null);
      setDeliveryLng(null);
    }
  }, [fulfillmentType]);

  useEffect(() => {
    if (selectedAddressId == null || selectedAddressId === 'NEW') return;
    const chosen = addresses.find((a) => a.id === selectedAddressId);
    if (!chosen) return;
    const lat = Number(chosen.latitude);
    const lng = Number(chosen.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setDeliveryLat(lat);
      setDeliveryLng(lng);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    let cancelled = false;
    const q = placeQuery.trim();
    if (fulfillmentType !== 'DELIVERY' || selectedAddressId !== 'NEW' || q.length < 3) {
      setPlaceResults([]);
      setPlaceBusy(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setPlaceBusy(true);
        const rows = await LocationApiService.autocomplete(q);
        if (!cancelled) {
          setPlaceResults(rows.map((r) => ({ id: r.id, label: r.label })));
        }
      } catch {
        if (!cancelled) setPlaceResults([]);
      } finally {
        if (!cancelled) setPlaceBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fulfillmentType, selectedAddressId, placeQuery]);

  const shell = cn(clientPageShellClass);

  if (authChecking) {
    return (
      <div className={shell}>
        <div className={clientContentWideClass}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-muted-foreground">{t('verifying')}</p>
          </div>
        </div>
      </div>
    );
  }

  const cartSubtotal = getTotalPrice();

  const vatRate = normalizeCheckoutVatRate(businessSettings?.checkoutVatRate ?? 0.15);
  const deliveryRules = parseDeliveryJson(businessSettings?.deliveryJson ?? null);
  const deliveryFeeComputed = computeDeliveryFeeLkr(deliveryRules, {
    fulfillmentIsDelivery: fulfillmentType === 'DELIVERY',
    deliveryLat,
    deliveryLng,
  });
  const summaryDeliveryFee =
    fulfillmentType === 'DELIVERY' && deliveryRules.enabled && !deliveryFeeComputed.error
      ? deliveryFeeComputed.fee
      : 0;
  const breakdown = computeCheckoutBreakdown({
    subtotal: cartSubtotal,
    vatRate,
    deliveryFee: summaryDeliveryFee,
    discountAmount: appliedCoupon?.discountAmount ?? 0,
  });
  const summarySubtotal = breakdown.subtotal;
  const summaryTax = breakdown.tax;
  const summaryDelivery = breakdown.deliveryFee;
  const summaryDiscount = breakdown.discountAmount;
  const summaryTotal = breakdown.total;
  const isDeliveryCheckout = fulfillmentType === 'DELIVERY';
  const deliveryNeedsLocation =
    isDeliveryCheckout &&
    deliveryRules.feeMode === 'distance' &&
    deliveryFeeComputed.error === 'coords_required';
  const deliveryOutOfRange =
    isDeliveryCheckout &&
    deliveryRules.feeMode === 'distance' &&
    deliveryFeeComputed.error === 'out_of_range';
  const deliveryPricingUnavailable =
    isDeliveryCheckout &&
    deliveryRules.feeMode === 'distance' &&
    deliveryFeeComputed.error === 'invalid_rules';

  const now = new Date();
  const leadMinutes = Number(businessSettings?.minLeadTimeMinutes ?? 0);
  const cutoffMinutes = Math.max(
    0,
    Number(
      (businessSettings?.deliveryJson as { orderCutoffBeforeCloseMinutes?: number } | null)
        ?.orderCutoffBeforeCloseMinutes ?? 60,
    ),
  );
  const minByLead = toTimeInputValue(new Date(now.getTime() + leadMinutes * 60_000));
  const openingTimeValue = minutesToTimeInputValue(Number(businessSettings?.openingTimeMinutes ?? 0));
  const closingTimeMinutes = Number(businessSettings?.closingTimeMinutes ?? 24 * 60 - 1);
  const lastScheduleMinute = Math.max(0, closingTimeMinutes - cutoffMinutes);
  const lastScheduleTimeValue = minutesToTimeInputValue(lastScheduleMinute);
  const closingTimeValue = minutesToTimeInputValue(
    Number(businessSettings?.closingTimeMinutes ?? 24 * 60 - 1),
  );
  const minScheduleTime = maxTimeValue(openingTimeValue, minByLead);
  const maxScheduleTime = minTimeValue(closingTimeValue, lastScheduleTimeValue);
  const scheduleWindowAvailable = minScheduleTime <= maxScheduleTime;
  const orderingClosed = businessSettings?.acceptingOrders === false;

  if (cart.length === 0) {
    return (
      <div className={shell}>
        <div className={clientContentWideClass}>
          <div className="mx-auto max-w-xl text-center">
            <h1 className={cn(clientDisplayHeadingSolidLgClass, 'mb-6')}>
              {t('emptyTitle')}
            </h1>
            <Button variant="default" onClick={() => router.push(`/${locale}`)}>
              {t('backToMenu')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleApplyCoupon = async () => {
    const raw = couponInput.trim().toUpperCase();
    if (!raw) return;
    const phone = orderFor === 'SELF' ? selfPhone : customerPhone;
    if (!phone?.trim()) {
      toast.error(t('needPhoneForCoupon'));
      return;
    }
    setCouponBusy(true);
    try {
      const res = await CouponApiService.validate({
        code: raw,
        subtotal: getTotalPrice(),
        customerPhone: phone.replace(/\s+/g, ''),
      });
      if (!res.valid) {
        setAppliedCoupon(null);
        toast.error(res.message || t('couponInvalid'));
        return;
      }
      setAppliedCoupon({
        code: raw,
        discountAmount: Number(res.discountAmount ?? 0),
      });
      toast.success(t('couponApplied'));
    } catch {
      toast.error(t('couponInvalid'));
    } finally {
      setCouponBusy(false);
    }
  };

  const requestDeliveryLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Your browser does not support location.');
      emitDeliveryEvent('delivery_location_permission_denied', { reason: 'unsupported' });
      return;
    }
    emitDeliveryEvent('delivery_location_permission_prompted');
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setDeliveryLat(pos.coords.latitude);
        setDeliveryLng(pos.coords.longitude);
        emitDeliveryEvent('delivery_fee_calculated', {
          source: 'device_location',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        try {
          const rev = await LocationApiService.reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          setPlaceSourceLabel(rev.formattedAddress || null);
          setNewAddress((s) => ({
            ...s,
            addressLine1: rev.addressLine1 || s.addressLine1,
            city: rev.city || s.city,
            postalCode: rev.postalCode || s.postalCode,
          }));
          if (!deliveryAddress.trim()) {
            setDeliveryAddress(rev.formattedAddress || rev.addressLine1 || '');
          }
          toast.success('Location captured and address auto-filled');
        } catch {
          toast.success('Location captured for delivery fee');
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        setGeoBusy(false);
        toast.error('Location permission denied or unavailable.');
        emitDeliveryEvent('delivery_location_permission_denied', { reason: 'browser_denied' });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const applyPlaceSelection = async (placeId: string) => {
    try {
      setPlaceBusy(true);
      const p = await LocationApiService.place(placeId);
      setDeliveryLat(Number(p.latitude));
      setDeliveryLng(Number(p.longitude));
      setPlaceSourceLabel(p.label);
      setPlaceQuery(p.label);
      setPlaceResults([]);
      // Keep a visible address fallback for operators when map/geolocation isn't available.
      setNewAddress((s) => ({
        ...s,
        addressLine1: s.addressLine1 || p.label,
      }));
      toast.success('Address pin selected for delivery fee');
    } catch {
      toast.error('Could not resolve selected address location');
    } finally {
      setPlaceBusy(false);
    }
  };

  const handleCheckout = async () => {
    const setError = (message: string) => {
      setCheckoutError(message);
      toast.error(message);
    };
    const isGatewayInitFailure = (text: string) => {
      const m = String(text ?? '').toLowerCase();
      return (
        m.includes('unauthorized') ||
        m.includes('invalid payment') ||
        m.includes('merchant') ||
        m.includes('payment request')
      );
    };

    let createdOrderId: string | null = null;
    const abortPendingOnlineOrder = async (reason: string) => {
      if (!createdOrderId || paymentMethod !== 'payhere') return;
      try {
        await PaymentService.abortCheckout(createdOrderId, reason);
      } catch (abortErr) {
        console.warn('Failed to abort pending online order', abortErr);
      }
    };

    setCheckoutError(null);
    if (orderingClosed) {
      setError(
        businessSettings?.closureReason ||
          'Online ordering is not available right now. Please try again later.',
      );
      return;
    }
    const receiverName = orderFor === 'SELF' ? selfName : customerName;
    const receiverPhone = orderFor === 'SELF' ? selfPhone : customerPhone;

    if (!receiverName || !receiverPhone) {
      setError(t('needNamePhone'));
      return;
    }

    const settings = businessSettings;
    let requestedTimeIso: string | undefined = undefined;
    if (timingMode === 'SCHEDULE') {
      if (!scheduledTime) {
        setError('Please pick a time.');
        return;
      }
      const [hh, mm] = scheduledTime.split(':').map((x) => Number(x));
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
        setError('Invalid time.');
        return;
      }
      const now = new Date();
      const scheduled = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hh,
        mm,
        0,
        0,
      );
      if (settings?.scheduleSameDayOnly) {
        // already same-day by construction
      }
      const openM = Number(settings?.openingTimeMinutes ?? 0);
      const closeM = Number(settings?.closingTimeMinutes ?? 24 * 60);
      const schedMins = hh * 60 + mm;
      if (schedMins < openM || schedMins > closeM) {
        setError('Scheduled time must be within opening hours.');
        return;
      }
      const lead = Number(settings?.minLeadTimeMinutes ?? 0);
      const min = new Date(now.getTime() + lead * 60_000);
      if (scheduled.getTime() < min.getTime()) {
        setError(`Scheduled time must be at least ${lead} minutes from now.`);
        return;
      }
      requestedTimeIso = scheduled.toISOString();
    }

    let finalDeliveryAddress: string | undefined = undefined;
    let effectiveDeliveryLat = deliveryLat;
    let effectiveDeliveryLng = deliveryLng;
    if (fulfillmentType === 'DELIVERY') {
      if (selectedAddressId && selectedAddressId !== 'NEW') {
        const a = addresses.find((x) => x?.id === selectedAddressId);
        if (a) {
          finalDeliveryAddress = `${a.addressLine1}${a.addressLine2 ? `, ${a.addressLine2}` : ''}, ${a.city}${a.postalCode ? ` ${a.postalCode}` : ''}`;
          const savedLat = parseCoord(a.latitude);
          const savedLng = parseCoord(a.longitude);
          if (savedLat != null && savedLng != null) {
            effectiveDeliveryLat = savedLat;
            effectiveDeliveryLng = savedLng;
          }
        }
      } else {
        finalDeliveryAddress = deliveryAddress.trim() || newAddress.addressLine1.trim();
      }

      if (!finalDeliveryAddress) {
        setError('Please provide a delivery address.');
        return;
      }

      const delRules = parseDeliveryJson(settings?.deliveryJson ?? null);
      if (delRules.feeMode === 'distance') {
        const fr = computeDeliveryFeeLkr(delRules, {
          fulfillmentIsDelivery: true,
          deliveryLat: effectiveDeliveryLat,
          deliveryLng: effectiveDeliveryLng,
        });
        if (fr.error === 'coords_required') {
          setError(
            'Use “Share location” so we can calculate the delivery fee for your area.',
          );
          return;
        }
        if (fr.error === 'out_of_range') {
          emitDeliveryEvent('delivery_out_of_range', {
            latitude: effectiveDeliveryLat,
            longitude: effectiveDeliveryLng,
          });
          setError('This location is outside our delivery area. Try takeaway or a closer address.');
          return;
        }
        if (fr.error === 'invalid_rules') {
          setError('Delivery pricing is unavailable. Please try again later or choose takeaway.');
          return;
        }
      }
    }

    try {
      setLoading(true);

      if (fulfillmentType === 'DELIVERY' && selectedAddressId === 'NEW' && saveNewAddress) {
        const line1 = (newAddress.addressLine1 || '').trim();
        if (line1) {
          try {
            const saved = await CustomerApiService.saveAddress({
              ...toCheckoutAddressSavePayload(
                { ...newAddress, addressLine1: line1 },
                { lat: effectiveDeliveryLat, lng: effectiveDeliveryLng },
              ),
            });
            const refreshed = await CustomerApiService.getAddressBook().catch(() => []);
            setAddresses(refreshed as AddressBookEntry[]);
            if (saved?.id) setSelectedAddressId(saved.id);
          } catch {
            // ignore save failures for checkout
          }
        }
      }

      const orderData = {
        userId: user?.id,
        fulfillmentType,
        customerName: receiverName,
        customerPhone: receiverPhone,
        customerEmail: user?.email,
        requestedTime: requestedTimeIso,
        paymentMethod,
        deliveryAddress:
          fulfillmentType === 'DELIVERY' ? finalDeliveryAddress : undefined,
        ...(fulfillmentType === 'DELIVERY' &&
        effectiveDeliveryLat != null &&
        effectiveDeliveryLng != null
          ? { deliveryLatitude: effectiveDeliveryLat, deliveryLongitude: effectiveDeliveryLng }
          : {}),
        items: cart.map((i) => ({
          itemId: i.itemId,
          name: i.name,
          quantity: i.quantity,
          basePrice: i.basePrice,
          modifiers: i.modifiers.map((m) => ({
            groupId: m.groupId,
            name: m.name,
            options: m.options.map((o) => ({
              optionId: o.optionId,
              label: o.label,
              priceAdjust: o.priceAdjust,
            })),
          })),
          totalPrice: i.totalItemPrice * i.quantity,
        })),
        ...(appliedCoupon?.code ? { discountCode: appliedCoupon.code } : {}),
        totalAmount: summaryTotal,
      };

      const orderResponse = await OrderService.createOrder(orderData);
      const orderId = String(orderResponse.id || orderResponse.orderId || '').trim();
      if (!orderId) {
        throw new Error('Order created but no order id returned by API');
      }
      createdOrderId = orderId;
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_order_id', String(orderId));
        localStorage.setItem('last_order_phone', String(receiverPhone));
      }

      if (paymentMethod === 'cash') {
        clearCart();
        router.push(`/${locale}/order/success?id=${orderId}`);
        return;
      }

      const persisted = Number((orderResponse as { total?: unknown }).total);
      const payable = Number.isFinite(persisted) ? persisted : summaryTotal;
      const currency = 'LKR';

      const paySignature = await PaymentService.getPaymentHash(
        orderId,
        payable,
        currency,
      );

      const merchantId = String(paySignature.merchantId ?? '').trim();
      const hash = String(paySignature.hash ?? '').trim();
      if (
        !merchantId ||
        !hash ||
        merchantId === 'undefined' ||
        hash === 'undefined'
      ) {
        await abortPendingOnlineOrder('payhere_hash_unavailable');
        setError(t('payHereNotConfigured'));
        return;
      }

      const origin = window.location.origin;
      const notifyUrl =
        process.env.NEXT_PUBLIC_PAYHERE_NOTIFY_URL ||
        `${origin}/api/nest/payment/webhook`;

      const amountStr = Number(payable).toFixed(2);

      const payHereRequest: PayHereRequest = {
        sandbox: PAYHERE_SANDBOX,
        merchant_id: merchantId,
        return_url: `${origin}/${locale}/order/success`,
        cancel_url: `${origin}/${locale}/checkout`,
        notify_url: notifyUrl,
        order_id: String(orderId),
        items: t('payHereItemsLabel'),
        amount: amountStr,
        currency,
        first_name: receiverName.split(' ')[0] || 'Guest',
        last_name: receiverName.split(' ').slice(1).join(' ') || 'Customer',
        email: String(user?.email || 'customer@example.com'),
        phone: String(receiverPhone).replace(/\s+/g, ''),
        address:
          fulfillmentType === 'DELIVERY'
            ? String(finalDeliveryAddress || '').trim() || 'No Address Provided'
            : 'No Address Provided',
        city: 'Colombo',
        country: 'LK',
        hash,
      };

      const stringFields: (keyof PayHereRequest)[] = [
        'merchant_id',
        'return_url',
        'cancel_url',
        'notify_url',
        'order_id',
        'items',
        'amount',
        'currency',
        'first_name',
        'last_name',
        'email',
        'phone',
        'address',
        'city',
        'country',
        'hash',
      ];
      for (const key of stringFields) {
        const v = payHereRequest[key];
        if (typeof v !== 'string' || v.length === 0) {
          console.error('PayHere invalid field', key, v, payHereRequest);
          await abortPendingOnlineOrder(`payhere_invalid_field_${String(key)}`);
          setError(t('paymentInvalidField', { field: String(key) }));
          return;
        }
      }
      if (payHereRequest.currency.length !== 3) {
        await abortPendingOnlineOrder('payhere_invalid_currency');
        setError(t('currencyInvalid'));
        return;
      }

      if ((window as any).payhere) {
        (window as any).payhere.onCompleted = function onCompleted(
          completedOrderId: string
        ) {
          clearCart();
          router.push(`/${locale}/order/success?id=${completedOrderId}`);
        };

        (window as any).payhere.onDismissed = function onDismissed() {
          setLoading(false);
        };

        (window as any).payhere.onError = function onError(error: string) {
          const text = String(error ?? '');
          if (isGatewayInitFailure(text)) {
            void abortPendingOnlineOrder(`payhere_onerror_${text.slice(0, 80)}`);
          }
          setError(t('paymentError', { detail: text + payHereErrorHint(text) }));
          setLoading(false);
        };

        try {
          (window as any).payhere.startPayment(payHereRequest);
        } catch (paymentErr) {
          console.error('PayHere.startPayment', paymentErr, payHereRequest);
          void abortPendingOnlineOrder('payhere_start_payment_exception');
          setError(
            paymentErr instanceof Error
              ? paymentErr.message
              : t('paymentCouldNotStart'),
          );
          setLoading(false);
        }
      } else {
        console.warn('PayHere SDK not loaded.');
        await abortPendingOnlineOrder('payhere_sdk_not_loaded');
        setError(t('paymentUnavailable'));
        setLoading(false);
      }
    } catch (err) {
      console.error('Checkout failed', err);
      await abortPendingOnlineOrder('checkout_exception_before_payment');
      const apiMessage =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.message ||
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
          ?.error;
      setError(String(apiMessage || t('checkoutFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={shell}>
      <div className={clientContentWideClass}>
        <h1 className={cn(clientCheckoutTitleClass, 'mb-12')}>{t('title')}</h1>

        {businessSettings?.acceptingOrders === false ? (
          <div
            className="mb-10 rounded-[var(--radius-xl)] border border-amber-400/80 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-sm"
            role="alert"
          >
            <p className="font-display text-base font-bold">Online ordering is paused</p>
            <p className="mt-2 leading-relaxed text-amber-950/90">
              {businessSettings.closureReason ||
                'We are not accepting new orders at the moment. Please try again later.'}
            </p>
          </div>
        ) : null}

        <div className="grid items-start gap-12 lg:grid-cols-[1fr_420px]">
          <section className={cn(clientGlassPanelFlatClass, 'sm:p-12')}>
            <div className="mb-16 last:mb-0">
              <h3 className="mb-8 flex items-center gap-4 font-display text-2xl font-extrabold text-neutral-900">
                <span className={clientStepBadgeClass}>1</span>
                {t('fulfillment')}
              </h3>
              <div className="grid gap-6 sm:grid-cols-3 max-sm:grid-cols-1">
                <FulfillmentOption
                  active={fulfillmentType === 'TAKEAWAY'}
                  onClick={() => setFulfillmentType('TAKEAWAY')}
                  icon="🛍️"
                  label={t('takeaway')}
                />
                <FulfillmentOption
                  active={fulfillmentType === 'DINE_IN'}
                  onClick={() => setFulfillmentType('DINE_IN')}
                  icon="🍽️"
                  label={t('dineIn')}
                />
                <FulfillmentOption
                  active={fulfillmentType === 'DELIVERY'}
                  onClick={() => setFulfillmentType('DELIVERY')}
                  icon="🛵"
                  label={t('delivery')}
                  disabled={!parseDeliveryJson(businessSettings?.deliveryJson ?? null).enabled}
                />
              </div>
            </div>

            <div className="mb-16 last:mb-0">
              <h3 className="mb-8 flex items-center gap-4 font-display text-2xl font-extrabold text-neutral-900">
                <span className={clientStepBadgeClass}>2</span>
                Timing
              </h3>

              <SegmentedControl className="mb-6">
                <SegmentedControlItem
                  active={timingMode === 'ASAP'}
                  onClick={() => setTimingMode('ASAP')}
                >
                  ASAP
                </SegmentedControlItem>
                <SegmentedControlItem
                  active={timingMode === 'SCHEDULE'}
                  disabled={!scheduleWindowAvailable}
                  onClick={() => setTimingMode('SCHEDULE')}
                >
                  Schedule today
                </SegmentedControlItem>
              </SegmentedControl>

              {timingMode === 'SCHEDULE' ? (
                <div className="grid gap-2">
                  <Label htmlFor="checkout-scheduled-time" className={clientFormLabelClass}>
                    Time
                  </Label>
                  <Input
                    id="checkout-scheduled-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) {
                        setScheduledTime('');
                        return;
                      }
                      if (value < minScheduleTime) {
                        setScheduledTime(minScheduleTime);
                        return;
                      }
                      if (value > maxScheduleTime) {
                        setScheduledTime(maxScheduleTime);
                        return;
                      }
                      setScheduledTime(value);
                    }}
                    className={surfaceInputClass}
                    required
                    min={minScheduleTime}
                    max={maxScheduleTime}
                    disabled={!scheduleWindowAvailable}
                  />
                  {businessSettings ? (
                    <p className="text-xs text-neutral-500">
                      Opening hours: {String(Math.floor(businessSettings.openingTimeMinutes / 60)).padStart(2, '0')}:
                      {String(businessSettings.openingTimeMinutes % 60).padStart(2, '0')} – {String(Math.floor(businessSettings.closingTimeMinutes / 60)).padStart(2, '0')}:
                      {String(businessSettings.closingTimeMinutes % 60).padStart(2, '0')}. Last schedule slot: {maxScheduleTime}. Minimum lead time: {businessSettings.minLeadTimeMinutes} minutes.
                    </p>
                  ) : null}
                  {!scheduleWindowAvailable ? (
                    <p className="text-xs text-amber-700">
                      No future schedule slots are available right now. Please choose ASAP.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {fulfillmentType === 'DELIVERY' ? (
              <div className="mb-16 last:mb-0">
                <h3 className="mb-8 flex items-center gap-4 font-display text-2xl font-extrabold text-neutral-900">
                  <span className={clientStepBadgeClass}>3</span>
                  Delivery Address
                </h3>
                <div className="space-y-6">
                  {addresses.length ? (
                    <div className="grid gap-3">
                      {addresses.map((a: any) => (
                        <label
                          key={a.id}
                          className={getCheckoutOptionCardClass(selectedAddressId === a.id)}
                        >
                          <input
                            type="radio"
                            name="delivery-address"
                            className="mt-1"
                            checked={selectedAddressId === a.id}
                            onChange={() => setSelectedAddressId(a.id)}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-neutral-900">
                              {a.label}{' '}
                              {a.isDefault ? (
                                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <div className="text-neutral-600">
                              {a.addressLine1}
                              {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                              {a.city ? `, ${a.city}` : ''}
                              {a.postalCode ? ` ${a.postalCode}` : ''}
                            </div>
                          </div>
                        </label>
                      ))}

                      <label
                        className={getCheckoutOptionCardClass(selectedAddressId === 'NEW')}
                      >
                        <input
                          type="radio"
                          name="delivery-address"
                          className="mt-1"
                          checked={selectedAddressId === 'NEW'}
                          onChange={() => setSelectedAddressId('NEW')}
                        />
                        <div className="font-semibold text-neutral-900">
                          Use a new address
                        </div>
                      </label>
                    </div>
                  ) : null}

                  {selectedAddressId === 'NEW' || !addresses.length ? (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label className={clientFormLabelClass}>Label</Label>
                        <Input
                          value={newAddress.label}
                          onChange={(e) =>
                            setNewAddress((s) => ({ ...s, label: e.target.value }))
                          }
                          className={surfaceInputClass}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className={clientFormLabelClass}>Address line 1</Label>
                        <Input
                          value={newAddress.addressLine1}
                          onChange={(e) =>
                            setNewAddress((s) => ({
                              ...s,
                              addressLine1: e.target.value,
                            }))
                          }
                          placeholder="e.g. 42 Flower Rd"
                          className={surfaceInputClass}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className={clientFormLabelClass}>Address line 2 (optional)</Label>
                        <Input
                          value={newAddress.addressLine2}
                          onChange={(e) =>
                            setNewAddress((s) => ({
                              ...s,
                              addressLine2: e.target.value,
                            }))
                          }
                          placeholder="Apartment, floor, landmark"
                          className={surfaceInputClass}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label className={clientFormLabelClass}>City</Label>
                          <Input
                            value={newAddress.city}
                            onChange={(e) =>
                              setNewAddress((s) => ({ ...s, city: e.target.value }))
                            }
                            className={surfaceInputClass}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className={clientFormLabelClass}>Postal code (optional)</Label>
                          <Input
                            value={newAddress.postalCode}
                            onChange={(e) =>
                              setNewAddress((s) => ({
                                ...s,
                                postalCode: e.target.value,
                              }))
                            }
                            className={surfaceInputClass}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-sm text-neutral-700">
                        <FormToggleRow
                          className={checkoutSaveAddressLabelClass}
                          label="Save this address to my account"
                          inputProps={{
                            type: 'checkbox',
                            checked: saveNewAddress,
                            onChange: (e) => setSaveNewAddress((e.target as HTMLInputElement).checked),
                          }}
                        />
                        <FormToggleRow
                          className={checkoutSaveAddressLabelClass}
                          label="Set as default"
                          inputProps={{
                            type: 'checkbox',
                            checked: !!newAddress.isDefault,
                            onChange: (e) =>
                              setNewAddress((s) => ({
                                ...s,
                                isDefault: (e.target as HTMLInputElement).checked,
                              })),
                            disabled: !saveNewAddress,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <Label
                        htmlFor="checkout-delivery-address"
                        className={clientFormLabelClass}
                      >
                        Address notes (optional)
                      </Label>
                      <Input
                        id="checkout-delivery-address"
                        placeholder="Gate code, call on arrival, etc."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className={surfaceInputClass}
                      />
                    </div>
                  )}

                  {deliveryRules.feeMode === 'distance' ? (
                    <div className="rounded-[var(--radius-xl)] border border-primary/30 bg-[hsl(var(--primary)/0.06)] p-5">
                      <p className="mb-3 text-sm font-semibold text-neutral-900">
                        Delivery distance
                      </p>
                      <p className="mb-4 text-xs leading-relaxed text-neutral-600">
                        We price delivery by straight-line distance from our kitchen. Share your
                        current location while you are at the delivery address (or nearby).
                      </p>
                      {selectedAddressId === 'NEW' ? (
                        <div className="mb-4 grid gap-2">
                          <Label className={clientFormLabelClass}>
                            Search address / drop pin (Google Places)
                          </Label>
                          <Input
                            value={placeQuery}
                            onChange={(e) => setPlaceQuery(e.target.value)}
                            placeholder="Search your area, road or landmark"
                            className={surfaceInputClass}
                          />
                          {placeBusy ? (
                            <p className="text-xs text-neutral-500">Searching places...</p>
                          ) : null}
                          {placeResults.length > 0 ? (
                            <div className="max-h-44 overflow-auto rounded-xl border bg-white">
                              {placeResults.map((row) => (
                                <button
                                  key={row.id}
                                  type="button"
                                  className="block w-full border-b px-3 py-2 text-left text-sm text-neutral-700 last:border-b-0 hover:bg-neutral-50"
                                  onClick={() => void applyPlaceSelection(row.id)}
                                >
                                  {row.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="mb-3 w-full sm:w-auto"
                        disabled={geoBusy || placeBusy}
                        onClick={() => requestDeliveryLocation()}
                      >
                        {geoBusy ? 'Getting location…' : '📍 Share location for delivery fee'}
                      </Button>
                      {placeSourceLabel ? (
                        <p className="mb-2 text-xs text-neutral-600" aria-live="polite">
                          Using selected address pin: {placeSourceLabel}
                        </p>
                      ) : null}
                      {deliveryLat != null && deliveryLng != null ? (
                        <div className="text-sm text-neutral-700">
                          {deliveryFeeComputed.error === 'out_of_range' ? (
                            <p className="font-medium text-amber-800">
                              Outside delivery radius — choose takeaway or move closer.
                            </p>
                          ) : deliveryFeeComputed.error === 'invalid_rules' ? (
                            <p className="font-medium text-amber-800">
                              Pricing unavailable — try again later.
                            </p>
                          ) : (
                            <>
                              {typeof deliveryFeeComputed.distanceKm === 'number' ? (
                                <p>
                                  About{' '}
                                  <strong>{deliveryFeeComputed.distanceKm.toFixed(1)} km</strong>{' '}
                                  from our kitchen.
                                </p>
                              ) : null}
                              {!deliveryFeeComputed.error ? (
                                <p className="mt-1 text-neutral-600">
                                  Delivery fee:{' '}
                                  <strong>
                                    {tCart('currency')} {deliveryFeeComputed.fee.toLocaleString()}
                                  </strong>
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          Location not set yet — your order total will update after you share
                          location.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="mb-8 flex items-center gap-4 font-display text-2xl font-extrabold text-neutral-900">
                <span className={clientStepBadgeClass}>
                  {fulfillmentType === 'DELIVERY' ? 4 : 3}
                </span>
                {t('contact')}
              </h3>
              <SegmentedControl className="mb-6">
                <SegmentedControlItem
                  active={orderFor === 'SELF'}
                  onClick={() => setOrderFor('SELF')}
                >
                  For me
                </SegmentedControlItem>
                <SegmentedControlItem
                  active={orderFor === 'OTHER'}
                  onClick={() => setOrderFor('OTHER')}
                >
                  For someone else
                </SegmentedControlItem>
              </SegmentedControl>
              <div className="space-y-6">
                {orderFor === 'SELF' ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="checkout-self-name" className={clientFormLabelClass}>
                        Your name
                      </Label>
                      <Input
                        id="checkout-self-name"
                        placeholder={t('receiverNamePlaceholder')}
                        value={selfName}
                        onChange={(e) => setSelfName(e.target.value)}
                        className={surfaceInputClass}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="checkout-self-phone" className={clientFormLabelClass}>
                        Your phone number
                      </Label>
                      <Input
                        id="checkout-self-phone"
                        placeholder={t('phonePlaceholder')}
                        value={selfPhone}
                        onChange={(e) => setSelfPhone(e.target.value)}
                        className={surfaceInputClass}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="checkout-name" className={clientFormLabelClass}>
                        Receiver name
                      </Label>
                      <Input
                        id="checkout-name"
                        placeholder={t('receiverNamePlaceholder')}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={surfaceInputClass}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="checkout-phone" className={clientFormLabelClass}>
                        Receiver phone number
                      </Label>
                      <Input
                        id="checkout-phone"
                        placeholder={t('phonePlaceholder')}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className={surfaceInputClass}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-16">
              <h3 className="mb-8 flex items-center gap-4 font-display text-2xl font-extrabold text-neutral-900">
                <span className={clientStepBadgeClass}>
                  {fulfillmentType === 'DELIVERY' ? 5 : 4}
                </span>
                Payment method
              </h3>
              <SegmentedControl>
                <SegmentedControlItem
                  active={paymentMethod === 'payhere'}
                  onClick={() => setPaymentMethod('payhere')}
                  disabled={
                    businessSettings?.paymentConfig?.methods?.payhere === false
                  }
                >
                  PayHere (online)
                </SegmentedControlItem>
                <SegmentedControlItem
                  active={paymentMethod === 'cash'}
                  onClick={() => setPaymentMethod('cash')}
                  disabled={businessSettings?.paymentConfig?.methods?.cash === false}
                >
                  {fulfillmentType === 'DELIVERY'
                    ? 'Pay on delivery'
                    : fulfillmentType === 'DINE_IN'
                      ? 'Pay at counter'
                      : 'Pay on pickup'}
                </SegmentedControlItem>
              </SegmentedControl>
              {paymentMethod === 'cash' ? (
                <p className="mt-3 text-xs text-neutral-500">
                  {fulfillmentType === 'DELIVERY'
                    ? 'You can pay at handoff by cash or card.'
                    : fulfillmentType === 'DINE_IN'
                      ? 'You can pay at the counter by cash or card.'
                      : 'You can pay on pickup by cash or card.'}
                </p>
              ) : null}
            </div>
          </section>

          <aside className="sticky top-8">
            <Card
              className={cn(
                clientGlassPanelFlatClass,
                'overflow-hidden border-0 p-0 shadow-[0_24px_48px_rgba(0,0,0,0.08)]',
              )}
            >
              <CardHeader className="px-8 pt-8">
                <CardTitle className="font-display text-xl">{t('orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <ul className="my-1 flex flex-col gap-4">
                  {cart.map((item) => (
                    <li key={item.cartId}>
                      <CartLineBreakdown item={item} lineControls />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    className={cn(surfaceInputClass, 'sm:flex-1')}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder={t('couponCode')}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={couponBusy}
                    onClick={() => void handleApplyCoupon()}
                  >
                    {t('applyCoupon')}
                  </Button>
                </div>
                <dl className="mt-6 space-y-2 border-t border-neutral-100 pt-6 text-sm text-neutral-600">
                  <div className="flex justify-between">
                    <dt>{t('subtotal')}</dt>
                    <dd className="font-medium text-neutral-800">
                      {tCart('currency')} {summarySubtotal.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{t('vat')}</dt>
                    <dd className="font-medium text-neutral-800">
                      {tCart('currency')} {summaryTax.toLocaleString()}
                    </dd>
                  </div>
                  {isDeliveryCheckout ? (
                    <div className="flex justify-between">
                      <dt>{t('deliveryFee')}</dt>
                      <dd className="font-medium text-neutral-800">
                        {deliveryNeedsLocation
                          ? 'Share location to calculate'
                          : deliveryOutOfRange
                            ? 'Outside delivery area'
                            : deliveryPricingUnavailable
                              ? 'Unavailable right now'
                              : `${tCart('currency')} ${summaryDelivery.toLocaleString()}`}
                      </dd>
                    </div>
                  ) : null}
                  {summaryDiscount > 0 ? (
                    <div className="flex justify-between text-emerald-800">
                      <dt>{t('discount')}</dt>
                      <dd className="font-medium">
                        −{tCart('currency')} {summaryDiscount.toLocaleString()}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-6 flex items-center justify-between border-t-2 border-dashed border-neutral-100 pt-8 font-display text-3xl font-black text-neutral-900">
                  <span>{t('total')}</span>
                  <span>
                    {tCart('currency')} {summaryTotal.toLocaleString()}
                  </span>
                </div>

                {savedCards.length ? (
                  <div className="mt-8 border-t border-neutral-100 pt-6">
                    <div className="mb-3 text-sm font-semibold text-neutral-900">
                      Saved cards
                    </div>
                    <div className="grid gap-2">
                      {savedCards.map((c: any) => (
                        <label
                          key={c.id}
                          className={cn(
                            'flex cursor-pointer items-center justify-between rounded-[var(--radius-xl)] border bg-white/70 px-4 py-3 text-sm transition-colors',
                            selectedCardId === c.id
                              ? 'border-primary bg-[hsl(var(--primary)/0.08)]'
                              : 'border-neutral-200/90 hover:border-primary/40',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="saved-card"
                              checked={selectedCardId === c.id}
                              onChange={() => setSelectedCardId(c.id)}
                            />
                            <div className="font-medium text-neutral-800">
                              {c.cardBrand} •••• {c.last4}
                              {c.isDefault ? (
                                <span className="ml-2 text-xs font-semibold text-neutral-500">
                                  (default)
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-neutral-500">
                      Saved cards are shown for convenience; checkout still uses PayHere to complete payment.
                    </p>
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="flex-col gap-0 px-8 pb-8 pt-0">
                {checkoutError ? (
                  <div className="mt-6 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {checkoutError}
                  </div>
                ) : orderingClosed ? (
                  <div className="mt-6 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {businessSettings?.closureReason || 'Ordering is currently unavailable.'}
                  </div>
                ) : null}
                <Button
                  variant="default"
                  size="lg"
                  className="mt-8 h-14 w-full rounded-[var(--radius-xl)] text-base font-black uppercase tracking-widest shadow-xl shadow-primary/40"
                  onClick={handleCheckout}
                  disabled={
                    loading ||
                    orderingClosed ||
                    deliveryNeedsLocation ||
                    deliveryOutOfRange ||
                    deliveryPricingUnavailable
                  }
                >
                  {loading
                    ? t('processing')
                    : paymentMethod === 'cash'
                      ? 'Place order'
                      : t('pay')}
                </Button>
                <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
                  {t('sandboxHint')}
                </p>
              </CardFooter>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
