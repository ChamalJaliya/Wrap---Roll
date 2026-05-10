import { useEffect, useState } from 'react';

/** Re-render periodically so elapsed-time labels stay fresh without ticking every second in tests. */
export function useNowInterval(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
