import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MenuItem, ModifierGroup, MenuItemReviewSummary, PublicMenuItemReviewList } from '@wrap-roll/contracts';
import { formatApiError } from '@/lib/api-error';
import { MenuService } from '@/services/api';
import {
  defaultModifiersFromItem,
  type SelectedModifier,
  useMobileCartStore,
} from '@/store/useMobileCartStore';
import { PrimaryButton, StickyFooter, SurfaceCard, ui } from '@/components/mobile-ui';
import { BrandLoader } from '@/components/BrandLoader';
import { mobileTheme } from '@/constants/mobileTheme';

const theme = mobileTheme.colors;

function groupHint(group: ModifierGroup): string {
  if (group.type === 'single') return 'Pick one option';
  const min = typeof group.minSelect === 'number' ? group.minSelect : 0;
  const max = typeof group.maxSelect === 'number' ? group.maxSelect : Math.max(min, group.options.length);
  return `Choose ${min}–${max}`;
}

function SelectionControl({ mode, selected }: { mode: 'single' | 'multi'; selected: boolean }) {
  if (mode === 'single') {
    return (
      <View style={[styles.selRadio, selected && styles.selRadioOn]}>
        {selected ? <View style={styles.selRadioDot} /> : null}
      </View>
    );
  }
  return (
    <View style={[styles.selCheck, selected && styles.selCheckOn]}>
      {selected ? <FontAwesome name="check" size={11} color={theme.primaryText} /> : null}
    </View>
  );
}

