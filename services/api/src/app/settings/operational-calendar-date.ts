/** Minutes from midnight in `timeZone` (IANA). */
export function getBusinessMinuteOfDay(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(instant);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

/** YYYY-MM-DD calendar date in IANA `timeZone` for `instant`. */
export function zonedYmd(instant: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(instant);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const mo = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${mo}-${d}`;
}

/**
 * Ops-board "today" label: calendar date in business TZ, with the same overnight
 * anchor heuristic as queue windows (early morning before close belongs to prior ops day).
 */
export function computeOperationalCalendarDate(input: {
  now: Date;
  timeZone: string;
  openingTimeMinutes: number;
  closingTimeMinutes: number;
}): string {
  const tz = input.timeZone?.trim() || 'UTC';
  const openRaw = Number(input.openingTimeMinutes ?? 0);
  const closeRaw = Number(input.closingTimeMinutes ?? 24 * 60);
  const openMins = Math.min(24 * 60 - 1, Math.max(0, Number.isFinite(openRaw) ? openRaw : 0));
  const closeMins = Math.min(
    24 * 60 - 1,
    Math.max(0, Number.isFinite(closeRaw) ? closeRaw : 24 * 60 - 1),
  );
  const overnight = closeMins <= openMins;
  let anchor = input.now;
  if (overnight) {
    const mod = getBusinessMinuteOfDay(input.now, tz);
    if (mod < closeMins) {
      anchor = new Date(input.now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
  return zonedYmd(anchor, tz);
}

/**
 * Half-open UTC range `[start, end)` for the **calendar** day `dateYmd` in `timeZone`
 * (not open→close). Used for queue + reconciliation so late-night POS orders on the
 * same local date are not cut off at `closingTimeMinutes`.
 */
export function utcCalendarDayRangeInTimeZone(
  dateYmd: string,
  timeZone: string,
): { start: Date; end: Date } {
  const tz = timeZone?.trim() || 'UTC';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new RangeError(`Invalid dateYmd: ${dateYmd}`);
  }

  const zm = (ts: number) => zonedYmd(new Date(ts), tz);
  const [y, mo, d] = dateYmd.split('-').map(Number);
  let probe = Date.UTC(y, mo - 1, d, 12, 0, 0);
  if (zm(probe) !== dateYmd) {
    let found = false;
    for (let hop = -3; hop <= 3; hop++) {
      const p = probe + hop * 24 * 60 * 60 * 1000;
      if (zm(p) === dateYmd) {
        probe = p;
        found = true;
        break;
      }
    }
    if (!found) {
      throw new RangeError(`Cannot resolve calendar day ${dateYmd} in ${tz}`);
    }
  }

  const minute = 60_000;
  let startMs = probe;
  while (zm(startMs - minute) === dateYmd) startMs -= minute;

  let endMs = startMs + minute;
  while (zm(endMs) === dateYmd) endMs += minute;

  return { start: new Date(startMs), end: new Date(endMs) };
}
