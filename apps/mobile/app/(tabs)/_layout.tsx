import React from 'react';
import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/FloatingTabBar';
import { TAB_BAR_VISIBLE_STYLE } from '@/lib/tabBarStyles';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';

export default function TabLayout() {
  const { language } = useAppLanguage();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: TAB_BAR_VISIBLE_STYLE,
        sceneStyle: { flex: 1 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t(language, 'tabHome') }} />
      <Tabs.Screen
        name="menu"
        options={{
          title: t(language, 'tabMenu'),
          headerShown: false,
        }}
      />
      <Tabs.Screen name="cart" options={{ title: t(language, 'tabCart') }} />
      <Tabs.Screen name="track" options={{ title: t(language, 'tabTrack') }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
