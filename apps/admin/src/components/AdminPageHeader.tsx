'use client';

import type { ReactNode } from 'react';
import { cn } from '@wrap-roll/shared-ui';
import {
  adminPageHeaderRowClass,
  adminPageSubtitleClass,
  adminPageTitleClass,
} from '../lib/admin-ui-contract';

export type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Canonical admin page title — typography comes from `admin-ui-contract.ts`. */
export function AdminPageHeader({ title, description, actions, className }: AdminPageHeaderProps) {
  return (
    <header className={cn(adminPageHeaderRowClass, className)}>
      <div className="min-w-0 flex-1">
        <h1 className={adminPageTitleClass}>{title}</h1>
        {description ? (
          <div className={adminPageSubtitleClass}>{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
