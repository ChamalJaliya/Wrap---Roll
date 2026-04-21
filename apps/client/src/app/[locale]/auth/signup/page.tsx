'use client';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AuthService } from '../../../../services/auth';
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

function SignUpForm() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Auth');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<'magic' | 'password-signup'>('password-signup');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;

    if (mode === 'magic') {
      setLoading(true);
      const { error } = await AuthService.signInWithMagicLink(email, {
        full_name: fullName,
        phone,
      });
      setLoading(false);
      if (error) {
        alert(error.message);
      } else {
        setDone(true);
      }
      return;
    }

    if (!password) return;
    if (password !== confirmPassword) {
      alert(t('passwordMismatch'));
      return;
    }
    setLoading(true);
    const { error } = await AuthService.signUpWithPassword(email, password, {
      full_name: fullName,
      phone,
    });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      setDone(true);
    }
  };

  const fieldClass = cn(
    authPremiumInputClass,
    'transition-transform duration-300 focus-visible:scale-[1.01]'
  );

  if (done) {
    return (
      <AuthPageShell>
        <AuthSplitCard className="min-h-0 max-w-[440px]">
          <AuthFormPanel className="items-center text-center">
            <AuthSuccessPanel>
              <AuthSuccessIcon emoji="🌯" />
              <h1 className="mb-2 font-display text-4xl font-black text-slate-800">
                {t('signUpWelcomeTitle')}
              </h1>
              <p className="mb-6 text-slate-500">
                {mode === 'magic'
                  ? t('signUpSuccessBefore')
                  : t('signUpSuccessPasswordBefore')}
                <strong>{email}</strong>
                {mode === 'magic'
                  ? t('signUpSuccessAfter')
                  : t('signUpSuccessPasswordAfter')}
              </p>
              <Button
                variant="premium"
                size="lg"
                onClick={() => router.push(`/${locale}`)}
                className="mt-4 w-full"
              >
                {t('startExploring')}
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
        <AuthFormPanel>
          <AuthFormHeader
            logo="✨"
            title={t('joinClubTitle')}
            description={<>{t('joinClubLead')}</>}
          />

          <AuthForm onSubmit={handleSignUp}>
            <SegmentedControl>
              <SegmentedControlItem active={mode === 'magic'} onClick={() => setMode('magic')}>
                {t('authModeMagic')}
              </SegmentedControlItem>
              <SegmentedControlItem
                active={mode === 'password-signup'}
                onClick={() => setMode('password-signup')}
              >
                {t('authModePassword')}
              </SegmentedControlItem>
            </SegmentedControl>

            <div className="grid gap-2">
              <Label htmlFor="name">{t('fullName')}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t('fullNamePlaceholder')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={fieldClass}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={fieldClass}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">{t('phoneOptional')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={fieldClass}
              />
            </div>

            {mode === 'password-signup' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="password">{t('passwordLabel')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={fieldClass}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className={fieldClass}
                  />
                </div>
              </>
            ) : null}

            <Button
              type="submit"
              variant="premium"
              size="lg"
              disabled={loading}
              className="mt-2 h-16 w-full text-lg tracking-widest"
            >
              {loading
                ? mode === 'magic'
                  ? t('magicLinkLoading')
                  : t('signUpLoading')
                : mode === 'magic'
                  ? t('magicLink')
                  : t('signUpPasswordSubmit')}
            </Button>
          </AuthForm>

          <AuthFormFooter>
            {t('alreadyJoined')}{' '}
            <AuthFooterLinkButton
              onClick={() => router.push(`/${locale}/auth/signin`)}
            >
              {t('welcomeBackLink')}
            </AuthFooterLinkButton>
          </AuthFormFooter>
        </AuthFormPanel>

        <AuthBannerSection
          imageSrc="/auth-bg.png"
          imageAlt={t('signUpBannerAlt')}
          title={
            <>
              {t('signUpBannerTitle1')} <br />
              <span className="text-primary">{t('signUpBannerTitle2')}</span>
            </>
          }
          description={<>{t('signUpBannerLead')}</>}
        />
      </AuthSplitCard>
    </AuthPageShell>
  );
}

export default function SignUpPage() {
  const t = useTranslations('Auth');
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="animate-pulse font-display">{t('signUpFallback')}</p>
        </AuthPageShell>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
