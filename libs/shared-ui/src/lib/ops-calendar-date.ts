export type CalendarView = 'month' | 'week' | 'day';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertYmd(ymd: string): string {
  const v = String(ymd ?? '').trim();
  if (!YMD_RE.test(v)) throw new Error(`Invalid YYYY-MM-DD: ${v}`);
  return v;
}

export function ymdToUtcDate(ymd: string): Date {
  const v = assertYmd(ymd);
  const [y, m, d] = v.split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export function utcDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const base = ymdToUtcDate(ymd);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return utcDateToYmd(next);
}

export function startOfMonthYmd(ymd: string): string {
  const d = ymdToUtcDate(ymd);
  return utcDateToYmd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

export function formatMonthLabel(ymd: string, timeZone: string): string {
  const d = ymdToUtcDate(startOfMonthYmd(ymd));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric',
  });
  // Use UTC-noon to avoid shifting date across zones.
  const noonUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
  return fmt.format(noonUtc);
}

const WEEKDAYS_SUN0 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function weekdayKey(ymd: string, timeZone: string): (typeof WEEKDAYS_SUN0)[number] {
  const d = ymdToUtcDate(assertYmd(ymd));
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
  const noonUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
  const label = fmt.format(noonUtc).toLowerCase();
  if (label.startsWith('sun')) return 'sun';
  if (label.startsWith('mon')) return 'mon';
  if (label.startsWith('tue')) return 'tue';
  if (label.startsWith('wed')) return 'wed';
  if (label.startsWith('thu')) return 'thu';
  if (label.startsWith('fri')) return 'fri';
  return 'sat';
}

export function weekdayIndexSun0(ymd: string, timeZone: string): number {
  const k = weekdayKey(ymd, timeZone);
  return WEEKDAYS_SUN0.indexOf(k);
}

export function startOfWeekYmd(ymd: string, timeZone: string, weekStartsOn: 0 | 1 = 1): string {
  const idx = weekdayIndexSun0(ymd, timeZone);
  const delta = (idx - weekStartsOn + 7) % 7;
  return addDaysYmd(ymd, -delta);
}

export function rangeYmd(startYmd: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(addDaysYmd(startYmd, i));
  return out;
}

export function minutesToTime(mins: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Number(mins)));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function timeToMinutes(time: string): number | null {
  const [hhRaw, mmRaw] = String(time ?? '').split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const mins = hh * 60 + mm;
  if (mins < 0 || mins > 24 * 60 - 1) return null;
  return mins;
}

