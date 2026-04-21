'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2Icon } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { Button } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import {
  clientGlassPanelFlatClass,
  clientPageShellClass,
} from '@/lib/client-page-shell';
import { withLocalePrefix } from '@/lib/locale-path';

export default function AuthCallbackPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Auth');
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStatus('error');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const redirectNext = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const raw = searchParams.get('next');
      return withLocalePrefix(raw, locale);
    };

    const handleAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          setStatus('success');
          router.push(redirectNext());
        } else {
          timeoutId = setTimeout(() => {
            setStatus('error');
          }, 5000);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
      }
    };

    handleAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearTimeout(timeoutId);
        setStatus('success');
        router.push(redirectNext());
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [router, locale]);

  return (
    <div
      className={cn(
        clientPageShellClass,
        'flex flex-col items-center justify-center px-6 py-16 text-center text-neutral-900',
      )}
    >
      {status === 'loading' && (
        <>
          <Loader2Icon
            className="size-14 animate-spin text-primary"
            aria-hidden
          />
          <h2 className="mt-6 font-display text-2xl font-extrabold text-neutral-900">
            {t('callbackConfirming')}
          </h2>
          <p className="mt-2 text-neutral-600">{t('callbackRolling')}</p>
        </>
      )}

      {status === 'error' && (
        <div
          className={cn(
            clientGlassPanelFlatClass,
            'animate-in fade-in zoom-in-95 max-w-md duration-300',
          )}
        >
          <div className="text-6xl" aria-hidden>
            🥯
          </div>
          <h2 className="mt-6 font-display text-2xl font-extrabold text-neutral-900">
            {t('callbackTimeoutTitle')}
          </h2>
          <p className="mx-auto mt-2 text-neutral-600">
            {t('callbackTimeoutBody')}
          </p>
          <Button
            className="mt-8 w-full"
            variant="premium"
            size="lg"
            onClick={() => router.push(`/${locale}/auth/signin`)}
          >
            {t('callbackBackSignIn')}
          </Button>
        </div>
      )}
    </div>
  );
}
