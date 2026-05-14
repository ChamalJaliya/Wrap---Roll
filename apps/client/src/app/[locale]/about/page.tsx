'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { Card } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import {
  clientAccountStackClass,
  clientContentWideClass,
  clientElevatedCardClass,
  clientPageShellClass,
  clientSectionTitleClass,
  clientHeroGradientOrbClass,
  clientHeroGradientOrbSecondaryClass,
  clientHeroGradientShellClass,
} from '@/lib/client-page-shell';

export default function AboutPage() {
  const t = useTranslations('About');

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <header className={clientHeroGradientShellClass}>
            <div className={clientHeroGradientOrbClass} aria-hidden />
            <div className={clientHeroGradientOrbSecondaryClass} aria-hidden />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">Our story</p>
              <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
                {t.rich('title', {
                  highlight: (chunks) => <span className="text-orange-300">{chunks}</span>,
                })}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{t('lead')}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t('statRecipes')}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">15+</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t('statFresh')}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-amber-200">100%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t('statFoodies')}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-emerald-200">50k+</p>
                </div>
              </div>
            </div>
          </header>

          <Card className={cn(clientElevatedCardClass, 'overflow-hidden')}>
            <div className="grid grid-cols-1 items-stretch gap-0 lg:grid-cols-2">
              <div className="relative min-h-[240px] overflow-hidden lg:min-h-[420px]">
                <img
                  src="https://images.unsplash.com/photo-1533787761082-492a5b83e614?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt={t('imageAlt')}
                  className="h-full min-h-[240px] w-full object-cover lg:min-h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent lg:bg-gradient-to-r" aria-hidden />
              </div>
              <div className="flex flex-col justify-center gap-6 p-6 sm:p-8 lg:p-10">
                <h2 className={cn(clientSectionTitleClass, 'text-primary')}>{t('sectionTitle')}</h2>
                <p className="text-base leading-relaxed text-neutral-700 sm:text-lg">
                  {t.rich('p1', {
                    bold: (chunks) => <strong className="text-neutral-900">{chunks}</strong>,
                  })}
                </p>
                <p className="text-base leading-relaxed text-neutral-700 sm:text-lg">{t('p2')}</p>
                <p className="text-base leading-relaxed text-neutral-700 sm:text-lg">{t('p3')}</p>
              </div>
            </div>
          </Card>

          <div className="rounded-2xl border border-orange-200/50 bg-gradient-to-r from-orange-50/90 to-amber-50/80 px-6 py-8 text-center shadow-sm ring-1 ring-orange-500/10 sm:px-10">
            <Heart className="mx-auto mb-3 h-8 w-8 text-orange-500/80" aria-hidden />
            <p className="font-display text-lg font-medium italic leading-relaxed text-neutral-700 sm:text-xl">
              &ldquo;{t('quote')}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
