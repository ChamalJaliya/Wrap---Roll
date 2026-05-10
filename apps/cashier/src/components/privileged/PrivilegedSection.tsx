'use client';

import type { ReactNode } from 'react';
import { useSupervisorSessionActive } from '../../hooks/useSupervisorSession';

/**
 * Renders children only while supervisor elevation is valid. Use on mixed pages to
 * colocate privileged controls next to the action they affect.
 */
export function PrivilegedSection({ children }: { children: ReactNode }) {
  const active = useSupervisorSessionActive();
  if (!active) return null;
  return <>{children}</>;
}
