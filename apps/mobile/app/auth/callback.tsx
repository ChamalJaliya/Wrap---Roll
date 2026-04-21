import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthService } from '@/services/auth';
import { AppScreen, SurfaceCard, ui } from '@/components/mobile-ui';
import { BrandLoader } from '@/components/BrandLoader';

/**
 * Deep-link target for Supabase auth (magic link / email confirm).
 * Add this URL to Supabase Redirect URLs: `wraproll://auth/callback`.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const liveUrl = Linking.useURL();
  const [status, setStatus] = useState('Finalizing sign-in...');

  useEffect(() => {
    let active = true;

    const complete = async () => {
      try {
        const incomingUrl = liveUrl ?? (await Linking.getInitialURL());
        if (incomingUrl) {
          const { error } = await AuthService.completeAuthFromUrl(incomingUrl);
          if (error && active) {
            setStatus('Could not verify link. Please try again from Sign in.');
            return;
          }
        }
      } finally {
        if (active) {
          router.replace('/(tabs)');
        }
      }
    };

    void complete();
    return () => {
      active = false;
    };
  }, [liveUrl, router]);

  return (
    <AppScreen>
      <View style={styles.wrap}>
        <SurfaceCard style={styles.card}>
          <BrandLoader title="Signing in" subtitle={status} compact />
          <Text style={styles.title}>Please wait</Text>
          <Text style={styles.caption}>{status}</Text>
        </SurfaceCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  card: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  title: { fontSize: 16, fontWeight: '800', color: ui.text },
  caption: { fontSize: 14, color: ui.subtext, textAlign: 'center' },
});
