'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  AuthFormPanel,
  AuthPageShell,
  AuthSplitCard,
  AuthSuccessIcon,
  AuthSuccessPanel,
  Button,
} from '@wrap-roll/shared-ui';
import { AdminAuthService } from '../../../lib/auth';
import { supabase } from '../../../lib/supabaseClient';

type Status = 'loading' | 'forbidden' | 'error';

export default function AdminAuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Confirming your admin session...');

  useEffect(() => {
    const processAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next') || '/';

      const { session, error } = await AdminAuthService.getSession();
      if (error || !session) {
        const { data: localSession, error: localError } = await supabase.auth.getSession();
        if (localError || !localSession.session) {
          setStatus('error');
          setMessage(error?.message || localError?.message || 'Could not establish an authenticated session.');
          return;
        }

        const persisted = await AdminAuthService.setCookieSession(
          localSession.session.access_token,
          localSession.session.refresh_token,
        );
        if (persisted.error) {
          setStatus('error');
          setMessage(persisted.error.message);
          return;
        }
      }

      const { role } = await AdminAuthService.getUserRole();
      if (role !== 'ADMIN') {
        await AdminAuthService.signOut();
        setStatus('forbidden');
        setMessage('Your account is signed in, but does not have ADMIN access.');
        return;
      }

      router.replace(next);
    };

    processAuth();
  }, [router]);

  return (
    <AuthPageShell>
      <AuthSplitCard className="max-w-[520px] min-h-0">
        <AuthFormPanel className="items-center text-center">
        {status === 'loading' ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-black text-slate-900">Verifying access</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </>
        ) : (
          <AuthSuccessPanel className="w-full">
            <AuthSuccessIcon emoji={status === 'forbidden' ? '⛔' : '⚠️'} />
            <h1 className="text-xl font-black text-slate-900">
              {status === 'forbidden' ? 'Access denied' : 'Sign-in failed'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <Button className="mt-6 w-full" onClick={() => router.replace('/auth/signin')}>
              Back to admin sign in
            </Button>
          </AuthSuccessPanel>
        )}
        </AuthFormPanel>
      </AuthSplitCard>
    </AuthPageShell>
  );
}
