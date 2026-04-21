'use client';

import React, { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { MenuBrowser } from '../../../components/MenuBrowser';
import {
  clientDisplayHeadingSolidXlClass,
  clientLeadClass,
  clientMaxMenuClass,
  clientPageShellClass,
} from '@/lib/client-page-shell';

export default function MenuPage() {
  return (
    <main className={cn(clientPageShellClass, 'pb-24 pt-28')}>
      <div className={cn(clientMaxMenuClass, 'mb-20 text-center')}>
        <h1 className={cn(clientDisplayHeadingSolidXlClass, 'mb-6')}>
          Curated <span className="text-primary italic">Flavors</span>
        </h1>
        <p className={cn(clientLeadClass, 'mx-auto max-w-2xl font-medium tracking-tight')}>
          From fire-roasted signature rolls to our artisanal small-batch sides. Every
          ingredient is hand-picked for the ultimate street food experience.
        </p>
      </div>

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
    </main>
  );
}
