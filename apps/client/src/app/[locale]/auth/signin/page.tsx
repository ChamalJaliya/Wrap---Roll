'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AuthService } from '../../../../services/auth';
import { withLocalePrefix } from '@/lib/locale-path';
import {
  AuthBannerSection,
  AuthFooterLinkButton,
  AuthForm,
  AuthFormFooter,
  AuthFormHeader,
  AuthFormPanel,
  AuthPageShell,
  AuthSplitCard,
  AuthSuccessIcon,
  AuthSuccessPanel,
  Button,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import { authPremiumInputClass } from '@/lib/auth-field-styles';

function SignInForm() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Auth');
  const searchParams = useSearchParams();
  const returnTo = withLocalePrefix(searchParams.get('returnTo'), locale);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'magic' | 'password-signin'>('password-signin');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (mode === 'magic') {
      setLoading(true);
      const { error } = await AuthService.signInWithMagicLink(email);
      setLoading(false);
      if (error) {
        alert(error.message);
      } else {
        setDone(true);
      }
      return;
    }

    if (!password) return;
    setLoading(true);
    const { error } = await AuthService.signInWithPassword(email, password);
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      router.push(returnTo);
    }
  };

  if (done) {
    return (
      <AuthPageShell>
        <AuthSplitCard className="min-h-0 max-w-[440px]">
          <AuthFormPanel className="items-center text-center">
            <AuthSuccessPanel>
              <AuthSuccessIcon emoji="📬" />
              <h1 className="mb-2 font-display text-4xl font-black text-slate-800">
                {t('magicSentTitle')}
              </h1>
              <p className="mb-6 text-slate-500">
                {t('signInSuccessBefore')}
                <strong>{email}</strong>
                {t('signInSuccessAfter')}
              </p>
              <Button
                variant="premium"
                size="lg"
                onClick={() => router.push(returnTo)}
                className="mt-4 w-full"
              >
                {t('continue')}
              </Button>
            </AuthSuccessPanel>
          </AuthFormPanel>
        </AuthSplitCard>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthSplitCard>
        <AuthBannerSection
          imageSrc="/auth-bg.png"
          imageAlt={t('signInBannerAlt')}
          title={
            <>
              {t('signInBannerTitle1')} <br />
              <span className="text-primary">{t('signInBannerTitle2')}</span>
            </>
          }
          description={<>{t('signInBannerLead')}</>}
        />

        <AuthFormPanel>
          <AuthFormHeader
            logo="🌯"
            title={t('welcomeBack')}
            description={<>{t('signInFormLead')}</>}
          />

          <AuthForm onSubmit={handleSignIn}>
            <SegmentedControl>
              <SegmentedControlItem active={mode === 'magic'} onClick={() => setMode('magic')}>
                {t('authModeMagic')}
              </SegmentedControlItem>
              <SegmentedControlItem
                active={mode === 'password-signin'}
                onClick={() => setMode('password-signin')}
              >
                {t('authModePassword')}
              </SegmentedControlItem>
            </SegmentedControl>

            <div className="grid gap-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={cn(
                  authPremiumInputClass,
                  'transition-transform duration-300 focus-visible:scale-[1.01]'
                )}
              />
            </div>

            {mode === 'password-signin' ? (
              <div className="grid gap-2">
                <Label htmlFor="password">{t('passwordLabel')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={cn(
                    authPremiumInputClass,
                    'transition-transform duration-300 focus-visible:scale-[1.01]'
                  )}
                />
              </div>
            ) : null}

            <Button
              type="submit"
              variant="premium"
              size="lg"
              disabled={loading}
              className="h-16 w-full text-lg tracking-widest"
            >
              {loading
                ? mode === 'magic'
                  ? t('magicLinkLoading')
                  : t('signInLoading')
                : mode === 'magic'
                  ? t('magicLink')
                  : t('signInPasswordSubmit')}
            </Button>
          </AuthForm>

          <AuthFormFooter>
            {t('newHere')}{' '}
            <AuthFooterLinkButton
              onClick={() => router.push(`/${locale}/auth/signup`)}
            >
              {t('startJourney')}
            </AuthFooterLinkButton>
          </AuthFormFooter>
        </AuthFormPanel>
      </AuthSplitCard>
    </AuthPageShell>
  );
}

export default function SignInPage() {
  const t = useTranslations('Auth');
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="animate-pulse font-display">{t('signInFallback')}</p>
        </AuthPageShell>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
