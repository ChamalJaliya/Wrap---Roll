'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthPageShell, AuthSplitCard, AuthFormPanel, AuthForm, Label, Input, Button } from '@wrap-roll/shared-ui';
import { CashierAuthService } from '../../../lib/auth';

function CashierSignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = search.get('returnTo') || '/';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await CashierAuthService.signInWithPassword(
      email,
      password,
    );
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace(returnTo);
  };

  return (
    <AuthPageShell>
      <AuthSplitCard className="max-w-[520px] min-h-0">
        <AuthFormPanel>
          <h1 className="mb-2 text-3xl font-black text-slate-800">Cashier Sign In</h1>
          <p className="mb-6 text-sm text-slate-600">
            Sign in with your cashier account to access POS and live menu.
          </p>
          <AuthForm onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="cashier-email">Email</Label>
              <Input
                id="cashier-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cashier-password">Password</Label>
              <Input
                id="cashier-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="h-12 w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </AuthForm>
        </AuthFormPanel>
      </AuthSplitCard>
    </AuthPageShell>
  );
}

export default function CashierSignInPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <p className="text-sm font-medium text-slate-600">Loading sign in...</p>
        </AuthPageShell>
      }
    >
      <CashierSignInForm />
    </Suspense>
  );
}

