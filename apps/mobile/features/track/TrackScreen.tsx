import React, { useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CashierHandoffQr } from '@/components/CashierHandoffQr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildCashierResolveOrderUrl } from '@wrap-roll/contracts';
import { ListTile, ModernPanel, PrimaryButton, SectionTitle, SurfaceCard, TagChip } from '@/components/mobile-ui';
import { MobileGradientHero } from '@/components/MobileGradientHero';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import { formatApiError } from '@/lib/api-error';
import { OrderService } from '@/services/api';
import { styles } from './trackStyles';

const CASHIER_ORIGIN =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_CASHIER_APP_URL?.trim()) ||
  'http://localhost:3002';

export default function TrackScreen() {
  const params = useLocalSearchParams<{ id?: string; phone?: string }>();
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof OrderService.trackOrder>> | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState('');
  const [activeLookup, setActiveLookup] = useState<{ id: string; phone: string } | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const fetchStatus = async ({
    id,
    ph,
    silent = false,
  }: {
    id: string;
    ph: string;
    silent?: boolean;
  }) => {
    if (!silent) {
      setError(null);
      setData(null);
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      await AsyncStorage.setItem('last_order_phone', ph);
      const res = await OrderService.trackOrder(id, ph);
      setData(res);
      setLastUpdatedAt(new Date().toISOString());
      setError(null);
      setActiveLookup({ id, phone: ph });
    } catch (e: unknown) {
      if (!silent) {
        setError(formatApiError(e));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const onTrack = async (prefilled?: { id?: string; phone?: string }) => {
    const id = (prefilled?.id ?? orderId).trim();
    const ph = (prefilled?.phone ?? phone).trim();
    if (!id || !ph) {
      setError('Enter order ID and the phone number used when ordering.');
      return;
    }
    await fetchStatus({ id, ph, silent: false });
  };

  useEffect(() => {
    const id = String(params.id || '').trim();
    const ph = String(params.phone || '').trim();
    if (!id || !ph) return;
    setOrderId(id);
    setPhone(ph);
    void onTrack({ id, phone: ph });
    // intentionally runs when params change
  }, [params.id, params.phone]);

  useEffect(() => {
    if (!activeLookup?.id || !activeLookup?.phone) return;
    const timer = setInterval(() => {
      void fetchStatus({ id: activeLookup.id, ph: activeLookup.phone, silent: true });
    }, 10000);
    return () => clearInterval(timer);
  }, [activeLookup?.id, activeLookup?.phone]);

  const currentStatus = String(data?.status || 'placed').toLowerCase();
  const statusValue = normalizeLabel(currentStatus);
  const paymentValue = normalizeLabel(data?.paymentStatus);
  const paymentMethodValue = normalizeLabel(data?.paymentMethod);
  const paymentCollection = String(data?.paymentCollection || '').toLowerCase();
  const fulfillmentType = String(data?.fulfillmentType || '').toLowerCase();
  const fulfillmentValue = getFulfillmentLabel(fulfillmentType);
  const isDeferred = isDeferredPaymentCollection({
    paymentCollection,
    paymentMethod: String(data?.paymentMethod || ''),
    paymentStatus: String(data?.paymentStatus || ''),
  });
  const paymentCollectionValue = getPaymentCollectionLabel(paymentCollection, isDeferred);
  const statusFlow = buildStatusFlow({
    fulfillmentType,
    isDeferredCollection: isDeferred,
    currentStatus,
  });
  const activeIndex = Math.max(
    0,
    statusFlow.findIndex((step) => step === currentStatus),
  );
  const placedValue = data?.placedAt ? formatDateTime(data.placedAt) : '—';
  const orderShort = data?.id ? `#${data.id.slice(0, 8)}` : orderId ? `#${orderId.slice(0, 8)}` : '—';
  const updatedValue = lastUpdatedAt ? formatDateTime(lastUpdatedAt) : null;

  /** Prefer API id; accept alternate keys; fall back to form / lookup. */
  const orderIdForHandoff = useMemo(() => {
    const d = data as { id?: string; orderId?: string } | null | undefined;
    const raw = d?.id ?? d?.orderId ?? activeLookup?.id ?? orderId;
    return String(raw ?? '').trim();
  }, [data, activeLookup?.id, orderId]);

  const staffHandoffUrl = useMemo(
    () => (orderIdForHandoff ? buildCashierResolveOrderUrl(CASHIER_ORIGIN, orderIdForHandoff) : ''),
    [orderIdForHandoff],
  );

  /** Any time we have loaded order details, show handoff — do not depend on `activeLookup` alone. */
  const showCashierQr = Boolean(data && staffHandoffUrl);

  const copyStaffText = async (label: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopyHint(`${label} copied`);
      setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint('Could not copy');
      setTimeout(() => setCopyHint(null), 2500);
    }
  };

  const shareStaffLink = async () => {
    if (!staffHandoffUrl) return;
    try {
      await Share.share({
        message: `My order — show staff: ${staffHandoffUrl}`,
        title: 'Wrap & Roll order',
      });
    } catch {
      // user dismissed
    }
  };

  const trackHeroStats = useMemo(
    () => [
      {
        label: 'ORDER',
        value: orderShort.replace(/^#/, '') || '—',
        icon: 'file-text-o' as const,
      },
      {
        label: 'STATUS',
        value: data ? statusValue : '—',
        icon: 'flag' as const,
      },
      {
        label: 'TOTAL',
        value: data ? `LKR ${Number(data.total).toFixed(0)}` : '—',
        icon: 'money' as const,
      },
    ],
    [data, orderShort, statusValue],
  );

  return (
    <View style={styles.screenRoot}>
      <View style={styles.trackMain}>
        <MobileGradientHero
          insetsTop={insets.top}
          eyebrow={t(language, 'trackHeroEyebrow')}
          title={t(language, 'trackOrderTitle')}
          hint={t(language, 'trackOrderSubtitle')}
          stats={trackHeroStats}
        />

        <ScrollView
          style={styles.scrollTrack}
          showsVerticalScrollIndicator={true}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        >
      <SurfaceCard style={styles.lookupCard}>
        <SectionTitle title="Order lookup" />
        <TextInput
          placeholder="Order ID"
          value={orderId}
          onChangeText={setOrderId}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          placeholder="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={loading ? 'Checking...' : 'Track order'} onPress={() => void onTrack()} disabled={loading} />
      </SurfaceCard>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {data ? (
        <>
          <ModernPanel title="Order summary" subtitle="Live order snapshot" style={styles.statusCard}>
            <View style={styles.metricsGrid}>
              <ListTile icon="flag" title="Status" subtitle={statusValue} right={<TagChip label={statusValue} tone="accent" />} />
              <ListTile icon="credit-card" title="Payment" subtitle={`${paymentMethodValue} / ${paymentValue}`} />
              <ListTile icon="clock-o" title="Collection" subtitle={paymentCollectionValue} />
              <ListTile icon="shopping-bag" title="Fulfillment" subtitle={fulfillmentValue} />
              <ListTile icon="money" title="Total" subtitle={`LKR ${Number(data.total).toFixed(0)}`} />
              <ListTile icon="calendar" title="Placed" subtitle={placedValue} />
              {data.estimatedReadyTime ? (
                <ListTile icon="hourglass-half" title="Estimated ready" subtitle={formatDateTime(data.estimatedReadyTime)} />
              ) : null}
            </View>
          </ModernPanel>

          {fulfillmentType === 'delivery' ? (
            <ModernPanel title="Delivery details" subtitle="Distance and fee lock" style={styles.deliveryCard}>
              <ListTile
                icon="money"
                title="Delivery fee"
                subtitle={data.deliveryFee != null ? `LKR ${Number(data.deliveryFee).toFixed(0)}` : 'N/A'}
              />
              <ListTile
                icon="road"
                title="Distance"
                subtitle={data.deliveryDistanceKm != null ? `${Number(data.deliveryDistanceKm).toFixed(1)} km` : 'N/A'}
              />
              {data.deliveryAddress ? <ListTile icon="map-marker" title="Address" subtitle={String(data.deliveryAddress)} /> : null}
            </ModernPanel>
          ) : null}

          <SurfaceCard style={styles.timelineCard}>
            <SectionTitle title="Live progress" />
            <View style={styles.timelineWrap}>
              <View style={styles.timelineBase} />
              <View
                style={[
                  styles.timelineProgress,
                  statusFlow.length > 1
                    ? { height: `${(activeIndex / (statusFlow.length - 1)) * 100}%` }
                    : { height: '0%' },
                ]}
              />
              {statusFlow.map((step, index) => {
                const isPast = index < activeIndex;
                const isActive = index === activeIndex;
                const iconName = STEP_ICONS[step] ?? 'clock-o';
                const stepDescription = getStepDescription({
                  stepStatus: step,
                  isDeferredCollection: isDeferred,
                  paymentCollection,
                  fulfillmentType,
                  estimatedReadyTime: String(data.estimatedReadyTime || ''),
                  currentStatus,
                });
                return (
                  <View key={step} style={[styles.timelineItem, index === statusFlow.length - 1 && styles.timelineItemLast]}>
                    <View
                      style={[
                        styles.timelineDot,
                        isPast && styles.timelineDotPast,
                        isActive && styles.timelineDotActive,
                      ]}
                    >
                      <FontAwesome name={isPast ? 'check' : iconName} size={13} style={styles.timelineDotIcon} />
                    </View>
                    <View style={styles.timelineTextBlock}>
                      <Text style={styles.timelineTitle}>{STATUS_STEP_CONTENT[step]?.label ?? normalizeLabel(step)}</Text>
                      <Text style={styles.timelineDesc}>
                        {isActive ? stepDescription : isPast ? 'Completed' : 'Upcoming'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.refreshRow}>
              <Text style={styles.refreshText}>
                {refreshing ? 'Refreshing...' : 'Status refreshes every 10 seconds'}
              </Text>
              {updatedValue ? <Text style={styles.refreshText}>Updated {updatedValue}</Text> : null}
            </View>
          </SurfaceCard>

          {showCashierQr ? (
            <View
              testID="track-cashier-handoff"
              style={[styles.cashierHandoffSlot, styles.successHandoffCard]}
              accessibilityLabel="Cashier lookup"
              accessibilityRole="summary"
            >
              <Text style={styles.successHandoffTitle}>Cashier lookup</Text>
              <Text style={styles.successHandoffBody}>
                Staff can scan this in the POS to open your order (dine-in, pickup, or delivery).
              </Text>
              <View style={styles.successQrWrap} collapsable={false}>
                <CashierHandoffQr value={staffHandoffUrl} size={176} />
              </View>
              <Text style={styles.qrFallbackHint}>If the code doesn’t appear, use Copy staff link.</Text>
              <View style={styles.handoffActions}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => void copyStaffText('Counter link', staffHandoffUrl)}
                >
                  <Text style={styles.secondaryBtnText}>Copy staff link</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => void copyStaffText('Order ID', orderIdForHandoff)}
                >
                  <Text style={styles.secondaryBtnText}>Copy full order ID</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={() => void shareStaffLink()}>
                  <Text style={styles.secondaryBtnText}>Share</Text>
                </Pressable>
              </View>
              {copyHint ? <Text style={styles.copyHint}>{copyHint}</Text> : null}
            </View>
          ) : null}

          <SurfaceCard style={styles.actionsCard}>
            <PrimaryButton
              label="Track another order"
              onPress={() => {
                setOrderId('');
                setPhone('');
                setData(null);
                setError(null);
                setActiveLookup(null);
                setCopyHint(null);
              }}
            />
          </SurfaceCard>
        </>
      ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const STATUS_STEP_CONTENT: Record<string, { label: string; description: string }> = {
  placed: {
    label: 'Order Received',
    description: 'Your order has been received and is waiting for preparation',
  },
  paid: {
    label: 'Paid & Confirmed',
    description: 'Payment verified and kitchen notified',
  },
  in_kitchen: {
    label: 'In the Kitchen',
    description: 'Our chefs are preparing your order',
  },
  ready: {
    label: 'Ready!',
    description: 'Your order is ready',
  },
  in_transit: {
    label: 'On the Way',
    description: 'Your rider is heading to you',
  },
  delivered: {
    label: 'Delivered',
    description: 'Enjoy your meal!',
  },
};

const CANONICAL_FLOW = ['placed', 'paid', 'in_kitchen', 'ready', 'in_transit', 'delivered'];
const STEP_ICONS: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  placed: 'file-text-o',
  paid: 'credit-card',
  in_kitchen: 'cutlery',
  ready: 'check-circle-o',
  in_transit: 'motorcycle',
  delivered: 'home',
};

function buildStatusFlow(params: {
  fulfillmentType: string;
  isDeferredCollection: boolean;
  currentStatus: string;
}) {
  const { fulfillmentType, isDeferredCollection, currentStatus } = params;
  const baseFlow =
    fulfillmentType === 'delivery'
      ? ['placed', 'in_kitchen', 'ready', 'in_transit', 'delivered']
      : ['placed', 'in_kitchen', 'ready', 'delivered'];
  const flowWithPayment = isDeferredCollection ? baseFlow : ['placed', 'paid', ...baseFlow.slice(1)];
  if (flowWithPayment.includes(currentStatus)) return flowWithPayment;
  return [...new Set([...flowWithPayment, currentStatus].sort((a, b) => CANONICAL_FLOW.indexOf(a) - CANONICAL_FLOW.indexOf(b)))];
}

function isDeferredPaymentCollection(params: {
  paymentCollection: string;
  paymentMethod: string;
  paymentStatus: string;
}) {
  const { paymentCollection, paymentMethod, paymentStatus } = params;
  if (
    paymentCollection === 'on_delivery' ||
    paymentCollection === 'on_pickup' ||
    paymentCollection === 'at_collection'
  )
    return true;
  return paymentMethod.toLowerCase() === 'cash' && paymentStatus.toLowerCase() !== 'completed';
}

function getPaymentCollectionLabel(paymentCollection: string, isDeferredCollection: boolean) {
  if (paymentCollection === 'on_delivery') return 'Pay on delivery';
  if (paymentCollection === 'on_pickup') return 'Pay on pickup';
  if (paymentCollection === 'at_collection') return 'Pay at collection';
  if (isDeferredCollection) return 'Pay later';
  return 'Immediate';
}

function getFulfillmentLabel(fulfillmentType: string) {
  if (fulfillmentType === 'delivery') return 'Delivery';
  if (fulfillmentType === 'dine_in') return 'Dine-in';
  return 'Pickup';
}

function getStepDescription(params: {
  stepStatus: string;
  isDeferredCollection: boolean;
  paymentCollection: string;
  fulfillmentType: string;
  estimatedReadyTime: string;
  currentStatus: string;
}) {
  const {
    stepStatus,
    isDeferredCollection,
    paymentCollection,
    fulfillmentType,
    estimatedReadyTime,
    currentStatus,
  } = params;
  if (stepStatus === 'placed' && isDeferredCollection) {
    if (paymentCollection === 'on_delivery') return 'Order received. Payment will be collected on delivery';
    if (paymentCollection === 'on_pickup') return 'Order received. Payment will be collected on pickup';
    if (paymentCollection === 'at_collection')
      return 'Order received. Payment will be collected when you finish (table or counter)';
    return 'Order received. Payment will be collected later';
  }
  if (
    stepStatus === 'placed' &&
    estimatedReadyTime &&
    currentStatus === 'placed' &&
    new Date(estimatedReadyTime).getTime() > Date.now()
  ) {
    return `Scheduled order confirmed for ${formatDateTime(estimatedReadyTime)}`;
  }
  if (stepStatus === 'ready') {
    if (fulfillmentType === 'delivery') return 'Your order is packed and ready for dispatch';
    if (fulfillmentType === 'dine_in') return 'Your order is ready to be served';
    return 'Your order is ready for pickup';
  }
  if (stepStatus === 'delivered') {
    if (fulfillmentType === 'delivery') return 'Delivered. Enjoy your meal!';
    if (fulfillmentType === 'dine_in') return 'Your meal has been served';
    return 'Order collected successfully';
  }
  return STATUS_STEP_CONTENT[stepStatus]?.description ?? 'Status update available';
}

function normalizeLabel(raw: unknown) {
  return String(raw || '—')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
