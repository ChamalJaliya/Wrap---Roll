import React from 'react';
import { getTranslations } from 'next-intl/server';
import { Separator } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import {
  clientContentNarrowClass,
  clientDisplayHeadingSolidLgClass,
  clientGlassPanelFlatClass,
  clientPageShellClass,
} from '@/lib/client-page-shell';

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');

  return (
    <div className={clientPageShellClass}>
      <article className={cn(clientContentNarrowClass)}>
        <div className={clientGlassPanelFlatClass}>
          <h1 className={cn(clientDisplayHeadingSolidLgClass, 'mb-4')}>
            {t('title')}
          </h1>
          <p className="mb-10 text-sm text-neutral-500">{t('lastUpdated')}</p>
          <Separator className="mb-10" />
          <div className="max-w-none space-y-8 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900">
            <section>
              <h2>{t('section1Title')}</h2>
              <p className="leading-relaxed text-neutral-600">
                {t('section1Body')}
              </p>
            </section>
            <section>
              <h2>{t('section2Title')}</h2>
              <p className="leading-relaxed text-neutral-600">
                {t('section2Body')}
              </p>
            </section>
            <section>
              <h2>{t('section3Title')}</h2>
              <p className="leading-relaxed text-neutral-600">
                {t('section3Body')}
              </p>
            </section>
          </div>
        </div>
      </article>
    </div>
  );
}
