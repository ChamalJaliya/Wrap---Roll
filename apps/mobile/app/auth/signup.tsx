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

export default function SignUpScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const [mode, setMode] = useState<'magic' | 'password'>('password');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMode, setDoneMode] = useState<'magic' | 'password'>('password');

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (fullName.trim().length < 2) return false;
    if (!emailOk(email)) return false;
    if (mode === 'magic') return true;
    return password.length >= 6 && confirmPassword.length >= 6;
  }, [fullName, email, password, confirmPassword, mode, loading]);

  const onSubmit = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Sign up', t(language, 'authFillName'));
      return;
    }
    if (!emailOk(email)) {
      Alert.alert('Sign up', t(language, 'authFillEmail'));
      return;
    }

    if (mode === 'magic') {
      setLoading(true);
      const { error } = await AuthService.signInWithMagicLink(email.trim(), {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setLoading(false);
      if (error) {
        Alert.alert('Magic link', error.message);
        return;
      }
      setDoneMode('magic');
      setDone(true);
      return;
    }

    if (password.length < 6 || confirmPassword.length < 6) {
      Alert.alert('Sign up', t(language, 'authFillConfirm'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Sign up', t(language, 'authPasswordMismatch'));
      return;
    }

    setLoading(true);
    const { data, error } = await AuthService.signUpWithPassword(email.trim(), password, {
      full_name: fullName.trim(),
      phone: phone.trim() || undefined,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data?.session) {
      router.replace('/(tabs)');
      return;
    }

    setDoneMode('password');
    setDone(true);
  };

  const primaryLabel = (() => {
    if (loading) {
      return mode === 'magic' ? t(language, 'authBtnSendingMagic') : t(language, 'authBtnCreating');
    }
    return mode === 'magic' ? t(language, 'authBtnSignUpMagic') : t(language, 'authBtnSignUpPassword');
  })();

  const successSub =
    doneMode === 'magic'
      ? `${t(language, 'authSignUpMagicBefore')}${email.trim()}${t(language, 'authSignUpMagicAfter')}`
      : `${t(language, 'authSignUpPwdBefore')}${email.trim()}${t(language, 'authSignUpPwdAfter')}`;

  if (done) {
    return (
      <AuthChrome
        eyebrow={t(language, 'authSignUpEyebrow')}
        headline={t(language, 'authSignUpWelcomeTitle')}
        sub={successSub}
        onBack={() => router.replace('/auth/signin')}
        footer={
          <PrimaryButton label={t(language, 'authStartExploring')} onPress={() => router.replace('/(tabs)')} />
        }
      >
        <View style={styles.successPlaceholder} />
      </AuthChrome>
    );
  }

  return (
    <AuthChrome
      eyebrow={t(language, 'authSignUpEyebrow')}
      headline={t(language, 'authSignUpHeadline')}
      sub={t(language, 'authSignUpSub')}
      onBack={() => router.back()}
      footer={
        <View style={styles.footer}>
          <PrimaryButton label={primaryLabel} onPress={() => void onSubmit()} disabled={!canSubmit} />
          <Pressable onPress={() => router.push('/auth/signin')} style={styles.linkWrap} hitSlop={8}>
            <Text style={styles.linkMuted}>{t(language, 'authAlreadyJoined')}</Text>
            <Text style={styles.linkStrong}> {t(language, 'authWelcomeBackLink')}</Text>
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
        label={t(language, 'authFullName')}
        icon="user"
        value={fullName}
        onChangeText={setFullName}
        placeholder={t(language, 'authFullNamePlaceholder')}
        autoComplete="name"
        textContentType="name"
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
      />
      <AuthTextField
        label={t(language, 'authPhoneOptional')}
        icon="phone"
        value={phone}
        onChangeText={setPhone}
        placeholder={t(language, 'authPhonePlaceholder')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      {mode === 'password' ? (
        <>
          <AuthTextField
            label={t(language, 'authPasswordLabel')}
            icon="lock"
            secureToggle
            value={password}
            onChangeText={setPassword}
            placeholder={t(language, 'authPasswordPlaceholder')}
            secureTextEntry
            autoComplete="password-new"
            textContentType="newPassword"
          />
          <AuthTextField
            label={t(language, 'authConfirmPasswordLabel')}
            icon="lock"
            isLast
            secureToggle
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t(language, 'authConfirmPasswordPlaceholder')}
            secureTextEntry
            autoComplete="password-new"
            textContentType="newPassword"
          />
        </>
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
