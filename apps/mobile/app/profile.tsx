import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CustomerHistoryOrder } from '@wrap-roll/contracts';
import { ListTile, PrimaryButton, SurfaceCard, TagChip, ui } from '@/components/mobile-ui';
import { HeaderAccountCartActions } from '@/components/HeaderAccountCartActions';
import { BrandLoader } from '@/components/BrandLoader';
import { AuthTextField } from '@/features/auth/AuthChrome';
import { mobileTheme } from '@/constants/mobileTheme';
import { useHideTabBarWhileFocused } from '@/hooks/useHideTabBarWhileFocused';
import { CustomerApiService } from '@/services/api';
import { formatApiError } from '@/lib/api-error';

type AddressDraft = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

type CardDraft = {
  id: string;
  token: string;
  cardBrand: string;
  last4: string;
  isDefault: boolean;
};

const EMPTY_ADDRESS: AddressDraft = {
  id: '',
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  city: 'Colombo',
  postalCode: '',
  isDefault: false,
};

const EMPTY_CARD: CardDraft = {
  id: '',
  token: '',
  cardBrand: '',
  last4: '',
  isDefault: false,
};

const theme = mobileTheme.colors;

function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionIconBg}>
        <FontAwesome name={icon} size={15} color={theme.primaryDeep} />
      </View>
      <View style={styles.sectionHeadText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.sectionRight}>{right}</View> : null}
    </View>
  );
}

function PillAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pillAction, pressed && styles.pillActionPressed]}>
      <Text style={styles.pillActionText}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useHideTabBarWhileFocused();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [history, setHistory] = useState<CustomerHistoryOrder[]>([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [cardDraft, setCardDraft] = useState<CardDraft>(EMPTY_CARD);

  const loadData = async () => {
    try {
      const [profile, addressBook, savedCards, orderHistory] = await Promise.all([
        CustomerApiService.getProfile().catch(() => null),
        CustomerApiService.getAddressBook().catch(() => []),
        CustomerApiService.getSavedCards().catch(() => []),
        CustomerApiService.getHistory().catch(() => []),
      ]);
      setName(String(profile?.name ?? ''));
      setPhone(String(profile?.phone ?? ''));
      setAddresses(Array.isArray(addressBook) ? addressBook : []);
      setCards(Array.isArray(savedCards) ? savedCards : []);
      setHistory(Array.isArray(orderHistory) ? orderHistory : []);
    } catch (e) {
      setNotice(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveProfile = async () => {
    setNotice('');
    setSavingProfile(true);
    try {
      await CustomerApiService.updateProfile({ name: name.trim(), phone: phone.trim() });
      setNotice('Profile updated.');
      await loadData();
    } catch (e) {
      setNotice(formatApiError(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const openAddressCreate = () => {
    setAddressDraft(EMPTY_ADDRESS);
    setShowAddressEditor(true);
  };

  const openAddressEdit = (address: any) => {
    setAddressDraft({
      id: String(address?.id || ''),
      label: String(address?.label || 'Home'),
      addressLine1: String(address?.addressLine1 || ''),
      addressLine2: String(address?.addressLine2 || ''),
      city: String(address?.city || ''),
      postalCode: String(address?.postalCode || ''),
      isDefault: Boolean(address?.isDefault),
    });
    setShowAddressEditor(true);
  };

  const toggleAddressEditor = () => {
    if (showAddressEditor) {
      setShowAddressEditor(false);
      setAddressDraft(EMPTY_ADDRESS);
    } else {
      openAddressCreate();
    }
  };

  const saveAddress = async () => {
    if (!addressDraft.label.trim() || !addressDraft.addressLine1.trim() || !addressDraft.city.trim()) {
      setNotice('Address label, line 1 and city are required.');
      return;
    }
    setNotice('');
    setSavingAddress(true);
    try {
      await CustomerApiService.saveAddress({
        ...(addressDraft.id ? { id: addressDraft.id } : {}),
        label: addressDraft.label.trim(),
        addressLine1: addressDraft.addressLine1.trim(),
        addressLine2: addressDraft.addressLine2.trim() || null,
        city: addressDraft.city.trim(),
        postalCode: addressDraft.postalCode.trim() || null,
        isDefault: addressDraft.isDefault,
        latitude: null,
        longitude: null,
        geocodeSource: null,
      });
      setNotice(addressDraft.id ? 'Address updated.' : 'Address added.');
      setShowAddressEditor(false);
      setAddressDraft(EMPTY_ADDRESS);
      await loadData();
    } catch (e) {
      setNotice(formatApiError(e));
    } finally {
      setSavingAddress(false);
    }
  };

  const openCardCreate = () => {
    setCardDraft(EMPTY_CARD);
    setShowCardEditor(true);
  };

  const openCardEdit = (card: any) => {
    setCardDraft({
      id: String(card?.id || ''),
      token: String(card?.token || ''),
      cardBrand: String(card?.cardBrand || ''),
      last4: String(card?.last4 || ''),
      isDefault: Boolean(card?.isDefault),
    });
    setShowCardEditor(true);
  };

  const toggleCardEditor = () => {
    if (showCardEditor) {
      setShowCardEditor(false);
      setCardDraft(EMPTY_CARD);
    } else {
      openCardCreate();
    }
  };

  const saveCard = async () => {
    const brand = cardDraft.cardBrand.trim();
    const last4 = cardDraft.last4.trim();
    if (!brand || !/^\d{4}$/.test(last4)) {
      setNotice('Card brand and exactly 4 last digits are required.');
      return;
    }
    setNotice('');
    setSavingCard(true);
    try {
      await CustomerApiService.saveCard({
        ...(cardDraft.id ? { id: cardDraft.id } : {}),
        token: cardDraft.token.trim() || `manual_${Date.now()}`,
        cardBrand: brand,
        last4,
        isDefault: cardDraft.isDefault,
      });
      setNotice(cardDraft.id ? 'Card updated.' : 'Card added.');
      setShowCardEditor(false);
      setCardDraft(EMPTY_CARD);
      await loadData();
    } catch (e) {
      setNotice(formatApiError(e));
    } finally {
      setSavingCard(false);
    }
  };

  const openTrack = (orderId?: string) => {
    const id = String(orderId || '').trim();
    if (!id) return;
    const phoneValue = phone.trim();
    const query = phoneValue
      ? `/order/track?id=${encodeURIComponent(id)}&phone=${encodeURIComponent(phoneValue)}`
      : `/order/track?id=${encodeURIComponent(id)}`;
    if (!phoneValue) {
      setNotice('Add your phone in profile for one-tap tracking.');
    }
    router.push(query as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]} edges={['left', 'right', 'top']}>
        <BrandLoader title="Loading profile" subtitle="Fetching your account…" compact />
      </SafeAreaView>
    );
  }

  const displayName = name.trim() || 'Your profile';

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#fb923c', '#ea580c', '#7c2d12', '#1c1917']}
          locations={[0, 0.4, 0.78, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGrad}
        >
          <View style={styles.heroDecor} pointerEvents="none" />
          <View style={[styles.heroTopRow, { paddingTop: insets.top + 2 }]}>
            <Text style={styles.heroEyebrow} numberOfLines={1}>
              YOUR DASHBOARD
            </Text>
            <HeaderAccountCartActions variant="hero" />
          </View>
          <Text style={styles.heroName} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.heroHint}>Keep contact info fresh for faster pickup & tracking.</Text>
          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <View style={styles.statOrb}>
                <FontAwesome name="list-alt" size={14} color={theme.primaryText} />
              </View>
              <View style={styles.statTextCol}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  ORDERS
                </Text>
                <Text style={styles.statValue}>{history.length}</Text>
              </View>
            </View>
            <View style={styles.statTile}>
              <View style={styles.statOrb}>
                <FontAwesome name="map-marker" size={14} color={theme.primaryText} />
              </View>
              <View style={styles.statTextCol}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  PLACES
                </Text>
                <Text style={styles.statValue}>{addresses.length}</Text>
              </View>
            </View>
            <View style={styles.statTile}>
              <View style={styles.statOrb}>
                <FontAwesome name="credit-card" size={13} color={theme.primaryText} />
              </View>
              <View style={styles.statTextCol}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  CARDS
                </Text>
                <Text style={styles.statValue}>{cards.length}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sheet}>
          {notice ? (
            <View style={styles.notice}>
              <FontAwesome name="info-circle" size={16} color={theme.warningText} style={styles.noticeIcon} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <SurfaceCard style={styles.cardLift}>
            <SectionHeader
              icon="user"
              title="Profile details"
              subtitle="Used for receipts, pickup, and order tracking."
            />
            <View style={styles.cardBodyGap}>
              <AuthTextField
                label="Full name"
                icon="user"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoComplete="name"
                textContentType="name"
              />
              <AuthTextField
                label="Phone number"
                icon="phone"
                isLast
                value={phone}
                onChangeText={setPhone}
                placeholder="For SMS & tracking"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
              <PrimaryButton
                label={savingProfile ? 'Saving…' : 'Save profile'}
                onPress={saveProfile}
                disabled={savingProfile}
              />
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionHeader
              icon="clock-o"
              title="Order history"
              subtitle="Tap an order to open live tracking."
            />
            <View style={styles.cardBodyGap}>
              {history.length === 0 ? <Text style={styles.muted}>No orders yet.</Text> : null}
              {history.slice(0, 8).map((o) => (
                <View key={o.id} style={styles.orderCard}>
                  <ListTile
                    icon="clock-o"
                    title={`#${String(o.id).slice(0, 8)} · LKR ${toLkr(o.total)}`}
                    subtitle={`${formatPlacedAt(o.placedAt)} · ${normalizeLabel(o.fulfillmentType)}`}
                    right={<TagChip label={normalizeLabel(o.status)} tone="accent" />}
                    onPress={() => openTrack(o.id)}
                  />
                  <Pressable style={styles.trackBtn} onPress={() => openTrack(o.id)}>
                    <FontAwesome name="location-arrow" size={12} color={theme.primaryDeep} />
                    <Text style={styles.trackBtnText}>Track order</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionHeader
              icon="map-marker"
              title="Address book"
              subtitle={`${addresses.length} saved`}
              right={<PillAction label={showAddressEditor ? 'Close' : 'Add'} onPress={toggleAddressEditor} />}
            />
            <View style={styles.cardBodyGap}>
              {showAddressEditor ? (
                <View style={styles.editor}>
                  <Text style={styles.editorTitle}>{addressDraft.id ? 'Edit address' : 'New address'}</Text>
                  <Text style={[styles.label, styles.labelFirst]}>Label</Text>
                  <TextInput
                    style={styles.input}
                    value={addressDraft.label}
                    onChangeText={(v) => setAddressDraft((s) => ({ ...s, label: v }))}
                    placeholder="Home, Work…"
                  />
                  <Text style={styles.label}>Line 1</Text>
                  <TextInput
                    style={styles.input}
                    value={addressDraft.addressLine1}
                    onChangeText={(v) => setAddressDraft((s) => ({ ...s, addressLine1: v }))}
                    placeholder="Street & number"
                  />
                  <Text style={styles.label}>Line 2 (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={addressDraft.addressLine2}
                    onChangeText={(v) => setAddressDraft((s) => ({ ...s, addressLine2: v }))}
                    placeholder="Apt, floor, landmark"
                  />
                  <View style={styles.splitRow}>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      value={addressDraft.city}
                      onChangeText={(v) => setAddressDraft((s) => ({ ...s, city: v }))}
                      placeholder="City"
                    />
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      value={addressDraft.postalCode}
                      onChangeText={(v) => setAddressDraft((s) => ({ ...s, postalCode: v }))}
                      placeholder="Postal code"
                    />
                  </View>
                  <View style={[styles.splitRow, styles.editorToggleRow]}>
                    <Pressable
                      style={[styles.toggleBtn, addressDraft.isDefault && styles.toggleBtnActive]}
                      onPress={() => setAddressDraft((s) => ({ ...s, isDefault: !s.isDefault }))}
                    >
                      <Text style={[styles.toggleBtnText, addressDraft.isDefault && styles.toggleBtnTextActive]}>
                        {addressDraft.isDefault ? 'Default address' : 'Set as default'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.toggleBtn}
                      onPress={() => {
                        setAddressDraft(EMPTY_ADDRESS);
                        setShowAddressEditor(false);
                      }}
                    >
                      <Text style={styles.toggleBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                  <View style={styles.editorActions}>
                    <PrimaryButton
                      label={savingAddress ? 'Saving…' : addressDraft.id ? 'Update address' : 'Save address'}
                      onPress={saveAddress}
                      disabled={savingAddress}
                    />
                  </View>
                </View>
              ) : null}

              {addresses.length === 0 && !showAddressEditor ? <Text style={styles.muted}>No saved addresses yet.</Text> : null}
              {addresses.map((a, idx) => (
                <ListTile
                  key={a.id || idx}
                  icon="map-marker"
                  title={String(a.label || 'Address')}
                  subtitle={`${a.addressLine1}${a.addressLine2 ? `, ${a.addressLine2}` : ''}${a.city ? `, ${a.city}` : ''}`}
                  right={
                    <Pressable onPress={() => openAddressEdit(a)} hitSlop={8}>
                      <Text style={styles.link}>Edit</Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionHeader
              icon="credit-card"
              title="Saved cards"
              subtitle={`${cards.length} on file`}
              right={<PillAction label={showCardEditor ? 'Close' : 'Add'} onPress={toggleCardEditor} />}
            />
            <View style={styles.cardBodyGap}>
              {showCardEditor ? (
                <View style={styles.editor}>
                  <Text style={styles.editorTitle}>{cardDraft.id ? 'Edit card' : 'Add card'}</Text>
                  <Text style={[styles.label, styles.labelFirst]}>Brand</Text>
                  <TextInput
                    style={styles.input}
                    value={cardDraft.cardBrand}
                    onChangeText={(v) => setCardDraft((s) => ({ ...s, cardBrand: v }))}
                    placeholder="VISA, MasterCard…"
                    autoCapitalize="characters"
                  />
                  <Text style={styles.label}>Last 4 digits</Text>
                  <View style={[styles.splitRow, styles.cardLast4Row]}>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      value={cardDraft.last4}
                      onChangeText={(v) => setCardDraft((s) => ({ ...s, last4: v.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="Last 4 digits"
                      keyboardType="number-pad"
                    />
                    <Pressable
                      style={[styles.toggleBtn, styles.toggleGrow, cardDraft.isDefault && styles.toggleBtnActive]}
                      onPress={() => setCardDraft((s) => ({ ...s, isDefault: !s.isDefault }))}
                    >
                      <Text style={[styles.toggleBtnText, cardDraft.isDefault && styles.toggleBtnTextActive]}>
                        {cardDraft.isDefault ? 'Default' : 'Set default'}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[styles.splitRow, styles.editorCardSaveRow]}>
                    <PrimaryButton
                      label={savingCard ? 'Saving…' : cardDraft.id ? 'Update card' : 'Save card'}
                      onPress={saveCard}
                      disabled={savingCard}
                      style={styles.flexOne}
                    />
                    <Pressable
                      style={styles.toggleBtn}
                      onPress={() => {
                        setCardDraft(EMPTY_CARD);
                        setShowCardEditor(false);
                      }}
                    >
                      <Text style={styles.toggleBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {cards.length === 0 && !showCardEditor ? <Text style={styles.muted}>No saved cards yet.</Text> : null}
              {cards.map((c, idx) => (
                <ListTile
                  key={c.id || idx}
                  icon="credit-card"
                  title={`${c.cardBrand || 'Card'} •••• ${c.last4 || '----'}`}
                  subtitle={c.isDefault ? 'Default payment method' : 'Saved payment method'}
                  right={
                    <View style={styles.inlineEnd}>
                      {c.isDefault ? <TagChip label="Default" tone="success" /> : null}
                      <Pressable onPress={() => openCardEdit(c)} hitSlop={8}>
                        <Text style={styles.link}>Edit</Text>
                      </Pressable>
                    </View>
                  }
                />
              ))}
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function toLkr(value: number | string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(0);
}

function formatPlacedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizeLabel(value: unknown) {
  return String(value || 'Unknown')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1 },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    paddingRight: 0,
  },
  heroGrad: {
    marginHorizontal: 0,
    paddingHorizontal: 18,
    paddingBottom: 88,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -50,
    right: -40,
  },
  heroEyebrow: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 1.3,
  },
  heroName: { fontSize: 26, fontWeight: '900', color: '#fff', lineHeight: 30, letterSpacing: -0.3 },
  heroHint: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 340,
  },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  statTextCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.35,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 2 },
  sheet: {
    marginTop: -64,
    paddingHorizontal: 18,
    gap: 16,
  },
  cardLift: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  sectionIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${theme.primary}33`,
  },
  sectionHeadText: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: ui.text },
  sectionSub: { marginTop: 3, fontSize: 12, color: theme.subtext, fontWeight: '600', lineHeight: 17 },
  sectionRight: { justifyContent: 'center', minHeight: 38 },
  cardBodyGap: { marginTop: 14, gap: 0 },
  pillAction: {
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActionPressed: { opacity: 0.85, backgroundColor: theme.surfaceHighlight },
  pillActionText: { fontSize: 12, fontWeight: '900', color: theme.primaryDeep },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.warningBg,
    borderWidth: 1,
    borderColor: theme.warningBorder,
  },
  noticeIcon: { marginTop: 2 },
  noticeText: { flex: 1, fontSize: 14, color: theme.warningText, fontWeight: '600', lineHeight: 20 },
  muted: { fontSize: 14, color: theme.subtext, fontWeight: '500' },
  orderCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
    borderRadius: 14,
    backgroundColor: theme.card,
    overflow: 'hidden',
    marginBottom: 10,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.surfaceMuted,
  },
  trackBtnText: { fontSize: 13, fontWeight: '900', color: theme.primaryDeep },
  editor: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginBottom: 12,
    marginTop: 4,
    backgroundColor: '#fffdfb',
    gap: 0,
  },
  editorTitle: { fontSize: 16, fontWeight: '900', color: ui.text, marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.subtext,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelFirst: { marginTop: 0 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    marginBottom: 4,
    backgroundColor: theme.surfaceMuted,
    fontSize: 16,
    color: theme.text,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 8,
  },
  halfInput: { flex: 1, minWidth: 120 },
  flexOne: { flex: 1 },
  editorActions: { marginTop: 4 },
  editorToggleRow: { marginTop: 14 },
  cardLast4Row: { marginTop: 6, marginBottom: 4 },
  editorCardSaveRow: { marginTop: 16 },
  toggleBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  toggleGrow: { flex: 1, minWidth: 120 },
  toggleBtnActive: { borderColor: theme.primary, backgroundColor: '#fff7ed' },
  toggleBtnText: { fontSize: 12, color: ui.text, fontWeight: '700' },
  toggleBtnTextActive: { color: theme.primaryDeep },
  link: { color: theme.primaryDeep, fontWeight: '800' },
  inlineEnd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