export default function MenuItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addToCart = useMobileCartStore((s) => s.addToCart);

  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedModifier[]>([]);
  const [reviewSummary, setReviewSummary] = useState<MenuItemReviewSummary | null>(null);
  const [reviewList, setReviewList] = useState<PublicMenuItemReviewList | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await MenuService.getMenuItem(String(id));
      setItem(data);
      setSelected(defaultModifiersFromItem(data));
    } catch (e) {
      Alert.alert('Error', formatApiError(e));
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [summary, list] = await Promise.all([
          MenuService.getMenuItemReviewSummary(String(id)).catch(() => null),
          MenuService.getMenuItemPublicReviews(String(id), { page: 1, limit: 6 }).catch(() => null),
        ]);
        if (!cancelled) {
          setReviewSummary(summary);
          setReviewList(list);
        }
      } catch {
        if (!cancelled) {
          setReviewSummary(null);
          setReviewList(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const pricePreview = useMemo(() => {
    if (!item) return 0;
    const mod = selected.reduce((acc, g) => acc + g.options.reduce((a, o) => a + o.priceAdjust, 0), 0);
    return item.basePrice + mod;
  }, [item, selected]);

  const unavailable = item ? item.availability !== 'available' : false;

  const onToggleOption = (group: ModifierGroup, optionId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (group.type === 'single') {
      setSelected((prev) =>
        prev.map((g) =>
          g.groupId === group.groupId
            ? {
                ...g,
                options: group.options
                  .filter((o) => o.optionId === optionId)
                  .map((o) => ({ optionId: o.optionId, label: o.label, priceAdjust: o.priceAdjust })),
              }
            : g,
        ),
      );
    } else {
      toggleMulti(group, optionId);
    }
  };

  const toggleMulti = (group: ModifierGroup, optionId: string) => {
    setSelected((prev) =>
      prev.map((g) => {
        if (g.groupId !== group.groupId) return g;
        const opt = group.options.find((o) => o.optionId === optionId);
        if (!opt) return g;

        const exists = g.options.some((o) => o.optionId === optionId);
        let next = exists
          ? g.options.filter((o) => o.optionId !== optionId)
          : [...g.options, { optionId: opt.optionId, label: opt.label, priceAdjust: opt.priceAdjust }];

        const max = typeof group.maxSelect === 'number' ? group.maxSelect : group.options.length;
        if (max > 0 && next.length > max) next = next.slice(0, max);

        return { ...g, options: next };
      }),
    );
  };

  const validate = (): boolean => {
    if (!item) return false;

    for (const group of item.modifierGroups) {
      const sel = selected.find((s) => s.groupId === group.groupId);
      const count = sel?.options.length ?? 0;
      const min = typeof group.minSelect === 'number' ? group.minSelect : 0;

      if (group.required && count < Math.max(1, min)) {
        Alert.alert('Choices needed', `Select options for "${group.name}".`);
        return false;
      }
      if (group.type === 'single' && group.options.length && count !== 1) {
        Alert.alert('Choices needed', `Pick one option for "${group.name}".`);
        return false;
      }
      if (count < min) {
        Alert.alert('Choices needed', `Select at least ${min} for "${group.name}".`);
        return false;
      }
    }
    return true;
  };

  const onAdd = () => {
    if (!item || unavailable) return;
    if (!validate()) return;
    addToCart(item, selected);
    router.back();
  };

  if (loading || !item) {
    return (
      <SafeAreaView style={styles.centered}>
        <BrandLoader title="Loading item" subtitle="Preparing customization options..." compact />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, styles.heroPh]} />
          )}
          <LinearGradient
            colors={['rgba(17,24,39,0.15)', 'transparent', 'rgba(17,24,39,0.45)']}
            locations={[0, 0.45, 1]}
            style={styles.heroGrad}
            pointerEvents="none"
          />
          <View style={[styles.backOverlay, { paddingTop: Math.max(insets.top, 8) }]}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to menu"
            >
              <View style={styles.backIconOrb}>
                <FontAwesome name="chevron-left" size={16} color="#374151" />
              </View>
            </Pressable>
          </View>
        </View>

        <SurfaceCard style={styles.headerCard}>
          <Text style={styles.eyebrow}>CUSTOMIZE</Text>
          <Text style={styles.title}>{item.name}</Text>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <Text style={styles.meta}>
            {item.categoryName} · {item.prepTimeMinutes} min prep
            {(item.reviewCount ?? 0) > 0 && item.averageRating != null
              ? ` · ★ ${item.averageRating.toFixed(1)} (${item.reviewCount})`
              : ''}
          </Text>
          {unavailable ? (
            <View style={styles.soldOutBanner}>
              <FontAwesome name="ban" size={12} color={theme.danger} />
              <Text style={styles.soldOutText}>Currently unavailable</Text>
            </View>
          ) : null}
          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <View style={styles.statTileInner}>
                <View style={styles.statOrb}>
                  <FontAwesome name="clock-o" size={14} color={theme.primaryText} />
                </View>
                <View>
                  <Text style={styles.statLabel}>PREP</Text>
                  <Text style={styles.statValue}>{item.prepTimeMinutes} min</Text>
                </View>
              </View>
            </View>
            <View style={styles.statTile}>
              <View style={styles.statTileInner}>
                <View style={styles.statOrb}>
                  <FontAwesome name="folder-open-o" size={13} color={theme.primaryText} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.statLabel}>CATEGORY</Text>
                  <Text style={styles.statValue} numberOfLines={2}>
                    {item.categoryName}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SurfaceCard>

        {item.modifierGroups.map((group) => {
          const sel = selected.find((s) => s.groupId === group.groupId);
          const mode = group.type === 'single' ? 'single' : 'multi';
          const iconName = mode === 'single' ? 'dot-circle-o' : 'check-square-o';
          return (
            <View key={group.groupId} style={styles.groupSection}>
              <View style={styles.groupHead}>
                <View style={[styles.groupIconBg, mode === 'single' ? styles.groupIconSingle : styles.groupIconMulti]}>
                  <FontAwesome name={iconName} size={15} color={mode === 'single' ? '#c2410c' : '#15803d'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>
                    {group.name}
                    {group.required ? <Text style={styles.requiredMark}> *</Text> : null}
                  </Text>
                  <Text style={styles.groupHint}>{groupHint(group)}</Text>
                </View>
              </View>
              <View style={styles.optionShell}>
                {group.options.map((opt, idx, arr) => {
                  const isOn = sel?.options.some((o) => o.optionId === opt.optionId);
                  return (
                    <Pressable
                      key={opt.optionId}
                      style={[
                        styles.optionRow,
                        idx < arr.length - 1 ? styles.optionRowSep : null,
                        isOn ? styles.optionRowSelected : null,
                      ]}
                      onPress={() => onToggleOption(group, opt.optionId)}
                      disabled={unavailable}
                    >
                      <SelectionControl mode={mode} selected={Boolean(isOn)} />
                      <Text style={styles.optionLabel}>{opt.label}</Text>
                      {opt.priceAdjust !== 0 ? (
                        <Text style={styles.optionPrice}>
                          {opt.priceAdjust > 0 ? '+' : ''}
                          {opt.priceAdjust.toFixed(0)} LKR
                        </Text>
                      ) : (
                        <Text style={styles.optionPriceMuted}>Included</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        <SurfaceCard style={styles.reviewsCard}>
          <Text style={styles.reviewsTitle}>Reviews</Text>
          {reviewSummary && reviewSummary.reviewCount > 0 ? (
            <Text style={styles.reviewsSub}>
              Average {reviewSummary.averageRating?.toFixed(1) ?? '—'} · {reviewSummary.reviewCount} public
            </Text>
          ) : (
            <Text style={styles.reviewsSub}>No public reviews yet.</Text>
          )}
          {reviewList && reviewList.items.length > 0 ? (
            <View style={styles.reviewList}>
              {reviewList.items.map((r) => (
                <View key={r.id} style={styles.reviewRow}>
                  <Text style={styles.reviewStars}>
                    {r.rating}★ · {r.authorLabel}
                  </Text>
                  <Text style={styles.reviewMeta}>
                    {r.helpfulCount} helpful · {r.replyCount} replies
                  </Text>
                  <Text style={styles.reviewComment} numberOfLines={4}>
                    {r.comment?.trim() ? r.comment : 'No comment'}
                  </Text>
                  {r.replies.length > 0 ? (
                    <View style={styles.replyBlock}>
                      {r.replies.slice(0, 3).map((rep) => {
                        const repPhotos = rep.photoUrls ?? [];
                        return (
                          <View key={rep.id} style={styles.replyRow}>
                            <Text style={styles.replyLine} numberOfLines={repPhotos.length ? 2 : 3}>
                              <Text style={styles.replyAuthor}>{rep.authorLabel}: </Text>
                              {rep.body?.trim() ? rep.body : repPhotos.length ? '' : '—'}
                            </Text>
                            {repPhotos.length > 0 ? (
                              <View style={styles.replyPhotos}>
                                {repPhotos.map((url) => (
                                  <Image
                                    key={url.slice(0, 48)}
                                    source={{ uri: url }}
                                    style={styles.replyPhotoThumb}
                                    contentFit="cover"
                                  />
                                ))}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </SurfaceCard>
      </ScrollView>

      <StickyFooter>
        <View style={styles.footerInner}>
          <View style={styles.footerPriceBlock}>
            <Text style={styles.totalLabel}>Item total</Text>
            <Text style={styles.totalValue}>LKR {pricePreview.toFixed(0)}</Text>
          </View>
          <PrimaryButton
            label={unavailable ? 'Unavailable' : 'Add to cart'}
            onPress={onAdd}
            disabled={unavailable}
            style={styles.cta}
          />
        </View>
      </StickyFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 28 },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroGrad: {
    ...StyleSheet.absoluteFillObject,
  },
  backOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 14,
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backIconOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  hero: { width: '100%', height: 228 },
  heroPh: { backgroundColor: theme.border },
  headerCard: {
    marginHorizontal: 18,
    marginTop: -18,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.primary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: { fontSize: 22, fontWeight: '900', color: ui.text, letterSpacing: -0.3 },
  desc: { marginTop: 10, fontSize: 14, lineHeight: 22, color: '#475569', fontWeight: '500' },
  meta: { marginTop: 10, fontSize: 12, color: theme.muted, fontWeight: '700' },
  soldOutBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  soldOutText: { fontSize: 13, fontWeight: '700', color: theme.danger },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statTile: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: theme.surfaceHighlight,
    borderWidth: 1,
    borderColor: `${theme.primary}22`,
  },
  statTileInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statOrb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f7f3ed',
  },
  statLabel: { fontSize: 10, fontWeight: '800', color: theme.subtext, letterSpacing: 0.4 },
  statValue: { marginTop: 2, fontSize: 14, fontWeight: '800', color: theme.text },
  groupSection: { marginHorizontal: 18, marginTop: 22, gap: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconSingle: { backgroundColor: '#fff7ed' },
  groupIconMulti: { backgroundColor: '#ecfdf5' },
  groupTitle: { fontSize: 16, fontWeight: '900', color: theme.text },
  requiredMark: { color: theme.primary },
  groupHint: { marginTop: 4, fontSize: 12, color: theme.subtext, fontWeight: '600' },
  optionShell: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fffdfb',
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fffdfb',
  },
  optionRowSep: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#fde68a',
  },
  optionRowSelected: {
    backgroundColor: '#fff7ed',
  },
  optionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.text },
  optionPrice: { fontSize: 14, fontWeight: '800', color: theme.primaryDeep },
  optionPriceMuted: { fontSize: 13, color: theme.muted, fontWeight: '600' },
  selRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: `${theme.primary}55`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selRadioOn: {
    borderColor: theme.primary,
  },
  selRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary,
  },
  selCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: `${theme.primary}55`,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card,
  },
  selCheckOn: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  reviewsCard: { marginHorizontal: 18, marginTop: 20, marginBottom: 8, padding: 16 },
  reviewsTitle: { fontSize: 15, fontWeight: '900', color: theme.text },
  reviewsSub: { marginTop: 6, fontSize: 12, color: theme.subtext, fontWeight: '600' },
  reviewList: { marginTop: 12 },
  reviewRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },
  reviewStars: { fontSize: 13, fontWeight: '900', color: '#b45309' },
  reviewMeta: { marginTop: 2, fontSize: 11, color: theme.subtext, fontWeight: '600' },
  reviewComment: { marginTop: 4, fontSize: 13, color: theme.text, lineHeight: 18 },
  replyBlock: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#fed7aa' },
  replyRow: { marginBottom: 8 },
  replyLine: { fontSize: 12, color: theme.text, marginBottom: 4, lineHeight: 16 },
  replyPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  replyPhotoThumb: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#e5e5e5' },
  replyAuthor: { fontWeight: '800', color: theme.text },
  footerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  footerPriceBlock: { flexShrink: 1 },
  totalLabel: { fontSize: 11, color: theme.subtext, fontWeight: '800', letterSpacing: 0.5 },
  totalValue: { marginTop: 2, fontSize: 22, fontWeight: '900', color: theme.primaryDeep },
  cta: { minWidth: 150, flexGrow: 1, maxWidth: 220 },
});
