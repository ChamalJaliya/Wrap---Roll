import React, { useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { mobileTheme } from '@/constants/mobileTheme';
import { t } from '@/lib/mobile-i18n';
import type { MobileLanguage } from '@/lib/mobile-language';

const ORB = 44;
const COL_W = 78;

const SPRING_PRESS = { damping: 16, stiffness: 420, mass: 0.35 };
const SPRING_SELECTED = { damping: 14, stiffness: 260, mass: 0.45 };
const SPRING_CLEAR = { damping: 12, stiffness: 320 };

type Cat = { id: string; name: string; slug: string };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

/** Icons only (no emoji) so every column aligns the same. */
function iconFor(slug: string, name: string): React.ComponentProps<typeof FontAwesome>['name'] {
  if (slug === 'all') return 'cutlery';
  const h = `${norm(slug)} ${norm(name)}`;
  if (/\b(drink|juice|beverage|coffee|tea|smoothie)\b/.test(h)) return 'coffee';
  if (/\b(burger|beef)\b/.test(h)) return 'cutlery';
  if (/\b(pizza)\b/.test(h)) return 'circle';
  if (/\b(snack|fries|side)\b/.test(h)) return 'cutlery';
  if (/\b(wrap|burrito)\b/.test(h)) return 'cutlery';
  if (/\b(bowl|rice|curry|noodle)\b/.test(h)) return 'cutlery';
  if (/\b(breakfast|morning|egg)\b/.test(h)) return 'coffee';
  if (/\b(salad|veggie|vegan)\b/.test(h)) return 'leaf';
  if (/\b(dessert|sweet|cake)\b/.test(h)) return 'birthday-cake';
  return 'cutlery';
}

function CategoryChip({
  active,
  slug,
  name,
  onPick,
}: {
  active: boolean;
  slug: string;
  name: string;
  onPick: () => void;
}) {
  const press = useSharedValue(1);
  const selected = useSharedValue(1);

  useEffect(() => {
    selected.value = withSpring(active ? 1.06 : 1, SPRING_SELECTED);
  }, [active, selected]);

  const columnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * selected.value }],
  }));

  const onPressIn = () => {
    press.value = withSpring(0.92, SPRING_PRESS);
  };
  const onPressOut = () => {
    press.value = withSpring(1, SPRING_PRESS);
  };

  const fa = iconFor(slug, name);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPick}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onHoverIn={() => Platform.OS === 'web' && setHovered(true)}
      onHoverOut={() => Platform.OS === 'web' && setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={styles.colHit}
    >
      <Animated.View style={[styles.col, columnStyle]}>
        <View
          style={[
            styles.orb,
            active && styles.orbActive,
            Platform.OS === 'web' && hovered && !active && styles.orbHover,
          ]}
        >
          <FontAwesome name={fa} size={active ? 19 : 18} color={active ? '#fff' : '#64748b'} />
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
          {name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function MenuCategoryArc({
  categories,
  categoryId,
  onSelect,
  onClearFilter,
  language,
  variant = 'default',
}: {
  categories: Cat[];
  categoryId: string | null;
  onSelect: (id: string | null) => void;
  /** Shown as trailing control when a category filter is active (replaces old “Reset” label). */
  onClearFilter?: () => void;
  language: MobileLanguage;
  /** `hero` — white panel on orange gradient (menu header). */
  variant?: 'default' | 'hero';
}) {
  const items = useMemo(() => {
    const all = {
      key: '__all__' as const,
      id: null as string | null,
      name: t(language, 'categoryAll'),
      slug: 'all',
    };
    return [all, ...categories.map((c) => ({ key: c.id, id: c.id, name: c.name, slug: c.slug }))];
  }, [categories, language]);

  const clearScale = useSharedValue(1);

  const onPick = (id: string | null) => {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(id);
  };

  const clearAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: clearScale.value }],
  }));

  const onClearPressIn = () => {
    clearScale.value = withSpring(0.88, SPRING_CLEAR);
  };
  const onClearPressOut = () => {
    clearScale.value = withSpring(1, SPRING_CLEAR);
  };

  const showClear = Boolean(categoryId) && onClearFilter;

  return (
    <View style={[styles.track, variant === 'hero' && styles.trackHero]}>
      <View style={styles.trackRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hScroll}
          contentContainerStyle={styles.scrollInner}
          decelerationRate="fast"
        >
          {items.map((item) => {
            const active = item.id === null ? categoryId === null : categoryId === item.id;
            return (
              <CategoryChip
                key={item.key}
                active={active}
                slug={item.slug}
                name={item.name}
                onPick={() => onPick(item.id)}
              />
            );
          })}
        </ScrollView>
        {showClear ? (
          <AnimatedPressable
            style={[styles.clearOrb, clearAnimatedStyle]}
            onPress={() => {
              if (Platform.OS === 'ios') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onClearFilter?.();
            }}
            onPressIn={onClearPressIn}
            onPressOut={onClearPressOut}
            accessibilityRole="button"
            accessibilityLabel={t(language, 'categoryClearFilter')}
          >
            <FontAwesome name="times" size={16} color="#64748b" />
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginTop: 6,
    marginBottom: 6,
    borderRadius: mobileTheme.radius.lg,
    backgroundColor: mobileTheme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: mobileTheme.colors.warningBorder,
    overflow: 'hidden',
  },
  trackHero: {
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(255,255,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hScroll: {
    flex: 1,
    minWidth: 0,
  },
  scrollInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 8,
    paddingRight: 4,
    gap: 4,
  },
  colHit: {
    width: COL_W,
  },
  col: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  clearOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 113, 22, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.25)',
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orbHover: {
    borderColor: mobileTheme.colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  orbActive: {
    backgroundColor: mobileTheme.colors.primary,
    borderWidth: 2,
    borderColor: '#f7f3ed',
    shadowColor: mobileTheme.colors.primaryDeep,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    width: '100%',
    lineHeight: 12,
    minHeight: 24,
    maxHeight: 24,
  },
  labelActive: {
    color: mobileTheme.colors.primaryDeep,
    fontWeight: '800',
  },
});
