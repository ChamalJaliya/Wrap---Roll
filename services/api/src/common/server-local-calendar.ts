/**
 * Start/end of the calendar day containing `reference` in the Node process timezone.
 * Used by analytics daily sales and admin dashboard order list so "today" matches everywhere.
 */
export function serverLocalCalendarDayBounds(reference: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const end = new Date(reference);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * YYYY-MM-DD for the calendar day of `instant` in the Node process timezone.
 * Do not use `toISOString().split('T')[0]` for display with local-midnight bounds — that is UTC and
 * will be one day off in most non-UTC timezones.
 */
export function serverLocalDateYmd(instant: Date): string {
  const y = instant.getFullYear();
  const m = String(instant.getMonth() + 1).padStart(2, '0');
  const d = String(instant.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
