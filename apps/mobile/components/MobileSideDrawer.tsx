import React, { useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useSegments } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileTheme } from '@/constants/mobileTheme';
import { t } from '@/lib/mobile-i18n';
import type { MobileLanguage } from '@/lib/mobile-language';
import { AuthService } from '@/services/auth';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[0][0];
  const b = parts[parts.length - 1][0];
  return `${a}${b}`.toUpperCase();
}

function useActiveNavKey(): 'home' | 'menu' | 'cart' | 'track' | null {
  const seg = useSegments();
  if (seg[0] === '(tabs)') {
    if (seg.length < 2) return 'home';
    const tab = seg[1];
    if (tab === 'menu' || tab === 'cart' || tab === 'track') return tab;
    if (tab === 'more') return null;
    return 'home';
  }
  if (seg[0] === 'menu') return 'menu';
  return null;
}

type NavKey = 'home' | 'menu' | 'cart' | 'track';

type AccountInfo =
  | { kind: 'guest' }
  | { kind: 'user'; name: string; email: string | null };

export function MobileSideDrawer({
  open,
  onClose,
  language,
  onSignOut,
  onLanguageChange,
}: {
  open: boolean;
  onClose: () => void;
  language: MobileLanguage;
  onSignOut: () => void;
  onLanguageChange: (next: 'en' | 'si' | 'ta') => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const panelW = Math.min(340, Math.round(winW * 0.88));
  const active = useActiveNavKey();

  const [account, setAccount] = useState<AccountInfo | null>(null);

  const slideDistance = useMemo(() => panelW + 4, [panelW]);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!open) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 300 });
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [open, progress]);

  useEffect(() => {
    if (!open) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const session = await AuthService.getSession();
      if (cancelled) return;
      if (!session?.user) {
        setAccount({ kind: 'guest' });
        return;
      }
      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      const fromMeta =
        typeof meta?.full_name === 'string' && meta.full_name.trim()
          ? meta.full_name.trim()
          : typeof meta?.name === 'string' && meta.name.trim()
            ? meta.name.trim()
            : null;
      const email = session.user.email ?? null;
      const name = fromMeta ?? (email ? email.split('@')[0] : 'Guest');
      setAccount({ kind: 'user', name, email });
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const closeAnimated = () => {
    progress.value = withTiming(0, { duration: 260 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const hapticLight = () => {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const navigate = (key: NavKey) => {
    switch (key) {
      case 'home':
        router.push('/(tabs)');
        break;
      case 'menu':
        router.push('/(tabs)/menu');
        break;
      case 'cart':
        router.push('/(tabs)/cart');
        break;
      case 'track':
        router.push('/(tabs)/track');
        break;
      default:
        break;
    }
    closeAnimated();
  };

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * -slideDistance }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.48,
  }));

  const navItems: { key: NavKey; icon: React.ComponentProps<typeof FontAwesome>['name']; label: string }[] = [
    { key: 'home', icon: 'home', label: t(language, 'tabHome') },
    { key: 'menu', icon: 'list', label: t(language, 'tabMenu') },
    { key: 'cart', icon: 'shopping-cart', label: t(language, 'tabCart') },
    { key: 'track', icon: 'map-marker', label: t(language, 'tabTrack') },
  ];

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeAnimated}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <AnimatedPressable style={[styles.backdropTouch, backdropStyle]} onPress={closeAnimated}>
          <View style={StyleSheet.absoluteFill} />
        </AnimatedPressable>

        <Animated.View
          style={[
            styles.drawerPanel,
            {
              width: panelW,
              left: 0,
              top: 0,
              bottom: 0,
            },
            drawerStyle,
          ]}
        >
          <View style={styles.panelInner}>
            <LinearGradient
              colors={['#fb923c', '#ea580c', '#7c2d12']}
              locations={[0, 0.42, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.drawerHero, { paddingTop: insets.top + 10, paddingBottom: 18 }]}
            >
              <View style={styles.drawerHeroDecor} pointerEvents="none" />
              <View style={styles.drawerHeroTop}>
                <View style={styles.drawerHeroTitles}>
                  <Text style={styles.drawerEyebrow}>WRAP & ROLL</Text>
                  <Text style={styles.drawerTitle}>Wrap & Roll</Text>
                  <Text style={styles.drawerSubtitle}>{t(language, 'drawerTagline')}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.drawerCloseBtn, pressed && styles.pressableDim]}
                  onPress={closeAnimated}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, 'menuModalClose')}
                  hitSlop={12}
                >
                  <FontAwesome name="times" size={22} color="#fff" />
                </Pressable>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
              keyboardShouldPersistTaps="handled"
            >
              {account?.kind === 'user' ? (
                <View style={styles.accountCard}>
                  <View style={styles.accountRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initialsFromName(account.name)}</Text>
                    </View>
                    <View style={styles.accountMeta}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {account.name}
                      </Text>
                      {account.email ? (
                        <Text style={styles.accountEmail} numberOfLines={1}>
                          {account.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      router.push('/profile');
                      closeAnimated();
                    }}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.viewProfileBtn,
                      (pressed || hovered) && styles.pressableDim,
                    ]}
                  >
                    <Text style={styles.viewProfileText}>{t(language, 'drawerViewProfile')}</Text>
                    <FontAwesome name="angle-right" size={14} color={mobileTheme.colors.primary} />
                  </Pressable>
                </View>
              ) : account?.kind === 'guest' ? (
                <View style={styles.accountCard}>
                  <View style={styles.accountRow}>
                    <View style={[styles.avatar, styles.avatarGuest]}>
                      <FontAwesome name="user-o" size={22} color="#9ca3af" />
                    </View>
                    <View style={styles.accountMeta}>
                      <Text style={styles.accountName}>{t(language, 'drawerGuestTitle')}</Text>
                      <Text style={styles.accountEmail}>{t(language, 'drawerGuestHint')}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.accountCard, styles.accountSkeleton]}>
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, { width: '55%' }]} />
                </View>
              )}

              <Text style={styles.sectionLabel}>{t(language, 'drawerSectionGo')}</Text>
              <View style={styles.navList}>
                {navItems.map((item) => {
                  const isActive = active === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                        styles.navItem,
                        isActive && styles.navItemActive,
                        (pressed || hovered) && styles.navItemPressed,
                      ]}
                      onPress={() => {
                        hapticLight();
                        navigate(item.key);
                      }}
                    >
                      <View style={[styles.navIconWrap, isActive && styles.navIconOrbActive]}>
                        <FontAwesome
                          name={item.icon}
                          size={isActive ? 17 : 16}
                          color={isActive ? '#fff' : '#64748b'}
                        />
                      </View>
                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
                      <FontAwesome
                        name="angle-right"
                        size={14}
                        color={isActive ? mobileTheme.colors.primaryDeep : '#cbd5e1'}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, styles.sectionSpaced]}>{t(language, 'language')}</Text>
              <View style={styles.langWrap}>
                <View style={styles.langRow}>
                  <LanguagePill
                    label="EN"
                    active={language === 'en'}
                    onPress={() => {
                      hapticLight();
                      onLanguageChange('en');
                    }}
                  />
                  <LanguagePill
                    label="සිංහල"
                    active={language === 'si'}
                    onPress={() => {
                      hapticLight();
                      onLanguageChange('si');
                    }}
                  />
                  <LanguagePill
                    label="தமிழ்"
                    active={language === 'ta'}
                    onPress={() => {
                      hapticLight();
                      onLanguageChange('ta');
                    }}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.moreRow,
                  (pressed || hovered) && styles.pressableDim,
                ]}
                onPress={() => {
                  hapticLight();
                  router.push('/more');
                  closeAnimated();
                }}
              >
                <View style={styles.moreIconWrap}>
                  <FontAwesome name="ellipsis-h" size={15} color={mobileTheme.colors.primaryDeep} />
                </View>
                <Text style={styles.moreLabel}>{t(language, 'moreOptions')}</Text>
                <FontAwesome name="angle-right" size={14} color="#cbd5e1" />
              </Pressable>
            </ScrollView>

            {account ? (
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                {account.kind === 'user' ? (
                  <Pressable
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.footerBtn,
                      styles.footerBtnDanger,
                      (pressed || hovered) && styles.pressableDim,
                    ]}
                    onPress={() => {
                      hapticLight();
                      onSignOut();
                    }}
                  >
                    <FontAwesome name="sign-out" size={16} color={mobileTheme.colors.danger} />
                    <Text style={styles.footerSignOut}>{t(language, 'signOut')}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.footerBtn,
                      styles.footerBtnPrimary,
                      (pressed || hovered) && styles.pressableDim,
                    ]}
                    onPress={() => {
                      hapticLight();
                      router.push('/auth/signin');
                      closeAnimated();
                    }}
                  >
                    <FontAwesome name="sign-in" size={16} color={mobileTheme.colors.primaryText} />
                    <Text style={styles.footerSignIn}>{t(language, 'signIn')}</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function LanguagePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.langPill,
        active && styles.langPillActive,
        (pressed || hovered) && !active && styles.langPillHover,
        (pressed || hovered) && styles.pressableDim,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.langText, active && styles.langTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
  },
  /** Flush to left edge; only the right side is rounded (sheet from edge). */
  drawerPanel: {
    position: 'absolute',
    backgroundColor: mobileTheme.colors.card,
    overflow: 'hidden',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 8, height: 0 },
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  panelInner: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bg,
  },
  drawerHero: {
    paddingHorizontal: 18,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  drawerHeroDecor: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -36,
  },
  drawerHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  drawerHeroTitles: {
    flex: 1,
    minWidth: 0,
  },
  drawerEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.35,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: 4,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  drawerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },
  drawerCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  accountCard: {
    borderRadius: 18,
    backgroundColor: mobileTheme.colors.surfaceHighlight,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: mobileTheme.colors.warningBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  accountSkeleton: {
    gap: 10,
    paddingVertical: 18,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
    width: '72%',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff7ed',
    borderWidth: 2,
    borderColor: `${mobileTheme.colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGuest: {
    backgroundColor: '#f9fafb',
    borderColor: mobileTheme.colors.border,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: mobileTheme.colors.primaryDeep,
  },
  accountMeta: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 17,
    fontWeight: '800',
    color: mobileTheme.colors.text,
    letterSpacing: -0.2,
  },
  accountEmail: {
    marginTop: 3,
    fontSize: 13,
    color: mobileTheme.colors.subtext,
    fontWeight: '500',
  },
  viewProfileBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileTheme.colors.border,
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '800',
    color: mobileTheme.colors.primary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: mobileTheme.colors.muted,
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  sectionSpaced: {
    marginTop: 8,
  },
  navList: {
    gap: 10,
    marginBottom: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: mobileTheme.colors.card,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
  },
  navItemActive: {
    backgroundColor: mobileTheme.colors.surfaceHighlight,
    borderColor: mobileTheme.colors.warningBorder,
  },
  navItemPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  navIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconOrbActive: {
    borderRadius: 19,
    backgroundColor: mobileTheme.colors.primary,
    borderWidth: 2,
    borderColor: '#fff7ed',
    shadowColor: mobileTheme.colors.primaryDeep,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  pressableDim: {
    opacity: 0.88,
  },
  langPillHover: {
    borderColor: `${mobileTheme.colors.primary}55`,
    backgroundColor: '#fffaf5',
  },
  navLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: mobileTheme.colors.text,
  },
  navLabelActive: {
    color: mobileTheme.colors.primaryDeep,
    fontWeight: '800',
  },
  langWrap: {
    borderRadius: 16,
    padding: 10,
    backgroundColor: mobileTheme.colors.card,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    marginBottom: 8,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  langPill: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
    backgroundColor: mobileTheme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langPillActive: {
    backgroundColor: mobileTheme.colors.primary,
    borderColor: mobileTheme.colors.primary,
  },
  langText: { color: '#4b5563', fontSize: 13, fontWeight: '800' },
  langTextActive: { color: mobileTheme.colors.primaryText },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: mobileTheme.colors.card,
    borderWidth: 1,
    borderColor: mobileTheme.colors.border,
  },
  moreIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: mobileTheme.colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: mobileTheme.colors.warningBorder,
  },
  moreLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: mobileTheme.colors.text,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileTheme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: mobileTheme.colors.card,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  footerBtnPrimary: {
    backgroundColor: mobileTheme.colors.primary,
  },
  footerBtnDanger: {
    backgroundColor: mobileTheme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  footerSignOut: {
    fontSize: 15,
    fontWeight: '800',
    color: mobileTheme.colors.danger,
  },
  footerSignIn: {
    fontSize: 15,
    fontWeight: '800',
    color: mobileTheme.colors.primaryText,
  },
});
