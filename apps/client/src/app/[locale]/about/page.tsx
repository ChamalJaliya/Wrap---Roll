'use client';

import React from 'react';
import { HighlightStat, PageHeroHeader } from '@wrap-roll/shared-ui';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  clientContentWideClass,
  clientPageShellClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';

export default function AboutPage() {
  const t = useTranslations('About');

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <PageHeroHeader
          title={t.rich('title', {
            highlight: (chunks) => <span className="text-primary">{chunks}</span>,
          })}
          subtitle={t('lead')}
        />

        <section className="mb-12 grid max-w-5xl grid-cols-1 items-center gap-16 md:mx-auto md:grid-cols-2">
          <div className="relative order-first overflow-hidden rounded-[var(--radius-xl)] shadow-[0_40px_80px_rgba(0,0,0,0.12)] md:order-none">
            <img
              src="https://images.unsplash.com/photo-1533787761082-492a5b83e614?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt={t('imageAlt')}
              className="block w-full scale-[1.02]"
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"
              aria-hidden
            />
          </div>

          <div className="flex flex-col gap-6 text-center md:text-left">
            <h2 className={cn(clientSectionTitleClass, 'text-primary')}>
              {t('sectionTitle')}
            </h2>
            <p className="text-lg leading-relaxed text-neutral-700">
              {t.rich('p1', {
                bold: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="text-lg leading-relaxed text-neutral-700">
              {t('p2')}
            </p>
            <p className="text-lg leading-relaxed text-neutral-700">
              {t('p3')}
            </p>
          </div>
        </section>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:mx-auto sm:grid-cols-3">
          <HighlightStat value="15+" label={t('statRecipes')} />
          <HighlightStat value="100%" label={t('statFresh')} />
          <HighlightStat value="50k+" label={t('statFoodies')} />
        </div>

        <footer className="mt-20 pb-8 text-center">
          <p className="text-lg italic text-neutral-500">
            &ldquo;{t('quote')}&rdquo;
          </p>
        </footer>
      </div>
    </div>
  );
}
