'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { AdminAuthService } from '../../../lib/auth';

function AdminSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'magic' | 'password-signin'>('magic');

  const returnTo = useMemo(() => searchParams.get('returnTo') || '/', [searchParams]);
  const forbidden = searchParams.get('error') === 'forbidden';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    if (mode === 'magic') {
      const { error: signInError } = await AdminAuthService.signIn(email, returnTo);
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      setDoneMessage(`Magic link sent to ${email}. Open it on this device to continue.`);
      setDone(true);
      return;
    }

    if (!password) {
      setLoading(false);
      setError('Password is required.');
      return;
    }

    const { error: passwordError } = await AdminAuthService.signInWithPassword(email, password);
    setLoading(false);
    if (passwordError) {
      setError(passwordError.message);
      return;
    }
    router.replace(returnTo);
  };

  return (
    <AuthPageShell>
      <AuthSplitCard className="min-h-0">
        <AuthBannerSection
          imageSrc="/auth-bg.png"
          imageAlt="Wrap & Roll admin control room"
          title={
            <>
              Command <br />
              <span className="text-primary">Center.</span>
            </>
          }
          description={
            <>
              Secure admin access for menu control, analytics, and operations in one place.
            </>
          }
        />
        <AuthFormPanel>
          {done ? (
            <AuthSuccessPanel>
              <AuthSuccessIcon emoji="🔐" />
              <h1 className="mb-2 text-3xl font-black text-slate-800">Check your inbox</h1>
              <p className="text-slate-500">{doneMessage}</p>
            </AuthSuccessPanel>
          ) : (
            <>
              <AuthFormHeader
                logo="🛡️"
                title="Admin Sign In"
                description="Use magic link or email/password for the primary admin account."
              />
              {forbidden ? (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  This account is not allowed to access admin.
                </p>
              ) : null}
              <AuthForm onSubmit={onSubmit}>
                <SegmentedControl>
                  <SegmentedControlItem
                    active={mode === 'magic'}
                    onClick={() => {
                      setMode('magic');
                      setError(null);
                    }}
                  >
                    Magic Link
                  </SegmentedControlItem>
                  <SegmentedControlItem
                    active={mode === 'password-signin'}
                    onClick={() => {
                      setMode('password-signin');
                      setError(null);
                    }}
                  >
                    Password Sign In
                  </SegmentedControlItem>
                </SegmentedControl>
                <div className="grid gap-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@wrapandroll.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {mode !== 'magic' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                ) : null}
                {error ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" className="h-12 w-full" disabled={loading}>
                  {loading
                    ? 'Please wait...'
                    : mode === 'magic'
                      ? 'Send magic link'
                      : 'Sign in with password'}
                </Button>
              </AuthForm>
            </>
          )}

          <AuthFormFooter>
            Need to go back?
            <AuthFooterLinkButton onClick={() => router.push('/')}>Dashboard</AuthFooterLinkButton>
          </AuthFormFooter>
        </AuthFormPanel>
      </AuthSplitCard>
    </AuthPageShell>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-sm font-medium text-slate-600">Loading sign in...</p>
        </AuthPageShell>
      }
    >
      <AdminSignInForm />
    </Suspense>
  );
}
