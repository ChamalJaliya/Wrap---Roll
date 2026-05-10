import { useMemo } from 'react';
import { isElevationExpired } from '../lib/supervisor-session';
import { useSupervisorStore } from '../store/useSupervisorStore';

/**
 * True when an elevation token exists and is not past client-side expiry (incl. skew).
 * Use this to gate supervisor-only UI on any screen (checkout, queue, support, etc.).
 */
export function useSupervisorSessionActive(): boolean {
  const elevation = useSupervisorStore((s) => s.elevation);
  return useMemo(
    () => Boolean(elevation && !isElevationExpired(elevation)),
    [elevation],
  );
}

/**
 * Non-null only while session is active — useful when you need `expiresAt` in UI.
 */
export function useSupervisorSession() {
  const elevation = useSupervisorStore((s) => s.elevation);
  const isActive = useMemo(
    () => Boolean(elevation && !isElevationExpired(elevation)),
    [elevation],
  );
  return { isActive, elevation: isActive ? elevation : null };
}
