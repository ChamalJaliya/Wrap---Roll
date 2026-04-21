import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PrimaryButton, ui } from '@/components/mobile-ui';
import { AuthChrome, AuthModeSwitch, AuthTextField } from '@/features/auth/AuthChrome';
import { t } from '@/lib/mobile-i18n';
import { useAppLanguage } from '@/lib/mobile-language';
import { AuthService } from '@/services/auth';

function emailOk(raw: string): boolean {
  const e = raw.trim();
  return e.length > 3 && e.includes('@');
}

export default function SignInScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const [mode, setMode] = useState<'magic' | 'password'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!emailOk(email)) return false;
    if (mode === 'password') return password.length >= 6;
    return true;
  }, [email, password, mode, loading]);

  const onSubmit = async () => {
    if (!emailOk(email)) {
      Alert.alert('Sign in', t(language, 'authFillEmail'));
      return;
    }
    if (mode === 'password' && password.length < 6) {
      Alert.alert('Sign in', t(language, 'authFillPassword'));
      return;
    }

    setLoading(true);
    if (mode === 'magic') {
      const { error } = await AuthService.signInWithMagicLink(email.trim());
      setLoading(false);
      if (error) {
        Alert.alert('Magic link', error.message);
        return;
      }
      setMagicSent(true);
      return;
    }

    const { error } = await AuthService.signInWithPassword(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }
    router.replace('/(tabs)');
  };

  const primaryLabel = (() => {
    if (loading) {
      return mode === 'magic' ? t(language, 'authBtnSendingMagic') : t(language, 'authBtnSigningIn');
    }
    return mode === 'magic' ? t(language, 'authBtnMagicLink') : t(language, 'authBtnSignInPassword');
  })();

  if (magicSent) {
    return (
      <AuthChrome
        eyebrow={t(language, 'authSignInEyebrow')}
        headline={t(language, 'authMagicSentTitle')}
        sub={`${t(language, 'authMagicSentSignInBefore')}${email.trim()}${t(language, 'authMagicSentSignInAfter')}`}
        onBack={() => setMagicSent(false)}
        footer={
          <PrimaryButton
            label={t(language, 'authMagicSentContinue')}
            onPress={() => router.replace('/(tabs)')}
          />
        }
      >
        <View style={styles.successPlaceholder} />
      </AuthChrome>
    );
  }

  return (
    <AuthChrome
      eyebrow={t(language, 'authSignInEyebrow')}
      headline={t(language, 'authSignInHeadline')}
      sub={t(language, 'authSignInSub')}
      onBack={() => router.back()}
      footer={
        <View style={styles.footer}>
          <PrimaryButton label={primaryLabel} onPress={() => void onSubmit()} disabled={!canSubmit} />
          <Pressable onPress={() => router.push('/auth/signup')} style={styles.linkWrap} hitSlop={8}>
            <Text style={styles.linkMuted}>{t(language, 'authNewHere')}</Text>
            <Text style={styles.linkStrong}> {t(language, 'authStartJourney')}</Text>
          </Pressable>
        </View>
      }
    >
      <AuthModeSwitch
        value={mode}
        onChange={setMode}
        magicLabel={t(language, 'authModeMagic')}
        passwordLabel={t(language, 'authModePassword')}
      />
      <AuthTextField
        label={t(language, 'authEmailLabel')}
        icon="envelope"
        value={email}
        onChangeText={setEmail}
        placeholder={t(language, 'authEmailPlaceholder')}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        isLast={mode === 'magic'}
      />
      {mode === 'password' ? (
        <AuthTextField
          label={t(language, 'authPasswordLabel')}
          icon="lock"
          secureToggle
          value={password}
          onChangeText={setPassword}
          placeholder={t(language, 'authPasswordPlaceholder')}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          isLast
        />
      ) : null}
    </AuthChrome>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12 },
  linkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  linkMuted: { fontSize: 14, color: ui.subtext, fontWeight: '600' },
  linkStrong: { fontSize: 14, color: ui.primary, fontWeight: '800' },
  successPlaceholder: { minHeight: 8 },
});
