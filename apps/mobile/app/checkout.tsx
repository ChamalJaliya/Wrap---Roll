import React, { useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  computeCheckoutBreakdown,
  computeDeliveryFeeLkr,
  normalizeCheckoutVatRate,
  parseDeliveryJson,
  type CustomerAddress,
} from '@wrap-roll/contracts';
import {
  ListTile,
  ModernPanel,
  PrimaryButton,
  SecondaryButton,
  SoftPill,
  StickyFooter,
  SurfaceCard,
  TagChip,
  ui,
} from '@/components/mobile-ui';
import { MobileGradientHero, MOBILE_GRADIENT_HERO_OVERLAP } from '@/components/MobileGradientHero';
import { mobileTheme } from '@/constants/mobileTheme';
import { formatApiError } from '@/lib/api-error';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import {
  CouponApiService,
  CustomerApiService,
  LocationApiService,
  OrderService,
  SettingsApiService,
} from '@/services/api';
import { useMobileCartStore } from '@/store/useMobileCartStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Fulfillment = 'TAKEAWAY' | 'DINE_IN' | 'DELIVERY';
type OrderFor = 'SELF' | 'OTHER';
type PaymentMethod = 'payhere' | 'cash';

type NewAddressDraft = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

const emptyNewAddressDraft: NewAddressDraft = {
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  city: 'Colombo',
  postalCode: '',
  isDefault: true,
};

