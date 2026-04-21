import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { mobileTheme } from '@/constants/mobileTheme';
import { t } from '@/lib/mobile-i18n';
import type { MobileLanguage } from '@/lib/mobile-language';

const theme = mobileTheme.colors;

/**
 * Home “about” strip: no duplicate stats (hero already shows them).
 * One headline, short copy, quote line, single primary CTA → /about.
 */
export function AboutTeaserHome({ language }: { language: MobileLanguage }) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.headline}>{t(language, 'aboutSectionTitle')}</Text>
      <Text style={styles.body}>{t(language, 'aboutHomeTeaser')}</Text>

      <View style={styles.quoteRow}>
        <View style={styles.quoteBar} />
        <Text style={styles.quote}>“{t(language, 'aboutQuote')}”</Text>
      </View>

      <Pressable
        style={styles.cta}
        onPress={() => router.push('/about')}
        accessibilityRole="button"
        accessibilityLabel={t(language, 'aboutReadMore')}
      >
        <Text style={styles.ctaText}>{t(language, 'aboutReadMore')}</Text>
        <FontAwesome name="arrow-right" size={15} color={theme.primaryText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  headline: {
    fontSize: 21,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -0.35,
    lineHeight: 27,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.subtext,
    fontWeight: '500',
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  quoteBar: {
    width: 3,
    marginTop: 3,
    borderRadius: 2,
    backgroundColor: theme.primary,
    alignSelf: 'stretch',
    minHeight: 36,
  },
  quote: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
    fontWeight: '600',
    color: theme.text,
    opacity: 0.88,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: theme.primary,
    paddingHorizontal: 18,
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: theme.primaryText },
});
