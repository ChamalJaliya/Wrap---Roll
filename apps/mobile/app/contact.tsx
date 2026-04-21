import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { PublicBusinessSettings } from '@wrap-roll/contracts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileGradientHero } from '@/components/MobileGradientHero';
import { ContactSection } from '@/features/home/ContactSection';
import { styles } from '@/features/home/homeStyles';
import { usePublicContactFields } from '@/features/home/usePublicContactFields';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import { SettingsApiService } from '@/services/api';

export default function ContactScreen() {
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<PublicBusinessSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    void SettingsApiService.getPublic()
      .then((s) => {
        if (mounted) setSettings(s);
      })
      .catch(() => {
        if (mounted) setSettings(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const { displayAddress, displayHours, displayPhone, displayEmail } = usePublicContactFields(
    language,
    settings,
  );

  const stats = useMemo(
    () => [
      { label: t(language, 'homeStatRecipes'), value: t(language, 'homeStatRecipesVal'), icon: 'list-ul' as const },
      { label: t(language, 'homeStatFresh'), value: t(language, 'homeStatFreshVal'), icon: 'star' as const },
      { label: t(language, 'homeStatServed'), value: t(language, 'homeStatServedVal'), icon: 'heart' as const },
    ],
    [language],
  );

  return (
    <View style={styles.screenRoot}>
      <MobileGradientHero
        insetsTop={insets.top}
        eyebrow={t(language, 'contactStandaloneEyebrow')}
        title={t(language, 'contactStandaloneTitle')}
        hint={t(language, 'contactStandaloneLead')}
        stats={stats}
      />
      <ScrollView
        style={styles.scrollUnderHero}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
      >
        <ContactSection
          language={language}
          address={displayAddress}
          hoursLine={displayHours}
          phone={displayPhone}
          email={displayEmail}
        />
      </ScrollView>
    </View>
  );
}
