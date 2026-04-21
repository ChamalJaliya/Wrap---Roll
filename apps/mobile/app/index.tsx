import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRootNavigationState, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '@/services/auth';
import { AppScreen } from '@/components/mobile-ui';
import { BrandLoader } from '@/components/BrandLoader';

export default function LaunchScreen() {
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key) return;
    let active = true;
    const hardFallback = setTimeout(() => {
      if (active) router.replace('/auth/signin');
    }, 4200);

    const run = async () => {
      const minSplash = new Promise((resolve) => setTimeout(resolve, 1300));
      const sessionLookup = Promise.race([
        AuthService.getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
      ]);

      const [, session] = await Promise.all([minSplash, sessionLookup]);
      if (!active) return;

      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/signin');
      }
    };

    void run();
    return () => {
      active = false;
      clearTimeout(hardFallback);
    };
  }, [navState?.key, router]);

  return (
    <AppScreen>
      <LinearGradient colors={['#0b1220', '#111827', '#1f2937']} style={styles.bg}>
        <LinearGradient
          colors={['rgba(234,88,12,0.25)', 'rgba(234,88,12,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.blobTop}
        />
        <LinearGradient
          colors={['rgba(251,146,60,0.20)', 'rgba(251,146,60,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.blobBottom}
        />

        <View style={styles.container}>
          <View style={styles.lockupCard}>
            <Text style={styles.kicker}>GOURMET FAST CASUAL</Text>
            <BrandLoader title="Wrap & Roll" subtitle="Crafting your next bite..." />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaPill}>Fresh ingredients</Text>
            <Text style={styles.metaPill}>Quick pickup</Text>
          </View>
          <Text style={styles.tagline}>Fresh wraps. Fast pickup.</Text>
        </View>
      </LinearGradient>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, overflow: 'hidden' },
  blobTop: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 999,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  lockupCard: {
    width: '100%',
    maxWidth: 330,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,16,30,0.55)',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#f59e0b',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  metaPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(17,24,39,0.45)',
  },
  tagline: {
    fontSize: 13,
    color: '#d1d5db',
    letterSpacing: 0.4,
  },
});
