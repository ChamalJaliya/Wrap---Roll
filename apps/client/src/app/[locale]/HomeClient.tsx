'use client';

import React, { Suspense } from 'react';
import { Button } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import { clientHomeLowerClass } from '@/lib/client-page-shell';
import { MenuBrowser } from '../../components/MenuBrowser';
import { useTranslations } from 'next-intl';

function HeroSection() {
  const t = useTranslations('Home');
  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden bg-neutral-950">
      <img
        src="https://images.unsplash.com/photo-1662116765994-1e0202793080?q=80&w=2000"
        className="absolute inset-0 z-[1] h-full w-full object-cover opacity-45"
        alt={t('heroImageAlt')}
      />
      <div
        className="absolute inset-0 z-[2] bg-gradient-to-br from-neutral-950 via-neutral-950/85 to-neutral-950/55"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-[2] bg-gradient-to-r from-black/80 via-black/45 to-transparent md:from-black/70"
        aria-hidden
      />

      <div className="relative z-[3] mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col justify-center px-6 pb-16 pt-24 md:px-10 md:pb-24 md:pt-28">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/95 backdrop-blur-sm">
            {t('badge')}
          </span>

          <h1 className="mt-8 font-display text-[clamp(2.75rem,10vw,6rem)] font-black leading-[1.02] tracking-tight text-white md:mt-10">
            <span className="block sm:inline">{t('heroLine1')}</span>{' '}
            <span className="font-semibold text-white/90 sm:font-bold">
              {t('heroConjunction')}{' '}
            </span>
            <span className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--color-mandarin-low))] bg-clip-text text-transparent">
              {t('heroLine2')}
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 md:mt-8 md:text-lg md:leading-relaxed">
            {t('heroSubtitle')}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4 md:mt-12">
            <Button
              variant="default"
              size="lg"
              onClick={() =>
                document.getElementById('menu-anchor')?.scrollIntoView({
                  behavior: 'smooth',
                })
              }
              className="h-12 rounded-full px-8 text-sm font-semibold uppercase tracking-[0.12em] shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              {t('exploreMenu')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                document.getElementById('menu-anchor')?.scrollIntoView({
                  behavior: 'smooth',
                })
              }
              className="h-12 rounded-full border-white/35 bg-white/10 px-8 text-sm font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm hover:bg-white/20"
            >
              {t('viewHighlights')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomeClient() {
  return (
    <div className={cn('relative min-h-screen bg-gradient-to-b from-neutral-50 to-white px-0 pb-12', clientHomeLowerClass)}>
      <HeroSection />
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-48">
            <div
              className="h-20 w-20 animate-spin rounded-full border-4 border-neutral-100 border-t-primary"
              aria-hidden
            />
          </div>
        }
      >
        <MenuBrowser />
      </Suspense>
    </div>
  );
}
