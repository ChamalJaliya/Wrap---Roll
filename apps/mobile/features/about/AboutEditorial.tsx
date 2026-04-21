import React, { useMemo } from 'react';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SurfaceCard, ui } from '@/components/mobile-ui';
import { mobileTheme } from '@/constants/mobileTheme';
import { t } from '@/lib/mobile-i18n';
import type { MobileLanguage } from '@/lib/mobile-language';

const theme = mobileTheme.colors;

const ABOUT_IMAGE =
  'https://images.unsplash.com/photo-1533787761082-492a5b83e614?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

const STAT_CARD_W = 148;
const STAT_GAP = 12;

export function AboutEditorial({ language }: { language: MobileLanguage }) {
  const stats = useMemo(
    () => [
      {
        value: t(language, 'aboutStatRecipes'),
        label: t(language, 'aboutStatRecipesLabel'),
        icon: 'list-ul' as const,
      },
      {
        value: t(language, 'aboutStatFresh'),
        label: t(language, 'aboutStatFreshLabel'),
        icon: 'star' as const,
      },
      {
        value: t(language, 'aboutStatFoodies'),
        label: t(language, 'aboutStatFoodiesLabel'),
        icon: 'heart' as const,
      },
    ],
    [language],
  );

  return (
    <View style={styles.root}>
      <View style={styles.heroImageBleed}>
        <Image source={{ uri: ABOUT_IMAGE }} style={styles.heroImage} contentFit="cover" />
        <View style={styles.heroImageFade} pointerEvents="none" />
      </View>

      <View style={styles.copyBlock}>
        <Text style={styles.eyebrow}>{t(language, 'aboutStoryEyebrow')}</Text>
        <Text style={styles.headline}>{t(language, 'aboutSectionTitle')}</Text>
        <Text style={styles.lead}>{t(language, 'aboutP1')}</Text>
      </View>

      <View style={styles.paraRows}>
        <View style={styles.paraRow}>
          <View style={styles.paraIcon}>
            <FontAwesome name="cutlery" size={15} color={theme.primaryDeep} />
          </View>
          <Text style={styles.body}>{t(language, 'aboutP2')}</Text>
        </View>
        <View style={styles.paraRow}>
          <View style={styles.paraIcon}>
            <FontAwesome name="bolt" size={15} color={theme.primaryDeep} />
          </View>
          <Text style={styles.body}>{t(language, 'aboutP3')}</Text>
        </View>
      </View>

      <View style={styles.numbersSection}>
        <Text style={styles.numbersEyebrow}>{t(language, 'aboutNumbersSection')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={STAT_CARD_W + STAT_GAP}
          snapToAlignment="start"
          disableIntervalMomentum
          contentContainerStyle={styles.statsScrollInner}
        >
          {stats.map((s, i) => (
            <SurfaceCard
              key={`${s.label}-${i}`}
              style={[
                styles.statCard,
                { width: STAT_CARD_W },
                i < stats.length - 1 ? { marginRight: STAT_GAP } : null,
              ]}
            >
              <View style={styles.statOrb}>
                <FontAwesome name={s.icon} size={14} color={theme.primaryText} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>
                {s.label}
              </Text>
            </SurfaceCard>
          ))}
        </ScrollView>
      </View>

      <View style={styles.quoteCard}>
        <Text style={styles.quoteMark} accessibilityRole="none">
          “
        </Text>
        <Text style={styles.quoteText}>{t(language, 'aboutQuote')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingBottom: 8,
  },
  heroImageBleed: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    backgroundColor: theme.border,
  },
  heroImage: {
    width: '100%',
    height: 232,
  },
  heroImageFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  copyBlock: {
    paddingHorizontal: 22,
    paddingTop: 26,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.35,
    color: theme.primaryDeep,
  },
  headline: {
    fontSize: 24,
    fontWeight: '900',
    color: ui.text,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  lead: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: ui.text,
    marginTop: 2,
  },
  paraRows: {
    marginTop: 22,
    paddingHorizontal: 22,
    gap: 18,
  },
  paraRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  paraIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
    color: ui.text,
  },
  numbersSection: {
    marginTop: 28,
    gap: 12,
  },
  numbersEyebrow: {
    paddingHorizontal: 22,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.35,
    color: theme.muted,
  },
  statsScrollInner: {
    paddingHorizontal: 22,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statCard: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 18,
  },
  statOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.primaryDeep,
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: ui.subtext,
    textAlign: 'center',
    lineHeight: 15,
  },
  quoteCard: {
    marginTop: 26,
    marginHorizontal: 22,
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: theme.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.warningBorder,
    alignItems: 'center',
  },
  quoteMark: {
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '700',
    color: theme.primary,
    opacity: 0.35,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    color: theme.warningText,
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
});
