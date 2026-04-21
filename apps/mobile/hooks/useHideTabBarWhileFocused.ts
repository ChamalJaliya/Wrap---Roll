import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { TAB_BAR_HIDDEN_STYLE, TAB_BAR_VISIBLE_STYLE } from '@/lib/tabBarStyles';

type NavLike = {
  getParent?: () => NavLike | undefined;
  getState?: () => { type?: string } | undefined;
  setOptions: (o: { tabBarStyle?: object }) => void;
};

function findTabNavigator(nav: NavLike | undefined): NavLike | null {
  let current: NavLike | undefined = nav?.getParent?.();
  while (current) {
    const state = current.getState?.();
    if (state?.type === 'tab') {
      return current;
    }
    current = current.getParent?.();
  }
  return null;
}

/**
 * Hides the bottom tab bar while this screen is focused (e.g. Cart needs vertical room).
 * Restores the default floating tab style on blur.
 */
export function useHideTabBarWhileFocused() {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const tabNav = findTabNavigator(navigation as unknown as NavLike);
      if (!tabNav) return undefined;

      tabNav.setOptions({ tabBarStyle: TAB_BAR_HIDDEN_STYLE });
      return () => {
        tabNav.setOptions({ tabBarStyle: TAB_BAR_VISIBLE_STYLE });
      };
    }, [navigation]),
  );
}
