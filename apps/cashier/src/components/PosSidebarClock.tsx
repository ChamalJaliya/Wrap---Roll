'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** Narrow sidebar: tiny stacked date/time */
  compact?: boolean;
  className?: string;
};

/**
 * Local wall clock for the POS sidebar only — updates on its own interval so the rest of the page does not re-render.
 */
export function PosSidebarClock({ compact, className }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
  const date = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (compact) {
    return (
      <time
        dateTime={now.toISOString()}
        className={`flex flex-col items-center rounded-xl border border-border/60 bg-white/90 px-2 py-1.5 text-center shadow-sm ${className ?? ''}`}
      >
        <span className="font-display text-[11px] font-black tabular-nums leading-none text-foreground">{time}</span>
        <span className="mt-0.5 max-w-[4.5rem] text-[9px] font-semibold leading-tight text-muted-foreground">
          {date}
        </span>
      </time>
    );
  }

  return (
    <time
      dateTime={now.toISOString()}
      className={`block rounded-xl border border-border/60 bg-white/80 px-3 py-2 shadow-sm ${className ?? ''}`}
    >
      <span className="font-display text-lg font-black tabular-nums leading-none tracking-tight text-foreground">
        {time}
      </span>
      <span className="mt-1 block text-[11px] font-semibold leading-snug text-muted-foreground">{date}</span>
    </time>
  );
}
