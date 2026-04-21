import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileGradientHero } from '@/components/MobileGradientHero';
import { AboutEditorial } from '@/features/about/AboutEditorial';
import { styles } from '@/features/home/homeStyles';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';

export default function AboutScreen() {
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screenRoot}>
      <MobileGradientHero
        insetsTop={insets.top}
        eyebrow={t(language, 'aboutStandaloneEyebrow')}
        title={t(language, 'aboutStandaloneTitle')}
        hint={t(language, 'aboutStandaloneLead')}
        stats={[]}
      />
      <ScrollView
        style={styles.scrollUnderHero}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.scrollContentAbout, { paddingBottom: 28 + insets.bottom }]}
      >
        <AboutEditorial language={language} />
      </ScrollView>
    </View>
  );
}
