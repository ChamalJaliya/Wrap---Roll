'use client';

import type { ReactNode } from 'react';
import { useSupervisorSessionActive } from '../../hooks/useSupervisorSession';

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Bordered panel shown only with an active supervisor session — consistent shell for
 * in-context privileged tools (manual discount, future overrides, etc.).
 */
export function PrivilegedSurface({ title, children, className = '' }: Props) {
  const active = useSupervisorSessionActive();
  if (!active) return null;
  return (
    <div
      className={`rounded-xl border border-emerald-200/90 bg-emerald-50/45 px-3 py-2.5 shadow-sm ${className}`.trim()}
    >
      {title ? (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-900/85">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}
