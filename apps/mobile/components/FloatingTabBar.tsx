import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileTheme } from '@/constants/mobileTheme';
import { useMobileCartStore } from '@/store/useMobileCartStore';

const ACTIVE_SIZE = 52;
const OVERHANG = 22;

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  index: 'home',
  menu: 'list',
  cart: 'shopping-cart',
  track: 'map-marker',
};

function routeIcon(name: string): React.ComponentProps<typeof FontAwesome>['name'] {
  return ICONS[name] ?? 'circle';
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useMobileCartStore((s) => s.cart.reduce((sum, line) => sum + line.quantity, 0));

  const routes = state.routes.filter((route) => {
    const item = descriptors[route.key].options.tabBarItemStyle as { display?: string } | undefined;
    return item?.display !== 'none';
  });

  const focusedRoute = state.routes[state.index];

  /** Cart uses a full-width hero; hiding here is reliable (tabBarStyle on a custom tab bar is easy to ignore). */
  if (focusedRoute?.name === 'cart') {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.shell, { paddingTop: OVERHANG }]}>
      <View
        style={[
          styles.bar,
          {
            // Safe area lives *inside* the bar so the cream background extends to the physical bottom.
            paddingBottom: Math.max(insets.bottom + 8, 12),
          },
        ]}
      >
        {routes.map((route) => {
          const isFocused = focusedRoute?.key === route.key;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon = routeIcon(route.name);
          const showBadge = route.name === 'cart' && cartCount > 0;

          const onPress = () => {
            if (Platform.OS === 'ios') {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabSlot}
            >
              {isFocused ? (
                <View style={styles.activeCol}>
                  <View style={styles.activeLift}>
                    <View style={styles.activeCircle}>
                      <FontAwesome name={icon} size={22} color="#fff" />
                      {showBadge ? (
                        <View style={styles.badgeOnActive}>
                          <Text style={styles.badgeTextActive}>
                            {cartCount > 99 ? '99+' : String(cartCount)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.labelActive} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ) : (
                <View style={styles.inactiveCol}>
                  <View style={styles.iconWrap}>
                    <FontAwesome name={icon} size={21} color="#64748b" />
                    {showBadge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : String(cartCount)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.label} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    backgroundColor: '#f7f3ed',
    paddingHorizontal: 4,
    paddingTop: 4,
    minHeight: 54,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.1)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    minHeight: 48,
  },
  inactiveCol: {
    alignItems: 'center',
    gap: 3,
    paddingBottom: 2,
  },
  activeCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    paddingBottom: 2,
  },
  activeLift: {
    marginBottom: 4,
    transform: [{ translateY: -OVERHANG }],
  },
  activeCircle: {
    width: ACTIVE_SIZE,
    height: ACTIVE_SIZE,
    borderRadius: ACTIVE_SIZE / 2,
    backgroundColor: mobileTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#f7f3ed',
    shadowColor: mobileTheme.colors.primaryDeep,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  iconWrap: {
    position: 'relative',
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.15,
  },
  labelActive: {
    fontSize: 10,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDeep,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: mobileTheme.colors.primary,
    borderWidth: 1.5,
    borderColor: '#f7f3ed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  badgeOnActive: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: mobileTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeTextActive: {
    color: mobileTheme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
});
