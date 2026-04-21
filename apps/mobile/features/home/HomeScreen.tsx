import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MenuItem, PublicBusinessSettings } from '@wrap-roll/contracts';
import { BrandLoader } from '@/components/BrandLoader';
import { MobileGradientHero } from '@/components/MobileGradientHero';
import { SectionTitle, SurfaceCard } from '@/components/mobile-ui';
import { formatApiError } from '@/lib/api-error';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import { MenuService, SettingsApiService } from '@/services/api';
import { AboutTeaserHome } from './AboutTeaserHome';
import { ContactTeaserHome } from './ContactTeaserHome';
import { styles } from './homeStyles';
import { usePublicContactFields } from './usePublicContactFields';

export default function HomeScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<PublicBusinessSettings | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pub, menu] = await Promise.all([
          SettingsApiService.getPublic(),
          MenuService.getMenu({ page: 1, limit: 8 }),
        ]);
        if (!mounted) return;
        setSettings(pub);
        setItems(menu.items ?? []);
      } catch (e) {
        if (!mounted) return;
        setError(formatApiError(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const featured = useMemo(
    () => items.filter((i) => i.availability === 'available').slice(0, 6),
    [items],
  );

  const homeHeroStats = useMemo(
    () => [
      { label: t(language, 'homeStatRecipes'), value: t(language, 'homeStatRecipesVal'), icon: 'list-ul' as const },
      { label: t(language, 'homeStatFresh'), value: t(language, 'homeStatFreshVal'), icon: 'star' as const },
      { label: t(language, 'homeStatServed'), value: t(language, 'homeStatServedVal'), icon: 'heart' as const },
    ],
    [language],
  );

  const { displayAddress, displayHours, displayPhone, displayEmail } = usePublicContactFields(
    language,
    settings,
  );

  if (loading) {
    return (
      <View style={styles.screenRoot}>
        <MobileGradientHero
          insetsTop={insets.top}
          eyebrow={t(language, 'homeHeroEyebrow')}
          title={t(language, 'homeHeroTitle')}
          hint={t(language, 'homeHeroLead')}
          headerRight={null}
          stats={homeHeroStats}
        />
        <View style={styles.bootBody}>
          <BrandLoader title={t(language, 'homeTitle')} subtitle={t(language, 'homeLoadingSubtitle')} compact />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <MobileGradientHero
        insetsTop={insets.top}
        eyebrow={t(language, 'homeHeroEyebrow')}
        title={t(language, 'homeHeroTitle')}
        hint={t(language, 'homeHeroLead')}
        stats={homeHeroStats}
        footer={
          <View style={styles.heroCtaRow}>
            <Pressable style={styles.heroCtaPrimary} onPress={() => router.push('/(tabs)/menu')}>
              <Text style={styles.heroCtaPrimaryText}>{t(language, 'homeStartOrder')}</Text>
            </Pressable>
            <Pressable style={styles.heroCtaOutline} onPress={() => router.push('/checkout')}>
              <Text style={styles.heroCtaOutlineText}>{t(language, 'homeGoCheckout')}</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollUnderHero}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + insets.bottom }]}
      >
        <SurfaceCard style={styles.aboutSheet}>
          <AboutTeaserHome language={language} />
        </SurfaceCard>

        <View style={styles.sectionBlock}>
          <View style={styles.featuredSection}>
            <Text style={styles.sectionEyebrow}>{t(language, 'homeFeaturedEyebrow')}</Text>
            <SectionTitle
              title={t(language, 'featured')}
              right={
                <Pressable onPress={() => router.push('/(tabs)/menu')}>
                  <Text style={styles.linkText}>{t(language, 'seeAll')}</Text>
                </Pressable>
              }
            />
          </View>
          {featured.length === 0 ? (
            <Text style={styles.loadingText}>{t(language, 'homeNoFeatured')}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={styles.featuredRow}
            >
              {featured.map((item) => (
                <Pressable
                  key={item.itemId}
                  style={styles.featuredCard}
                  onPress={() => router.push(`/menu/${item.itemId}`)}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.featuredImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.featuredImage, styles.featuredImagePlaceholder]} />
                  )}
                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.featuredMeta} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                    <Text style={styles.featuredPrice}>LKR {item.basePrice.toFixed(0)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <ContactTeaserHome
          language={language}
          address={displayAddress}
          hoursLine={displayHours}
          phone={displayPhone}
          email={displayEmail}
        />

        {error ? (
          <SurfaceCard style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </SurfaceCard>
        ) : null}
      </ScrollView>
    </View>
  );
}
