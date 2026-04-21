import React from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileGradientHero, MOBILE_GRADIENT_HERO_OVERLAP } from '@/components/MobileGradientHero';
import { PrimaryButton, SurfaceCard, ui } from '@/components/mobile-ui';
import { mobileTheme } from '@/constants/mobileTheme';
import { cartSubtitle, t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import { useMobileCartStore } from '@/store/useMobileCartStore';

const theme = mobileTheme.colors;

const HERO_OVERLAP = MOBILE_GRADIENT_HERO_OVERLAP;

/** Space for fixed bottom checkout bar + home indicator (scroll ends above it). */
const FOOTER_SCROLL_PAD = 248;

/** Line items sit inset from screen edges so cards read as floating tiles. */
const LIST_INSET_X = 16;
const CARD_GAP = 12;

export default function CartScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const cart = useMobileCartStore((s) => s.cart);
  const updateQuantity = useMobileCartStore((s) => s.updateQuantity);
  const removeFromCart = useMobileCartStore((s) => s.removeFromCart);
  const clearCart = useMobileCartStore((s) => s.clearCart);
  const total = useMobileCartStore((s) => s.getTotalPrice());

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const lineCount = cart.length;
  const hasItems = cart.length > 0;

  const scrollPadBottom = FOOTER_SCROLL_PAD + insets.bottom;

  const heroStats = [
    { label: 'ITEMS', value: String(itemCount), icon: 'cube' as const },
    { label: 'LINES', value: String(lineCount), icon: 'list-ul' as const },
    { label: 'TOTAL', value: `LKR ${total.toFixed(0)}`, icon: 'money' as const },
  ];

  return (
    <View style={styles.root}>
      {!hasItems ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.emptyScroll, { paddingBottom: 24 + insets.bottom }]}
          contentInsetAdjustmentBehavior="never"
        >
          <MobileGradientHero
            insetsTop={insets.top}
            eyebrow={t(language, 'cartHeroEyebrow')}
            title={t(language, 'cartTitle')}
            hint={cartSubtitle(language, itemCount)}
            stats={heroStats}
          />
          <View style={styles.sheet}>
            <SurfaceCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptyText}>Go to Menu and add wraps, bowls, and sides to place your order.</Text>
              <PrimaryButton label="Browse menu" onPress={() => router.push('/(tabs)/menu')} style={styles.emptyBtn} />
            </SurfaceCard>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.mainColumn}>
          <MobileGradientHero
            insetsTop={insets.top}
            eyebrow={t(language, 'cartHeroEyebrow')}
            title={t(language, 'cartTitle')}
            hint={cartSubtitle(language, itemCount)}
            stats={heroStats}
          />
          <FlatList
            data={cart}
            keyExtractor={(i) => i.cartId}
            style={[styles.listFlex, styles.listOverlap]}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: scrollPadBottom }]}
            renderItem={({ item }) => (
              <SurfaceCard style={styles.card}>
                  <View style={styles.rowTop}>
                    <View style={styles.itemMain}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <FontAwesome name="cutlery" size={16} color="#9ca3af" />
                        </View>
                      )}
                      <View style={styles.rowTitleWrap}>
                        <Text style={styles.name} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.unitPrice}>LKR {item.totalItemPrice.toFixed(0)} each</Text>
                      </View>
                    </View>
                    <View style={styles.rightActions}>
                      <Pressable style={styles.deleteBtn} onPress={() => removeFromCart(item.cartId)}>
                        <FontAwesome name="trash-o" size={16} color="#b91c1c" />
                      </Pressable>
                      <Text style={styles.linePrice}>LKR {(item.totalItemPrice * item.quantity).toFixed(0)}</Text>
                    </View>
                  </View>

                  {item.modifiers.some((m) => m.options.length > 0) ? (
                    <View style={styles.modsWrap}>
                      <Text style={styles.modsLabel}>Customizations</Text>
                      {item.modifiers
                        .filter((m) => m.options.length)
                        .map((m) => ({
                          key: `${m.groupId}`,
                          text: `${m.name}: ${m.options.map((o) => o.label).join(', ')}`,
                        }))
                        .map((line) => (
                          <Text key={line.key} style={styles.modRow} numberOfLines={1}>
                            {line.text}
                          </Text>
                        ))}
                    </View>
                  ) : null}

                  <View style={styles.qtyRow}>
                    <Text style={styles.qtyLabel}>Quantity</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepperBtn} onPress={() => updateQuantity(item.cartId, item.quantity - 1)}>
                        <Text style={styles.stepperBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyVal}>{item.quantity}</Text>
                      <Pressable style={styles.stepperBtn} onPress={() => updateQuantity(item.cartId, item.quantity + 1)}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </SurfaceCard>
            )}
          />

          <View
            style={[
              styles.checkoutDock,
              {
                paddingBottom: Math.max(insets.bottom, 10) + 8,
                ...Platform.select({
                  ios: {
                    shadowColor: '#0f172a',
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: -4 },
                  },
                  android: { elevation: 16 },
                  default: {},
                }),
              },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.checkoutDockInner}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHead}>
                  <Text style={styles.summaryLabel}>Order total</Text>
                  <Text style={styles.summaryValue}>LKR {total.toFixed(0)}</Text>
                </View>

                <PrimaryButton label="Go to checkout" onPress={() => router.push('/checkout')} style={styles.checkoutBtn} />

                <Pressable style={styles.clearBtn} onPress={() => clearCart()}>
                  <Text style={styles.clearText}>Clear cart</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', backgroundColor: ui.bg },
  mainColumn: { flex: 1, width: '100%', minHeight: 0, position: 'relative' },
  listFlex: { flex: 1, width: '100%' },
  /** Pull line items under the hero’s rounded bottom (hero is a sibling, not ListHeader). */
  listOverlap: { marginTop: -HERO_OVERLAP },
  emptyScroll: { flexGrow: 1 },

  sheet: {
    marginTop: -HERO_OVERLAP,
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { marginTop: 8, fontSize: 20, fontWeight: '800', color: ui.text },
  emptyText: { marginTop: 8, color: theme.subtext, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { width: '100%', marginTop: 14 },

  listContent: {
    flexGrow: 1,
    paddingHorizontal: LIST_INSET_X,
    paddingTop: 8,
    gap: CARD_GAP,
  },
  card: {
    padding: 14,
    paddingHorizontal: 16,
    /** Base `SurfaceCard` supplies radius, border, and light shadow; we lift it slightly. */
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
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  itemMain: { flexDirection: 'row', gap: 10, flex: 1 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f3f4f6' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  rowTitleWrap: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: ui.text },
  unitPrice: { marginTop: 4, color: theme.subtext, fontSize: 12, fontWeight: '600' },
  rightActions: { alignItems: 'flex-end', gap: 6 },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: theme.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linePrice: { fontSize: 17, fontWeight: '800', color: theme.primaryDeep },

  modsWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.borderSoft,
    backgroundColor: theme.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modsLabel: { color: theme.subtext, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' },
  modRow: { marginTop: 3, color: '#374151', fontSize: 13, lineHeight: 18 },

  qtyRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyLabel: { color: ui.subtext, fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: { fontSize: 20, color: ui.text, lineHeight: 22, fontWeight: '700' },
  qtyVal: { minWidth: 22, textAlign: 'center', fontSize: 17, fontWeight: '800', color: ui.text },

  checkoutDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: theme.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    zIndex: 20,
  },
  checkoutDockInner: {
    width: '100%',
    paddingTop: 12,
  },
  summaryCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 0,
    backgroundColor: theme.surfaceHighlight,
    borderRadius: 0,
  },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: ui.subtext, fontSize: 14, fontWeight: '700' },
  summaryValue: { color: theme.primaryDeep, fontSize: 26, fontWeight: '900' },
  checkoutBtn: { width: '100%', marginTop: 10 },
  clearBtn: { alignSelf: 'center', marginTop: 10, marginBottom: 2, paddingVertical: 4 },
  clearText: { color: ui.danger, fontWeight: '700' },
});
