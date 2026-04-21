import React, { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MobileSideDrawer } from '@/components/MobileSideDrawer';
import { mobileTheme } from '@/constants/mobileTheme';
import { useAppLanguage } from '@/lib/mobile-language';
import { AuthService } from '@/services/auth';
import { useMobileCartStore } from '@/store/useMobileCartStore';

/** Matches FloatingTabBar active orb. */
const POP_SIZE = 46;
const POP_LIFT = 6;

function hapticLight() {
  if (Platform.OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

type HeaderActionsVariant = 'default' | 'hero';

export function HeaderAccountCartActions({ variant = 'default' }: { variant?: HeaderActionsVariant }) {
  const isHero = variant === 'hero';
  const router = useRouter();
  const cartCount = useMobileCartStore((s) => s.cart.reduce((sum, line) => sum + line.quantity, 0));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { language, setLanguage } = useAppLanguage();

  const updateLanguage = async (next: 'en' | 'si' | 'ta') => {
    await setLanguage(next);
  };

  const onSignOut = async () => {
    await AuthService.signOut();
    setDrawerOpen(false);
    router.replace('/auth/signin');
  };

  const openMenu = () => {
    hapticLight();
    setDrawerOpen(true);
  };

  const openCart = () => {
    hapticLight();
    router.push('/(tabs)/cart');
  };

  return (
    <>
      <View style={[styles.row, isHero && styles.rowHero]}>
        <View style={[styles.popWrap, isHero && styles.popWrapHero]}>
          <Pressable
            style={({ pressed }) => [styles.popPress, pressed && styles.popPressed]}
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <View style={styles.orb}>
              <FontAwesome name="bars" size={20} color="#fff" />
            </View>
          </Pressable>
        </View>

        <View style={[styles.popWrap, isHero && styles.popWrapHero]}>
          <Pressable
            style={({ pressed }) => [styles.popPress, pressed && styles.popPressed]}
            onPress={openCart}
            accessibilityRole="button"
            accessibilityLabel="Open cart"
          >
            <View style={styles.orb}>
              <FontAwesome name="shopping-cart" size={19} color="#fff" />
              {cartCount > 0 ? (
                <View style={styles.badgeOrb}>
                  <Text style={styles.badgeOrbText}>{cartCount > 99 ? '99+' : String(cartCount)}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>

      <MobileSideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        language={language}
        onSignOut={() => void onSignOut()}
        onLanguageChange={(next) => void updateLanguage(next)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  rowHero: {
    alignItems: 'center',
  },
  popWrap: {
    transform: [{ translateY: -POP_LIFT }],
    marginBottom: 2,
  },
  popWrapHero: {
    transform: [],
    marginBottom: 0,
  },
  popPress: {
    borderRadius: POP_SIZE / 2,
  },
  popPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  orb: {
    width: POP_SIZE,
    height: POP_SIZE,
    borderRadius: POP_SIZE / 2,
    backgroundColor: mobileTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#f7f3ed',
    shadowColor: mobileTheme.colors.primaryDeep,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
    position: 'relative',
  },
  badgeOrb: {
    position: 'absolute',
    top: -2,
    right: -2,
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
  badgeOrbText: {
    color: mobileTheme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },
});
