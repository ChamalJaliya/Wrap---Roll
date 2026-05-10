'use client';

import { useEffect, useRef } from 'react';
import { useSupervisorStore } from '../store/useSupervisorStore';

const TICK_MS = 15_000;

/**
 * Clears in-memory supervisor elevation when past expiry (with skew). Runs on an
 * interval and when the tab becomes visible so the UI and checkout stay aligned.
 */
export function useSupervisorExpiryWatcher() {
  const clearExpiredElevation = useSupervisorStore((s) => s.clearExpiredElevation);
  const tickRef = useRef(() => {
    clearExpiredElevation();
  });

  useEffect(() => {
    tickRef.current = () => clearExpiredElevation();
  }, [clearExpiredElevation]);

  useEffect(() => {
    const run = () => tickRef.current();
    run();
    const id = window.setInterval(run, TICK_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}
