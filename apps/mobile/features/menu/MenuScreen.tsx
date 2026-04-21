import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MenuItem, PublicBusinessSettings } from '@wrap-roll/contracts';
import { formatApiError } from '@/lib/api-error';
import { MenuService, SettingsApiService } from '@/services/api';
import { defaultModifiersFromItem, useMobileCartStore } from '@/store/useMobileCartStore';
import { BrandLoader } from '@/components/BrandLoader';
import { HeaderAccountCartActions } from '@/components/HeaderAccountCartActions';
import { MobileGradientHero } from '@/components/MobileGradientHero';
import { PrimaryButton, SurfaceCard } from '@/components/mobile-ui';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import { styles as homeStyles } from '@/features/home/homeStyles';
import { MenuCategoryArc } from './MenuCategoryArc';
import { styles } from './menuStyles';
import type { MenuItemInfo } from './types';

export default function MenuScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const addToCart = useMobileCartStore((s) => s.addToCart);

  const [settings, setSettings] = useState<PublicBusinessSettings | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<MenuItemInfo | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pub, cats, menu] = await Promise.all([
        SettingsApiService.getPublic(),
        MenuService.getMenuCategories(),
        MenuService.getMenu({
          search: debouncedSearch.trim() || undefined,
          categoryId: categoryId ?? undefined,
          limit: 60,
          page: 1,
        }),
      ]);
      setSettings(pub);
      setCategories(cats);
      setItems(menu.items);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const heroHint = useMemo(() => {
    const base = t(language, 'menuSubtitle');
    const name = settings?.businessName?.trim();
    return name ? `${base} · ${name}` : base;
  }, [language, settings]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const onTapItem = (item: MenuItem) => {
    if (item.availability !== 'available') return;
    if (item.modifierGroups?.length) {
      router.push(`/menu/${item.itemId}`);
      return;
    }
    addToCart(item, defaultModifiersFromItem(item));
  };
  const closeItemModal = () => {
    setSelectedItem(null);
    setSelectedInfo(null);
    setInfoLoading(false);
  };

  const openInfoCard = async (item: MenuItem) => {
    setSelectedItem(item);
    setInfoLoading(true);
    setSelectedInfo(null);
    try {
      const info = await MenuService.getMenuItemInfo(item.itemId);
      setSelectedInfo(info);
    } catch {
      setSelectedInfo(null);
    } finally {
      setInfoLoading(false);
    }
  };

  const onModalAction = (item: MenuItem) => {
    if (item.availability !== 'available') return;
    if (item.modifierGroups?.length) {
      closeItemModal();
      router.push(`/menu/${item.itemId}`);
      return;
    }
    addToCart(item, defaultModifiersFromItem(item));
    closeItemModal();
  };

  const menuHeroFooter = useMemo(
    () => (
      <View style={styles.heroMenuFooter}>
        <View style={styles.heroSearchRow}>
          <View style={styles.heroSearchField}>
            <FontAwesome name="search" size={15} color="#64748b" />
            <TextInput
              placeholder={t(language, 'menuSearchPlaceholder')}
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              style={styles.heroSearchInput}
              returnKeyType="search"
            />
          </View>
        </View>
        <MenuCategoryArc
          variant="hero"
          categories={categories}
          categoryId={categoryId}
          onSelect={setCategoryId}
          onClearFilter={categoryId ? () => setCategoryId(null) : undefined}
          language={language}
        />
      </View>
    ),
    [language, search, categories, categoryId],
  );

  const renderItem = ({ item }: { item: MenuItem }) => {
    const unavailable = item.availability !== 'available';
    const hasOptions = item.modifierGroups?.length > 0;

    return (
      <SurfaceCard style={styles.itemCard}>
        <View style={styles.itemMain}>
          <Pressable style={styles.imageWrap} onPress={() => void openInfoCard(item)}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} contentFit="cover" />
            ) : (
              <View style={[styles.itemImage, styles.imagePlaceholder]} />
            )}
            {unavailable ? (
              <View style={[styles.stateBadge, styles.badgeOff]}>
                <Text style={[styles.stateBadgeText, styles.stateBadgeTextOff]}>{t(language, 'menuSoldOut')}</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.itemBody}>
            <View style={styles.itemContentTop}>
              <View style={styles.titleRow}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.name}</Text>
                <Pressable style={styles.infoBtn} onPress={() => void openInfoCard(item)}>
                  <Text style={styles.infoBtnText}>i</Text>
                </Pressable>
              </View>
              {item.description ? <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
              <Text style={styles.itemMeta}>
                {item.categoryName} · {item.prepTimeMinutes} {t(language, 'menuMin')}
              </Text>
            </View>

            <View style={styles.itemFooter}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>LKR {item.basePrice.toFixed(0)}</Text>
                {!unavailable ? (
                  <PrimaryButton
                    label={hasOptions ? t(language, 'menuCustomize') : t(language, 'menuAdd')}
                    onPress={() => onTapItem(item)}
                    style={styles.itemAction}
                  />
                ) : (
                  <View style={styles.unavailablePill}>
                    <Text style={styles.unavailablePillText}>{t(language, 'menuUnavailable')}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </SurfaceCard>
    );
  };

  if (loading) {
    return (
      <View style={homeStyles.screenRoot}>
        <MobileGradientHero
          insetsTop={insets.top}
          eyebrow={t(language, 'menuHeroEyebrow')}
          title={t(language, 'menuTitle')}
          hint={t(language, 'menuSubtitle')}
          stats={[]}
          headerRight={<HeaderAccountCartActions variant="hero" />}
          footer={menuHeroFooter}
        />
        <View style={homeStyles.bootBody}>
          <BrandLoader
            title={t(language, 'menuLoadingTitle')}
            subtitle={t(language, 'menuLoadingSubtitle')}
            compact
          />
        </View>
      </View>
    );
  }

  return (
    <View style={homeStyles.screenRoot}>
      <MobileGradientHero
        insetsTop={insets.top}
        eyebrow={t(language, 'menuHeroEyebrow')}
        title={t(language, 'menuTitle')}
        hint={heroHint}
        stats={[]}
        headerRight={<HeaderAccountCartActions variant="hero" />}
        footer={menuHeroFooter}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.itemId}
        renderItem={renderItem}
        style={homeStyles.scrollUnderHero}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 130 + insets.bottom }]}
        ListHeaderComponent={
          error ? (
            <View style={[styles.headerStack, styles.listErrorOnly]}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{error}</Text>
                <Pressable onPress={() => void load()}>
                  <Text style={styles.bannerAction}>{t(language, 'menuRetry')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <SurfaceCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t(language, 'menuEmptyTitle')}</Text>
            <Text style={styles.emptySub}>{t(language, 'menuEmptySub')}</Text>
          </SurfaceCard>
        }
      />

      <Modal visible={Boolean(selectedItem)} transparent animationType="fade" onRequestClose={closeItemModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTouch} onPress={closeItemModal} />
          {selectedItem ? (
            <View style={styles.modalSheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces
                style={styles.modalScrollFlex}
                contentContainerStyle={styles.modalScrollInner}
              >
                <View style={styles.modalImageWrap}>
                  {selectedItem.imageUrl ? (
                    <Image
                      source={{ uri: selectedItem.imageUrl }}
                      style={[styles.modalImage, { height: Math.min(380, Math.round(windowHeight * 0.38)) }]}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.modalImage,
                        styles.imagePlaceholder,
                        { height: Math.min(380, Math.round(windowHeight * 0.38)) },
                      ]}
                    />
                  )}
                  <LinearGradient
                    colors={['rgba(15,23,42,0.55)', 'rgba(15,23,42,0.08)', 'transparent']}
                    locations={[0, 0.45, 1]}
                    style={styles.modalImageGradTop}
                    pointerEvents="none"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(17,24,39,0.5)']}
                    style={styles.modalImageGrad}
                    pointerEvents="none"
                  />
                  <Pressable
                    style={[styles.modalHeroClose, { top: insets.top + 8, right: 14 }]}
                    onPress={closeItemModal}
                    accessibilityRole="button"
                    accessibilityLabel={t(language, 'menuModalClose')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <FontAwesome name="times" size={18} color="#0f172a" />
                  </Pressable>
                </View>

                <View style={styles.modalHero}>
                  <Text style={styles.modalTitle}>{selectedItem.name}</Text>
                  <Text style={styles.modalMeta}>
                    {selectedItem.categoryName} · {selectedItem.prepTimeMinutes} {t(language, 'menuMinPrep')}
                  </Text>
                  <View style={styles.modalStatRow}>
                    <View style={styles.modalStatTile}>
                      <View style={styles.modalStatTileInner}>
                        <View style={styles.modalStatIconOrb}>
                          <FontAwesome name="clock-o" size={15} color="#fff" />
                        </View>
                        <View>
                          <Text style={styles.modalStatLabel}>{t(language, 'menuPrepTimeLabel')}</Text>
                          <Text style={styles.modalStatValue}>
                            {selectedItem.prepTimeMinutes} {t(language, 'menuMin')}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.modalStatTile}>
                      <View style={styles.modalStatTileInner}>
                        <View style={styles.modalStatIconOrb}>
                          <FontAwesome name="folder-open-o" size={14} color="#fff" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.modalStatLabel}>{t(language, 'menuCategoryLabel')}</Text>
                          <Text style={styles.modalStatValue} numberOfLines={2}>
                            {selectedItem.categoryName}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {selectedItem.description ? (
                  <View style={styles.modalAbout}>
                    <Text style={styles.modalAboutEyebrow}>{t(language, 'menuAboutItemEyebrow')}</Text>
                    <Text style={styles.modalDesc}>{selectedItem.description}</Text>
                  </View>
                ) : null}

                {infoLoading ? (
                  <View style={styles.modalLoadingWrap}>
                    <BrandLoader
                      title={t(language, 'menuInfoLoadingTitle')}
                      subtitle={t(language, 'menuInfoLoadingSubtitle')}
                      compact
                    />
                  </View>
                ) : selectedInfo ? (
                  <>
                    {selectedInfo.nutritionTags.length ? (
                      <View style={styles.modalSectionOuter}>
                        <View style={styles.modalSectionHead}>
                          <View style={[styles.modalSectionIconBg, styles.modalNutIconBg]}>
                            <FontAwesome name="tags" size={14} color="#c2410c" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalSectionTitle}>{t(language, 'menuNutritionTitle')}</Text>
                            <Text style={styles.modalSectionSub}>{t(language, 'menuNutritionSub')}</Text>
                          </View>
                        </View>
                        <View style={styles.modalNutCard}>
                          <View style={styles.tagRow}>
                            {selectedInfo.nutritionTags.map((tag) => (
                              <View key={`${tag.key}-${tag.label}`} style={styles.tagPill}>
                                <Text style={styles.tagText}>{tag.label}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.modalSectionOuter}>
                      <View style={styles.modalSectionHead}>
                        <View style={[styles.modalSectionIconBg, styles.modalIngIconBg]}>
                          <FontAwesome name="cutlery" size={14} color="#15803d" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalSectionTitle}>{t(language, 'menuIngredientsTitle')}</Text>
                          <Text style={styles.modalSectionSub}>{t(language, 'menuIngredientsSub')}</Text>
                        </View>
                      </View>
                      {selectedInfo.ingredientHighlights.length ? (
                        <View style={styles.modalIngBody}>
                          {selectedInfo.ingredientHighlights.map((ing, idx, arr) => (
                            <View
                              key={ing}
                              style={[styles.modalIngRow, idx === arr.length - 1 ? styles.modalIngRowLast : null]}
                            >
                              <View style={styles.modalIngBullet} />
                              <Text style={styles.modalIngText}>{ing}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.infoMuted, { marginHorizontal: 4, marginTop: 4 }]}>
                          {t(language, 'menuNoIngredients')}
                        </Text>
                      )}
                    </View>

                    <View style={styles.modalSectionOuter}>
                      <View style={styles.modalSectionHead}>
                        <View style={[styles.modalSectionIconBg, styles.modalIngIconBg]}>
                          <FontAwesome name="heartbeat" size={14} color="#15803d" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalSectionTitle}>{t(language, 'menuHealthTitle')}</Text>
                          <Text style={styles.modalSectionSub}>{t(language, 'menuHealthSub')}</Text>
                        </View>
                      </View>
                      {selectedInfo.healthTips.length ? (
                        <View style={styles.modalHealthCard}>
                          {selectedInfo.healthTips.map((tip) => (
                            <View key={tip} style={styles.modalHealthRow}>
                              <View style={styles.modalHealthIcon}>
                                <FontAwesome name="check" size={11} color="#16a34a" />
                              </View>
                              <Text style={styles.modalHealthText}>{tip}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.infoMuted, { marginHorizontal: 4, marginTop: 4 }]}>
                          {t(language, 'menuNoHealthTips')}
                        </Text>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.modalLoadingWrap}>
                    <Text style={styles.infoMuted}>{t(language, 'menuInfoLoadError')}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={[styles.modalFooterBar, { paddingBottom: Math.max(16, insets.bottom) }]}>
                <View style={styles.modalFooterSummary}>
                  <Text style={styles.modalPrice}>LKR {selectedItem.basePrice.toFixed(0)}</Text>
                  <View
                    style={[
                      styles.modalStatusBadge,
                      selectedItem.availability === 'available' ? styles.modalOn : styles.modalOff,
                    ]}
                  >
                    <Text style={styles.modalStatusText}>
                      {selectedItem.availability === 'available'
                        ? t(language, 'menuModalAvailable')
                        : t(language, 'menuSoldOut')}
                    </Text>
                  </View>
                </View>
                <PrimaryButton
                  label={
                    selectedItem.availability !== 'available'
                      ? t(language, 'menuUnavailable')
                      : selectedItem.modifierGroups?.length
                        ? t(language, 'menuCustomize')
                        : t(language, 'menuModalAddToCart')
                  }
                  onPress={() => onModalAction(selectedItem)}
                  style={styles.modalPrimaryFull}
                  disabled={selectedItem.availability !== 'available'}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