function parseCoord(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const cart = useMobileCartStore((s) => s.cart);
  const clearCart = useMobileCartStore((s) => s.clearCart);
  const updateQuantity = useMobileCartStore((s) => s.updateQuantity);
  const removeFromCart = useMobileCartStore((s) => s.removeFromCart);

  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('TAKEAWAY');
  const [orderFor, setOrderFor] = useState<OrderFor>('SELF');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('payhere');

  const [selfName, setSelfName] = useState('');
  const [selfPhone, setSelfPhone] = useState('');
  /** Signed-in profile email — persisted on Customer for invoice emails */
  const [sessionEmail, setSessionEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'NEW' | null>(null);
  const [newAddress, setNewAddress] = useState<NewAddressDraft>({ ...emptyNewAddressDraft });
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [deliveryAddressNote, setDeliveryAddressNote] = useState('');

  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeResults, setPlaceResults] = useState<Array<{ id: string; label: string }>>([]);
  const [placeSourceLabel, setPlaceSourceLabel] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [settings, customer, addr] = await Promise.all([
          SettingsApiService.getPublic().catch(() => null),
          CustomerApiService.sync().catch(() => null),
          CustomerApiService.getAddressBook().catch(() => []),
        ]);
        if (!mounted) return;
        setBusinessSettings(settings);
        const methods = settings?.paymentConfig?.methods;
        if (methods) {
          if (!methods.payhere && methods.cash) setPaymentMethod('cash');
          if (!methods.cash && methods.payhere) setPaymentMethod('payhere');
        }

        const baseName = String(customer?.name ?? '');
        const basePhone = String(customer?.phone ?? '');
        const baseEmail = String(customer?.email ?? '').trim();
        setSelfName(baseName);
        setSelfPhone(basePhone);
        setSessionEmail(baseEmail);
        setCustomerName(baseName);
        setCustomerPhone(basePhone);

        const list = Array.isArray(addr) ? (addr as CustomerAddress[]) : [];
        setAddresses(list);
        const def = list.find((a) => a.isDefault);
        setSelectedAddressId(def?.id ?? (list[0]?.id ?? 'NEW'));
      } finally {
        if (mounted) setBootLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAppliedCoupon(null);
    const ids = new Set(cart.map((line) => line.cartId));
    setExpandedLines((current) =>
      Object.fromEntries(Object.entries(current).filter(([cartId]) => ids.has(cartId))),
    );
  }, [cart]);

  useEffect(() => {
    if (fulfillment !== 'DELIVERY') {
      setDeliveryLat(null);
      setDeliveryLng(null);
      setPlaceQuery('');
      setPlaceResults([]);
      setPlaceSourceLabel(null);
    }
  }, [fulfillment]);

  useEffect(() => {
    if (selectedAddressId == null || selectedAddressId === 'NEW') return;
    const chosen = addresses.find((a) => a.id === selectedAddressId);
    if (!chosen) return;
    const lat = parseCoord(chosen.latitude);
    const lng = parseCoord(chosen.longitude);
    if (lat != null && lng != null) {
      setDeliveryLat(lat);
      setDeliveryLng(lng);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    let cancelled = false;
    const q = placeQuery.trim();
    if (fulfillment !== 'DELIVERY' || selectedAddressId !== 'NEW' || q.length < 3) {
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
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fulfillment, selectedAddressId, placeQuery]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.totalItemPrice * item.quantity, 0),
    [cart],
  );

  const deliveryRules = useMemo(
    () => parseDeliveryJson(businessSettings?.deliveryJson ?? null),
    [businessSettings],
  );

  const deliveryFeeResult = useMemo(
    () =>
      computeDeliveryFeeLkr(deliveryRules, {
        fulfillmentIsDelivery: fulfillment === 'DELIVERY',
        deliveryLat,
        deliveryLng,
      }),
    [deliveryRules, fulfillment, deliveryLat, deliveryLng],
  );

  const deliveryFee =
    fulfillment === 'DELIVERY' && deliveryRules.enabled && !deliveryFeeResult.error
      ? deliveryFeeResult.fee
      : 0;

  const breakdown = useMemo(
    () =>
      computeCheckoutBreakdown({
        subtotal,
        vatRate: normalizeCheckoutVatRate(businessSettings?.checkoutVatRate ?? 0.15),
        deliveryFee,
        discountAmount: appliedCoupon?.discountAmount ?? 0,
      }),
    [subtotal, businessSettings, deliveryFee, appliedCoupon],
  );

  const checkoutHeroStats = useMemo(() => {
    const mode =
      fulfillment === 'TAKEAWAY'
        ? ({ label: 'MODE' as const, value: 'Pickup', icon: 'shopping-bag' as const })
        : fulfillment === 'DINE_IN'
          ? ({ label: 'MODE' as const, value: 'Dine-in', icon: 'cutlery' as const })
          : ({ label: 'MODE' as const, value: 'Delivery', icon: 'truck' as const });
    return [
      { label: 'TOTAL', value: `LKR ${breakdown.total.toFixed(0)}`, icon: 'money' as const },
      { label: 'ITEMS', value: String(cart.length), icon: 'cube' as const },
      mode,
    ];
  }, [breakdown.total, cart.length, fulfillment]);

  const requestDeliveryLocation = async () => {
    if (fulfillment !== 'DELIVERY') return;
    try {
      setGeoBusy(true);
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location denied', 'Allow location access to calculate delivery fee.');
        return;
      }

      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Highest,
      });

      setDeliveryLat(pos.coords.latitude);
      setDeliveryLng(pos.coords.longitude);

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
        if (!deliveryAddressNote.trim()) {
          setDeliveryAddressNote(rev.formattedAddress || rev.addressLine1 || '');
        }
      } catch {
        // reverse geocode is optional
      }
    } catch {
      Alert.alert('Location unavailable', 'Could not capture location. Please try again.');
    } finally {
      setGeoBusy(false);
    }
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
      setNewAddress((s) => ({ ...s, addressLine1: s.addressLine1 || p.label }));
    } catch {
      Alert.alert('Place lookup failed', 'Could not resolve that place.');
    } finally {
      setPlaceBusy(false);
    }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const phone = (orderFor === 'SELF' ? selfPhone : customerPhone).trim();
    if (!phone) {
      Alert.alert('Phone required', 'Enter the receiver phone before applying coupon.');
      return;
    }

    try {
      setCouponBusy(true);
      const res = await CouponApiService.validate({
        code,
        subtotal,
        customerPhone: phone.replace(/\s+/g, ''),
      });
      if (!res.valid) {
        setAppliedCoupon(null);
        Alert.alert('Coupon invalid', res.message || 'Please try a different code.');
        return;
      }
      setAppliedCoupon({
        code,
        discountAmount: Number(res.discountAmount ?? 0),
      });
      setCouponInput(code);
      Alert.alert('Coupon applied', `${code} applied successfully.`);
    } catch {
      setAppliedCoupon(null);
      Alert.alert('Coupon invalid', 'Unable to validate this coupon right now.');
    } finally {
      setCouponBusy(false);
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty cart', 'Add items before checkout.');
      return;
    }

    const receiverName = orderFor === 'SELF' ? selfName.trim() : customerName.trim();
    const receiverPhone = orderFor === 'SELF' ? selfPhone.trim() : customerPhone.trim();
    if (!receiverName || !receiverPhone) {
      Alert.alert('Missing details', 'Please provide receiver name and phone.');
      return;
    }

    let finalDeliveryAddress: string | undefined;
    let effectiveDeliveryLat = deliveryLat;
    let effectiveDeliveryLng = deliveryLng;

    if (fulfillment === 'DELIVERY') {
      if (selectedAddressId && selectedAddressId !== 'NEW') {
        const selected = addresses.find((a) => a.id === selectedAddressId);
        if (selected) {
          finalDeliveryAddress = `${selected.addressLine1}${selected.addressLine2 ? `, ${selected.addressLine2}` : ''}, ${selected.city}${selected.postalCode ? ` ${selected.postalCode}` : ''}`;
          const savedLat = parseCoord(selected.latitude);
          const savedLng = parseCoord(selected.longitude);
          if (savedLat != null && savedLng != null) {
            effectiveDeliveryLat = savedLat;
            effectiveDeliveryLng = savedLng;
          }
        }
      } else {
        finalDeliveryAddress =
          deliveryAddressNote.trim() ||
          [
            newAddress.addressLine1.trim(),
            newAddress.addressLine2.trim(),
            newAddress.city.trim(),
            newAddress.postalCode.trim(),
          ]
            .filter(Boolean)
            .join(', ');
      }

      if (!finalDeliveryAddress) {
        Alert.alert('Address required', 'Please add your delivery address.');
        return;
      }

      if (deliveryRules.feeMode === 'distance') {
        const feeCheck = computeDeliveryFeeLkr(deliveryRules, {
          fulfillmentIsDelivery: true,
          deliveryLat: effectiveDeliveryLat,
          deliveryLng: effectiveDeliveryLng,
        });
        if (feeCheck.error === 'coords_required') {
          Alert.alert('Location required', 'Share your live location to calculate delivery fee.');
          return;
        }
        if (feeCheck.error === 'out_of_range') {
          Alert.alert('Out of range', 'This location is outside our delivery area.');
          return;
        }
        if (feeCheck.error === 'invalid_rules') {
          Alert.alert('Delivery unavailable', 'Delivery pricing is unavailable. Try takeaway.');
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (fulfillment === 'DELIVERY' && selectedAddressId === 'NEW' && saveNewAddress && newAddress.addressLine1.trim()) {
        const saved = await CustomerApiService.saveAddress({
          label: newAddress.label,
          addressLine1: newAddress.addressLine1.trim(),
          addressLine2: newAddress.addressLine2.trim() || null,
          city: newAddress.city.trim(),
          postalCode: newAddress.postalCode.trim() || null,
          latitude: effectiveDeliveryLat,
          longitude: effectiveDeliveryLng,
          geocodeSource: effectiveDeliveryLat != null ? 'device_location' : null,
          isDefault: Boolean(newAddress.isDefault),
        });
        if (saved?.id) {
          setSelectedAddressId(saved.id);
        }
      }

      const payload = {
        source: 'client_mobile',
        fulfillmentType: fulfillment,
        customerName: receiverName,
        customerPhone: receiverPhone,
        ...(sessionEmail.includes('@') ? { customerEmail: sessionEmail } : {}),
        paymentMethod,
        ...(appliedCoupon?.code ? { discountCode: appliedCoupon.code } : {}),
        deliveryAddress: fulfillment === 'DELIVERY' ? finalDeliveryAddress : undefined,
        ...(fulfillment === 'DELIVERY' && effectiveDeliveryLat != null && effectiveDeliveryLng != null
          ? {
              deliveryLatitude: effectiveDeliveryLat,
              deliveryLongitude: effectiveDeliveryLng,
            }
          : {}),
        items: cart.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          quantity: line.quantity,
          basePrice: line.basePrice,
          modifiers: line.modifiers,
          totalPrice: line.totalItemPrice * line.quantity,
        })),
        totalAmount: breakdown.total,
      };

      const res = await OrderService.createOrder(payload);
      const orderId = String(res.id || res.orderId || '').trim();
      if (!orderId) {
        throw new Error('Order created but order ID not returned.');
      }
      await AsyncStorage.setItem('last_order_id', orderId);
      await AsyncStorage.setItem('last_order_email', sessionEmail.trim());
      clearCart();
      // Match web: success page shows cashier QR + thank-you; user can open Track from there if needed.
      router.push(
        `/order/success?id=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(receiverPhone)}` as never,
      );
    } catch (e) {
      Alert.alert('Checkout failed', formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (bootLoading) {
    return (
      <View style={styles.screenRoot}>
        <MobileGradientHero
          insetsTop={insets.top}
          eyebrow={t(language, 'checkoutHeroEyebrow')}
          title={t(language, 'checkoutTitle')}
          hint={t(language, 'checkoutBootHint')}
          headerRight={null}
          stats={[
            { label: 'TOTAL', value: 'LKR —', icon: 'money' },
            { label: 'ITEMS', value: '—', icon: 'cube' },
            { label: 'MODE', value: '—', icon: 'shopping-bag' },
          ]}
        />
        <View style={styles.bootBody}>
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  if (cart.length === 0) {
    const emptyTips = [
      { icon: 'search' as const, text: t(language, 'checkoutEmptyTip1') },
      { icon: 'shopping-cart' as const, text: t(language, 'checkoutEmptyTip2') },
      { icon: 'unlock-alt' as const, text: t(language, 'checkoutEmptyTip3') },
    ];

    return (
      <View style={styles.screenRoot}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.emptyScroll, { paddingBottom: 32 + insets.bottom }]}
        >
          <MobileGradientHero
            insetsTop={insets.top}
            eyebrow={t(language, 'checkoutHeroEyebrow')}
            title={t(language, 'checkoutTitle')}
            hint={t(language, 'checkoutEmptyHint')}
            stats={[
              { label: 'TOTAL', value: 'LKR 0', icon: 'money' },
              { label: 'ITEMS', value: '0', icon: 'cube' },
              { label: 'MODE', value: '—', icon: 'shopping-bag' },
            ]}
          />
          <View style={styles.emptySheet}>
            <SurfaceCard style={styles.emptyCard}>
              <View style={styles.emptyIconBadge} accessibilityLabel={t(language, 'checkoutEmptyTitle')}>
                <FontAwesome name="shopping-basket" size={28} color={theme.colors.primaryDeep} />
              </View>
              <Text style={styles.emptyTitle}>{t(language, 'checkoutEmptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t(language, 'checkoutEmptySub')}</Text>
              <View style={styles.emptyTips}>
                {emptyTips.map((row, idx) => (
                  <View key={`tip-${idx}`} style={styles.emptyTipRow}>
                    <View style={styles.emptyTipGlyph}>
                      <FontAwesome name={row.icon} size={14} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.emptyTipText}>{row.text}</Text>
                  </View>
                ))}
              </View>
              <PrimaryButton
                label={t(language, 'checkoutEmptyBrowseMenu')}
                onPress={() => router.push('/(tabs)/menu')}
                style={styles.emptyPrimaryBtn}
              />
              <View style={styles.emptySecondaryWrap}>
                <SecondaryButton
                  label={t(language, 'checkoutEmptyBackHome')}
                  onPress={() => router.push('/(tabs)' as never)}
                  style={styles.emptySecondaryBtn}
                />
              </View>
            </SurfaceCard>
          </View>
        </ScrollView>
      </View>
    );
  }

  const contactStep = fulfillment === 'DELIVERY' ? 3 : 2;
  const paymentStep = fulfillment === 'DELIVERY' ? 4 : 3;
  const summaryStep = fulfillment === 'DELIVERY' ? 5 : 4;
  const cashMethodLabel =
    fulfillment === 'DELIVERY'
      ? 'Pay on delivery'
      : fulfillment === 'DINE_IN'
        ? 'Pay at counter'
        : 'Pay on pickup';

  return (
    <View style={styles.screenRoot}>
      <MobileGradientHero
        insetsTop={insets.top}
        eyebrow={t(language, 'checkoutHeroEyebrow')}
        title={t(language, 'checkoutTitle')}
        hint={t(language, 'checkoutHeroHint')}
        stats={checkoutHeroStats}
      />

      <ScrollView
        style={styles.scrollUnderHero}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <ModernPanel
          title="Step 1 · Order fulfillment"
          style={styles.stepCard}
        >
          <View style={styles.fulfillmentGrid}>
            {([
              { mode: 'TAKEAWAY' as const, label: 'Takeaway', icon: 'shopping-bag' as const },
              { mode: 'DINE_IN' as const, label: 'Dine-in', icon: 'cutlery' as const },
              { mode: 'DELIVERY' as const, label: 'Delivery', icon: 'motorcycle' as const },
            ]).map((option) => (
              <Pressable
                key={option.mode}
                style={[
                  styles.fulfillmentItem,
                  fulfillment === option.mode && styles.fulfillmentItemActive,
                ]}
                onPress={() => setFulfillment(option.mode)}
              >
                <FontAwesome
                  name={option.icon}
                  size={20}
                  color={fulfillment === option.mode ? theme.colors.primary : '#6b7280'}
                />
                <Text
                  style={[
                    styles.fulfillmentItemLabel,
                    fulfillment === option.mode && styles.fulfillmentItemLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ModernPanel>

        {fulfillment === 'DELIVERY' ? (
          <SurfaceCard style={styles.stepCard}>
            <StepHeader step={2} title="Delivery address" />

            {addresses.length ? (
              <View style={styles.addressList}>
                {addresses.map((a) => (
                  <Pressable
                    key={a.id}
                    style={[
                      styles.addressCard,
                      selectedAddressId === a.id && styles.addressCardActive,
                    ]}
                    onPress={() => setSelectedAddressId(String(a.id))}
                  >
                    <Text style={styles.addressLabel}>{a.label}</Text>
                    <Text style={styles.addressBody}>
                      {a.addressLine1}
                      {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                      {a.city ? `, ${a.city}` : ''}
                      {a.postalCode ? ` ${a.postalCode}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              style={[styles.addressCard, selectedAddressId === 'NEW' && styles.addressCardActive]}
              onPress={() => setSelectedAddressId('NEW')}
            >
              <Text style={styles.addressLabel}>Use a new address</Text>
            </Pressable>

            {selectedAddressId === 'NEW' || !addresses.length ? (
              <>
                <Text style={styles.label}>Label</Text>
                <TextInput
                  style={styles.input}
                  value={newAddress.label}
                  onChangeText={(v) => setNewAddress((s) => ({ ...s, label: v }))}
                  placeholder="Home / Work"
                />

                <Text style={styles.label}>Address line 1</Text>
                <TextInput
                  style={styles.input}
                  value={newAddress.addressLine1}
                  onChangeText={(v) => setNewAddress((s) => ({ ...s, addressLine1: v }))}
                  placeholder="Street and number"
                />

                <Text style={styles.label}>Address line 2 (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newAddress.addressLine2}
                  onChangeText={(v) => setNewAddress((s) => ({ ...s, addressLine2: v }))}
                  placeholder="Apartment / landmark"
                />

                <View style={styles.twoCol}>
                  <View style={styles.col}>
                    <Text style={styles.label}>City</Text>
                    <TextInput
                      style={styles.input}
                      value={newAddress.city}
                      onChangeText={(v) => setNewAddress((s) => ({ ...s, city: v }))}
                      placeholder="City"
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Postal code</Text>
                    <TextInput
                      style={styles.input}
                      value={newAddress.postalCode}
                      onChangeText={(v) => setNewAddress((s) => ({ ...s, postalCode: v }))}
                      placeholder="Postal"
                    />
                  </View>
                </View>

                <Pressable
                  style={styles.toggleRow}
                  onPress={() => setSaveNewAddress((v) => !v)}
                >
                  <View style={[styles.check, saveNewAddress && styles.checkOn]} />
                  <Text style={styles.toggleText}>Save this address to my profile</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>Address notes (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={deliveryAddressNote}
                  onChangeText={setDeliveryAddressNote}
                  placeholder="Gate code, call on arrival, etc."
                />
              </>
            )}

            {deliveryRules.feeMode === 'distance' ? (
              <View style={styles.locationPanel}>
                <Text style={styles.locationTitle}>Live location capture</Text>
                <Text style={styles.locationHelp}>
                  Share your location or search address to calculate distance-based delivery fee.
                </Text>

                {selectedAddressId === 'NEW' ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={placeQuery}
                      onChangeText={setPlaceQuery}
                      placeholder="Search area or landmark"
                    />

                    {placeBusy ? <Text style={styles.locationMeta}>Searching places...</Text> : null}
                    {placeResults.length ? (
                      <View style={styles.placeResults}>
                        {placeResults.map((row) => (
                          <Pressable
                            key={row.id}
                            style={styles.placeRow}
                            onPress={() => void applyPlaceSelection(row.id)}
                          >
                            <Text style={styles.placeRowText}>{row.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : null}

                <PrimaryButton
                  label={geoBusy ? 'Capturing location...' : 'Share live location'}
                  onPress={() => void requestDeliveryLocation()}
                  disabled={geoBusy || placeBusy}
                  style={styles.locationBtn}
                />

                {placeSourceLabel ? (
                  <Text style={styles.locationMeta}>Using selected location: {placeSourceLabel}</Text>
                ) : null}

                {deliveryLat != null && deliveryLng != null ? (
                  <View>
                    {deliveryFeeResult.error === 'out_of_range' ? (
                      <Text style={styles.locationWarn}>Outside delivery radius. Choose takeaway or closer address.</Text>
                    ) : deliveryFeeResult.error === 'invalid_rules' ? (
                      <Text style={styles.locationWarn}>Delivery pricing unavailable right now.</Text>
                    ) : (
                      <Text style={styles.locationMeta}>
                        Delivery fee: LKR {deliveryFeeResult.fee.toFixed(0)}
                        {typeof deliveryFeeResult.distanceKm === 'number'
                          ? ` · ${deliveryFeeResult.distanceKm.toFixed(1)} km`
                          : ''}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.locationMeta}>Location not set yet.</Text>
                )}
              </View>
            ) : null}
          </SurfaceCard>
        ) : null}

        <ModernPanel
          title={`Step ${contactStep} · Contact information`}
          style={styles.stepCard}
        >
          <View style={styles.segmentWrap}>
            <SoftPill label="For me" active={orderFor === 'SELF'} onPress={() => setOrderFor('SELF')} />
            <SoftPill
              label="For someone else"
              active={orderFor === 'OTHER'}
              onPress={() => setOrderFor('OTHER')}
            />
          </View>

          {orderFor === 'SELF' ? (
            <>
              <Text style={styles.label}>Your name</Text>
              <TextInput style={styles.input} value={selfName} onChangeText={setSelfName} placeholder="Your name" />
              <Text style={styles.label}>Your phone</Text>
              <TextInput
                style={styles.input}
                value={selfPhone}
                onChangeText={setSelfPhone}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Receiver name</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Receiver name"
              />
              <Text style={styles.label}>Receiver phone</Text>
              <TextInput
                style={styles.input}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="Receiver phone"
                keyboardType="phone-pad"
              />
            </>
          )}
        </ModernPanel>

        <ModernPanel
          title={`Step ${paymentStep} · Payment method`}
          subtitle="Choose your payment option"
          style={styles.stepCard}
        >
          <View style={styles.paymentMethodsRow}>
            <Pressable
              style={[
                styles.paymentOption,
                paymentMethod === 'payhere' && styles.paymentOptionActive,
                businessSettings?.paymentConfig?.methods?.payhere === false && styles.paymentOptionDisabled,
              ]}
              onPress={() => setPaymentMethod('payhere')}
              disabled={businessSettings?.paymentConfig?.methods?.payhere === false}
            >
              <Text
                style={[
                  styles.paymentOptionText,
                  paymentMethod === 'payhere' && styles.paymentOptionTextActive,
                ]}
              >
                PayHere (online)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.paymentOption,
                paymentMethod === 'cash' && styles.paymentOptionActive,
                businessSettings?.paymentConfig?.methods?.cash === false && styles.paymentOptionDisabled,
              ]}
              onPress={() => setPaymentMethod('cash')}
              disabled={businessSettings?.paymentConfig?.methods?.cash === false}
            >
              <Text
                style={[
                  styles.paymentOptionText,
                  paymentMethod === 'cash' && styles.paymentOptionTextActive,
                ]}
              >
                {cashMethodLabel}
              </Text>
            </Pressable>
          </View>
        </ModernPanel>

        <ModernPanel
          title={`Step ${summaryStep} · Order summary`}
          subtitle="Review items and totals"
          right={<TagChip label={`${cart.length} item${cart.length > 1 ? 's' : ''}`} tone="accent" />}
          style={[styles.stepCard, styles.summaryCard]}
        >
          {cart.map((line) => {
            const isExpanded = Boolean(expandedLines[line.cartId]);
            const modifiers = line.modifiers
              .filter((m) => m.options.length > 0)
              .map((m) => `${m.name}: ${m.options.map((o) => o.label).join(', ')}`);
            return (
              <View key={line.cartId} style={styles.orderLineCard}>
                <ListTile
                  icon="shopping-bag"
                  title={`${line.quantity}x ${line.name}`}
                  subtitle={modifiers[0] ?? 'No customizations'}
                  right={<Text style={styles.orderLinePrice}>LKR {(line.totalItemPrice * line.quantity).toFixed(0)}</Text>}
                />

                {isExpanded && modifiers.length ? (
                  modifiers.map((text) => (
                    <Text key={`${line.cartId}-${text}`} style={styles.orderLineMeta}>
                      {text}
                    </Text>
                  ))
                ) : modifiers[0] ? (
                  <Text style={styles.orderLineMeta}>{modifiers[0]}</Text>
                ) : null}

                {modifiers.length > 1 ? (
                  <Pressable
                    style={styles.expandBtn}
                    onPress={() => setExpandedLines((s) => ({ ...s, [line.cartId]: !s[line.cartId] }))}
                  >
                    <Text style={styles.expandBtnText}>
                      {isExpanded ? 'Hide breakdown' : `Show breakdown (${modifiers.length})`}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={styles.orderLineActions}>
                  <View style={styles.qtyGroup}>
                    <Pressable style={styles.qtyBtn} onPress={() => updateQuantity(line.cartId, line.quantity - 1)}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <Pressable style={styles.qtyBtn} onPress={() => updateQuantity(line.cartId, line.quantity + 1)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.removeBtn} onPress={() => removeFromCart(line.cartId)}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          <View style={styles.promoRow}>
            <TextInput
              value={couponInput}
              onChangeText={(v) => setCouponInput(v.toUpperCase())}
              placeholder="Promo code"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.promoInput}
            />
            <Pressable
              style={[styles.promoApplyBtn, couponBusy && styles.promoApplyBtnDisabled]}
              onPress={() => void applyCoupon()}
              disabled={couponBusy}
            >
              <Text style={styles.promoApplyText}>{couponBusy ? 'Applying...' : 'Apply'}</Text>
            </Pressable>
          </View>
          {appliedCoupon ? (
            <View style={styles.appliedCouponRow}>
              <Text style={styles.appliedCouponText}>
                Coupon {appliedCoupon.code} applied (LKR {appliedCoupon.discountAmount.toFixed(0)} off)
              </Text>
              <Pressable onPress={() => setAppliedCoupon(null)}>
                <Text style={styles.removeCouponText}>Remove</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.breakdownWrap}>
            <ListTile icon="calculator" title="Subtotal" right={<Text style={styles.breakValue}>LKR {breakdown.subtotal.toFixed(0)}</Text>} />
            <ListTile icon="percent" title="VAT" right={<Text style={styles.breakValue}>LKR {breakdown.tax.toFixed(0)}</Text>} />
            {fulfillment === 'DELIVERY' ? (
              <ListTile icon="truck" title="Delivery" right={<Text style={styles.breakValue}>LKR {breakdown.deliveryFee.toFixed(0)}</Text>} />
            ) : null}
            {breakdown.discountAmount > 0 ? (
              <ListTile icon="tag" title="Discount" right={<Text style={styles.discountValue}>-LKR {breakdown.discountAmount.toFixed(0)}</Text>} />
            ) : null}
          </View>
        </ModernPanel>
      </ScrollView>

      <StickyFooter>
        <View style={styles.stickyFooterRow}>
          <View>
            <Text style={styles.stickyFooterLabel}>Total</Text>
            <Text style={styles.stickyFooterValue}>LKR {breakdown.total.toFixed(0)}</Text>
          </View>
          <PrimaryButton
            label={loading ? 'Placing order...' : 'Proceed to payment'}
            onPress={() => void placeOrder()}
            disabled={loading}
            style={styles.stickyFooterBtn}
          />
        </View>
      </StickyFooter>
    </View>
  );
}

function StepHeader({
  step,
  title,
}: {
  step: number;
  title: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{step}</Text>
      </View>
      <Text style={styles.stepTitle}>Step {step} · {title}</Text>
    </View>
  );
}

const theme = mobileTheme;

const styles = StyleSheet.create({
  screenRoot: { flex: 1, width: '100%', backgroundColor: ui.bg },
  scrollUnderHero: {
    flex: 1,
    marginTop: -MOBILE_GRADIENT_HERO_OVERLAP,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 132,
    gap: 12,
  },
  emptyScroll: { flexGrow: 1 },
  /** Match cart empty `sheet`: pull content under hero curve; zIndex keeps card above hero overlap. */
  emptySheet: {
    marginTop: -MOBILE_GRADIENT_HERO_OVERLAP,
    paddingHorizontal: 16,
    gap: 16,
    zIndex: 1,
  },
  bootBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stepCard: {
    paddingVertical: 14,
    borderRadius: 18,
    borderColor: '#e5e7eb',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepTitle: { flex: 1, fontSize: 21, fontWeight: '900', color: ui.text },

  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.warningBg,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 14, fontSize: 21, fontWeight: '900', color: ui.text, textAlign: 'center' },
  emptySubtitle: {
    marginTop: 10,
    color: ui.subtext,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
    fontWeight: '500',
  },
  emptyTips: { marginTop: 18, width: '100%', gap: 12 },
  emptyTipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  emptyTipGlyph: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  emptyTipText: { flex: 1, color: ui.text, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  emptyPrimaryBtn: { marginTop: 22, width: '100%' },
  emptySecondaryWrap: { marginTop: 10, width: '100%', alignItems: 'stretch' },
  emptySecondaryBtn: { width: '100%' },

  label: {
    fontSize: 12,
    fontWeight: '800',
    color: ui.subtext,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: '#f9fafb',
    fontSize: 15.5,
  },
  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentMethodsRow: { flexDirection: 'row', gap: 10 },
  paymentOption: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  paymentOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#fff7ed',
  },
  paymentOptionDisabled: {
    opacity: 0.45,
  },
  paymentOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
  },
  paymentOptionTextActive: {
    color: theme.colors.primaryDeep,
  },
  fulfillmentGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  fulfillmentItem: {
    flex: 1,
    minWidth: '30%',
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fulfillmentItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#fff7ed',
  },
  fulfillmentItemLabel: { color: '#4b5563', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  fulfillmentItemLabelActive: { color: theme.colors.primaryDeep },

  addressList: { gap: 8, marginBottom: 8 },
  addressCard: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    padding: 11,
  },
  addressCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#fff7ed',
  },
  addressLabel: { fontWeight: '700', color: ui.text },
  addressBody: { marginTop: 4, color: ui.subtext, lineHeight: 19 },

  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#fff',
  },
  checkOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toggleText: { color: ui.subtext, fontSize: 13, fontWeight: '600' },

  locationPanel: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warningBg,
    padding: 10,
    gap: 8,
  },
  locationTitle: { fontSize: 14, fontWeight: '800', color: ui.text },
  locationHelp: { color: '#7c2d12', fontSize: 12, lineHeight: 17 },
  locationBtn: { marginTop: 2 },
  locationMeta: { fontSize: 12, color: '#6b7280' },
  locationWarn: { fontSize: 12, fontWeight: '700', color: '#92400e' },

  placeResults: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  placeRow: { paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderSoft },
  placeRowText: { color: ui.text, fontSize: 13 },

  summaryCard: { borderColor: '#fed7aa', backgroundColor: '#fffaf5' },
  orderLineCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 11,
    marginBottom: 8,
  },
  orderLineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  orderLineName: { flex: 1, color: ui.text, fontWeight: '700' },
  orderLinePrice: { color: theme.colors.primaryDeep, fontWeight: '800' },
  orderLineMeta: { marginTop: 3, color: ui.subtext, fontSize: 12 },
  expandBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandBtnText: { fontSize: 12, color: theme.colors.primary, fontWeight: '700' },
  orderLineActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: ui.text },
  qtyValue: { minWidth: 16, textAlign: 'center', fontWeight: '800', color: ui.text },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  removeBtnText: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },
  promoRow: { marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  promoApplyBtn: {
    minWidth: 84,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  promoApplyBtnDisabled: { opacity: 0.65 },
  promoApplyText: { color: theme.colors.primaryDeep, fontWeight: '800', fontSize: 13 },
  appliedCouponRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  appliedCouponText: { flex: 1, color: '#166534', fontSize: 12, fontWeight: '700' },
  removeCouponText: { color: '#15803d', fontSize: 12, fontWeight: '800' },

  breakdownWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 10,
    gap: 4,
  },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakLabel: { color: ui.subtext },
  breakValue: { color: ui.text, fontWeight: '600' },
  discountLabel: { color: '#166534', fontWeight: '700' },
  discountValue: { color: '#166534', fontWeight: '800' },

  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 16, fontWeight: '800', color: ui.text },
  totalValue: { fontSize: 24, fontWeight: '900', color: theme.colors.primaryDeep },
  checkoutBtn: { marginTop: 12 },
  stickyFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  stickyFooterLabel: { color: ui.subtext, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  stickyFooterValue: { color: ui.text, fontSize: 24, fontWeight: '900' },
  stickyFooterBtn: { minWidth: 190, minHeight: 50, borderRadius: 14 },
});
