"use client";

import * as React from 'react';
import type { OperationsCalendar } from '@wrap-roll/contracts';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { FormToggleRow } from './FormToggleRow';
import { cn } from '../lib/utils';
import {
  addDaysYmd,
  CalendarView,
  formatMonthLabel,
  minutesToTime,
  rangeYmd,
  startOfMonthYmd,
  startOfWeekYmd,
  timeToMinutes,
  weekdayIndexSun0,
  ymdToUtcDate,
} from '../lib/ops-calendar-date';

type DayStatus = {
  ymd: string;
  inMonth: boolean;
  isToday: boolean;
  isClosed: boolean;
  hoursLabel?: string;
  note?: string;
};

function formatDayHeading(ymd: string | null): { title: string; isoLine: string } {
  if (!ymd) return { title: 'Day', isoLine: '' };
  const parts = ymd.split('-');
  if (parts.length !== 3) return { title: ymd, isoLine: '' };
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return { title: ymd, isoLine: '' };
  }
  const utc = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const title = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc);
  return { title, isoLine: ymd };
}

function ymdTodayInTimeZone(timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function deriveDayStatus(args: {
  ymd: string;
  monthStartYmd: string;
  calendar: OperationsCalendar;
  timeZone: string;
}): DayStatus {
  const { ymd, monthStartYmd, calendar, timeZone } = args;
  const ms = ymdToUtcDate(monthStartYmd);
  const d = ymdToUtcDate(ymd);
  const inMonth = d.getUTCMonth() === ms.getUTCMonth() && d.getUTCFullYear() === ms.getUTCFullYear();
  const today = ymdTodayInTimeZone(timeZone);
  const sp = calendar.specialHours?.[ymd];
  const closedByList = Array.isArray(calendar.closedDates) && calendar.closedDates.includes(ymd);
  const closedBySpecial = Boolean(sp?.closedForDay);
  const isClosed = closedByList || closedBySpecial;
  const note = typeof sp?.note === 'string' && sp.note.trim() ? sp.note.trim() : undefined;
  const hasHours =
    sp &&
    typeof sp.openingTimeMinutes === 'number' &&
    typeof sp.closingTimeMinutes === 'number';
  const hoursLabel = hasHours ? `${minutesToTime(sp.openingTimeMinutes!)}–${minutesToTime(sp.closingTimeMinutes!)}` : undefined;
  return {
    ymd,
    inMonth,
    isToday: ymd === today,
    isClosed,
    hoursLabel,
    note,
  };
}

function ViewToggle({
  value,
  onChange,
}: {
  value: CalendarView;
  onChange: (v: CalendarView) => void;
}) {
  const item = (id: CalendarView, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      className={cn(
        'rounded px-3 py-1 text-xs font-semibold transition-colors',
        value === id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-md border bg-white p-1">
      {item('month', 'Month')}
      {item('week', 'Week')}
      {item('day', 'Day')}
    </div>
  );
}

function DayCell({
  s,
  onClick,
}: {
  s: DayStatus;
  onClick: (ymd: string) => void;
}) {
  const d = ymdToUtcDate(s.ymd);
  const dayNum = d.getUTCDate();
  return (
    <button
      type="button"
      onClick={() => onClick(s.ymd)}
      className={cn(
        'flex h-24 w-full flex-col gap-1 rounded-lg border p-2 text-left transition-colors',
        s.inMonth ? 'bg-white' : 'bg-neutral-50 text-muted-foreground',
        s.isToday ? 'border-primary/60 ring-1 ring-primary/30' : 'hover:bg-muted/40',
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('text-xs font-bold', s.isToday ? 'text-primary' : 'text-neutral-800')}>
          {dayNum}
        </div>
        {s.isClosed ? <Badge variant="destructive">Closed</Badge> : null}
      </div>
      {s.hoursLabel ? (
        <div className="text-[11px] font-semibold text-neutral-700">{s.hoursLabel}</div>
      ) : null}
      {s.note ? (
        <div className="line-clamp-2 text-[11px] text-neutral-600">{s.note}</div>
      ) : null}
    </button>
  );
}

function DayEditorDialog({
  open,
  onOpenChange,
  ymd,
  calendar,
  onChangeCalendar,
  baseOpeningMinutes,
  baseClosingMinutes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ymd: string | null;
  calendar: OperationsCalendar;
  onChangeCalendar: (next: OperationsCalendar) => void;
  baseOpeningMinutes: number;
  baseClosingMinutes: number;
}) {
  const entry = ymd ? calendar.specialHours?.[ymd] : undefined;
  const isHoliday = Boolean(ymd && calendar.closedDates?.includes(ymd));
  const forcedClosed = isHoliday; // Backend treats `closedDates` as always-closed.
  const [closed, setClosed] = React.useState(false);
  const [openTime, setOpenTime] = React.useState(minutesToTime(baseOpeningMinutes));
  const [closeTime, setCloseTime] = React.useState(minutesToTime(baseClosingMinutes));
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!ymd) return;
    const sp = calendar.specialHours?.[ymd];
    setClosed(Boolean(sp?.closedForDay));
    setOpenTime(
      typeof sp?.openingTimeMinutes === 'number'
        ? minutesToTime(sp.openingTimeMinutes)
        : minutesToTime(baseOpeningMinutes),
    );
    setCloseTime(
      typeof sp?.closingTimeMinutes === 'number'
        ? minutesToTime(sp.closingTimeMinutes)
        : minutesToTime(baseClosingMinutes),
    );
    setNote(typeof sp?.note === 'string' ? sp.note : '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymd, open, calendar.closedDates, calendar.specialHours]);

  const save = () => {
    if (!ymd) return;
    const next = structuredClone(calendar) as OperationsCalendar;
    next.specialHours = next.specialHours ?? {};
    const nextEntry: any = { ...(next.specialHours[ymd] ?? {}) };

    if (forcedClosed || closed) {
      nextEntry.closedForDay = true;
      delete nextEntry.openingTimeMinutes;
      delete nextEntry.closingTimeMinutes;
    } else {
      const o = timeToMinutes(openTime);
      const c = timeToMinutes(closeTime);
      if (o == null || c == null) {
        setError('Please enter valid open and close times.');
        return;
      }
      if (o === c) {
        setError('Open and close cannot be the same time.');
        return;
      }
      nextEntry.closedForDay = false;
      nextEntry.openingTimeMinutes = o;
      nextEntry.closingTimeMinutes = c;
    }
    const trimmed = note.trim();
    if (trimmed) nextEntry.note = trimmed;
    else delete nextEntry.note;

    // If it’s a holiday, keep it in `closedDates` and treat specialHours as override metadata only.
    // For non-holidays, specialHours defines closure/hours.
    next.specialHours[ymd] = nextEntry;
    onChangeCalendar(next);
    onOpenChange(false);
  };

  const clearOverride = () => {
    if (!ymd) return;
    const next = structuredClone(calendar) as OperationsCalendar;
    if (next.specialHours && ymd in next.specialHours) {
      delete next.specialHours[ymd];
    }
    onChangeCalendar(next);
    onOpenChange(false);
  };

  const toggleHoliday = () => {
    if (!ymd) return;
    const next = structuredClone(calendar) as OperationsCalendar;
    next.closedDates = Array.isArray(next.closedDates) ? [...next.closedDates] : [];
    if (next.closedDates.includes(ymd)) next.closedDates = next.closedDates.filter((d) => d !== ymd);
    else next.closedDates.push(ymd);
    next.closedDates.sort();
    onChangeCalendar(next);
  };

  const heading = formatDayHeading(ymd);
  const overnightHint =
    !forcedClosed && !closed
      ? (() => {
          const o = timeToMinutes(openTime);
          const c = timeToMinutes(closeTime);
          if (o == null || c == null) return null;
          if (c <= o) {
            return (
              <p className="text-xs text-muted-foreground">
                Close time is before open — treated as an{' '}
                <strong className="font-semibold text-foreground">overnight</strong> window (into the next day).
              </p>
            );
          }
          return null;
        })()
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-[min(440px,92vw)] flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-none"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b border-border/70 bg-background px-5 pb-4 pt-5 sm:px-6">
          <SheetTitle className="pr-8 font-display text-xl font-black tracking-tight text-foreground">
            {heading.title}
          </SheetTitle>
          {heading.isoLine ? (
            <SheetDescription className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {heading.isoLine} · day override
            </SheetDescription>
          ) : (
            <SheetDescription className="text-sm text-muted-foreground">Edit schedule for this date</SheetDescription>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <section className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Holiday & flags
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <Button
                  type="button"
                  size="sm"
                  variant={isHoliday ? 'destructive' : 'outline'}
                  className="h-10 w-full shrink-0 sm:w-auto"
                  onClick={toggleHoliday}
                >
                  {isHoliday ? 'Holiday — closed' : 'Mark as holiday'}
                </Button>
                <div className="flex flex-wrap gap-2">
                  {entry ? (
                    <Badge variant="secondary" className="font-semibold">
                      Override exists
                    </Badge>
                  ) : null}
                  {forcedClosed ? (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-900">
                      Calendar closed
                    </Badge>
                  ) : null}
                </div>
              </div>
              {forcedClosed ? (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  This date is listed in <code className="rounded bg-muted px-1 py-0.5 text-[11px]">closedDates</code>{' '}
                  — customers always see it as closed. You can still leave an internal note below.
                </p>
              ) : null}
            </section>

            {!forcedClosed ? (
              <section className="space-y-3 rounded-xl border border-border/80 bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hours for this day
                </p>
                <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
                  <FormToggleRow
                    className="text-sm text-foreground"
                    label="Closed for day (override)"
                    inputProps={{
                      type: 'checkbox',
                      className: 'size-4 accent-primary',
                      checked: closed,
                      disabled: forcedClosed,
                      onChange: (e) => setClosed((e.target as HTMLInputElement).checked),
                    }}
                  />
                </div>

                {!closed ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`ops-cal-open-${ymd}`}>Open</Label>
                        <Input
                          id={`ops-cal-open-${ymd}`}
                          className="h-10"
                          type="time"
                          value={openTime}
                          onChange={(e) => setOpenTime(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`ops-cal-close-${ymd}`}>Close</Label>
                        <Input
                          id={`ops-cal-close-${ymd}`}
                          className="h-10"
                          type="time"
                          value={closeTime}
                          onChange={(e) => setCloseTime(e.target.value)}
                        />
                      </div>
                    </div>
                    {overnightHint}
                  </>
                ) : null}
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <Label htmlFor={`ops-cal-note-${ymd}`} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Note
              </Label>
              <Textarea
                id={`ops-cal-note-${ymd}`}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional — e.g. reason for special hours or closure"
                className="min-h-[5.5rem] resize-y text-sm"
              />
            </section>

            {error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <SheetFooter className="mt-0 shrink-0 flex-col gap-3 border-t border-border/80 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:w-auto"
            onClick={clearOverride}
            disabled={!ymd}
          >
            Clear override
          </Button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="h-10 w-full sm:w-auto" onClick={save} disabled={!ymd}>
              Save day
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function OpsCalendar({
  timeZone,
  calendar,
  onChangeCalendar,
  baseOpeningMinutes,
  baseClosingMinutes,
  initialView = 'month',
}: {
  timeZone: string;
  calendar: OperationsCalendar;
  onChangeCalendar: (next: OperationsCalendar) => void;
  baseOpeningMinutes: number;
  baseClosingMinutes: number;
  initialView?: CalendarView;
}) {
  const todayYmd = React.useMemo(() => ymdTodayInTimeZone(timeZone), [timeZone]);
  const [view, setView] = React.useState<CalendarView>(initialView);
  const [cursorYmd, setCursorYmd] = React.useState<string>(todayYmd);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [selectedYmd, setSelectedYmd] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCursorYmd((c) => (c ? c : todayYmd));
  }, [todayYmd]);

  const monthStart = startOfMonthYmd(cursorYmd);
  const monthLabel = formatMonthLabel(cursorYmd, timeZone);

  const openEditor = (ymd: string) => {
    setSelectedYmd(ymd);
    setEditorOpen(true);
  };

  const goPrev = () => {
    if (view === 'month') {
      const d = ymdToUtcDate(monthStart);
      const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      setCursorYmd(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`);
      return;
    }
    setCursorYmd(addDaysYmd(cursorYmd, view === 'week' ? -7 : -1));
  };
  const goNext = () => {
    if (view === 'month') {
      const d = ymdToUtcDate(monthStart);
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      setCursorYmd(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`);
      return;
    }
    setCursorYmd(addDaysYmd(cursorYmd, view === 'week' ? 7 : 1));
  };

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={goPrev}>
          Prev
        </Button>
        <Button type="button" variant="outline" onClick={() => setCursorYmd(todayYmd)}>
          Today
        </Button>
        <Button type="button" variant="outline" onClick={goNext}>
          Next
        </Button>
      </div>
      <div className="font-display text-lg font-black tracking-tight text-neutral-900">{monthLabel}</div>
      <ViewToggle value={view} onChange={setView} />
    </div>
  );

  const weekdayHeader = (() => {
    // Use the week containing cursor to label weekdays (in tz).
    const start = startOfWeekYmd(cursorYmd, timeZone, 1);
    const ymds = rangeYmd(start, 7);
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    return (
      <div className="grid grid-cols-7 gap-2">
        {ymds.map((y) => {
          const d = ymdToUtcDate(y);
          const noonUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
          return (
            <div key={y} className="px-2 text-[11px] font-bold text-muted-foreground">
              {fmt.format(noonUtc)}
            </div>
          );
        })}
      </div>
    );
  })();

  const monthGrid = (() => {
    const start = startOfWeekYmd(monthStart, timeZone, 1);
    const days = rangeYmd(start, 42);
    const statuses = days.map((d) =>
      deriveDayStatus({ ymd: d, monthStartYmd: monthStart, calendar, timeZone }),
    );
    return (
      <div className="space-y-2">
        {weekdayHeader}
        <div className="grid grid-cols-7 gap-2">
          {statuses.map((s) => (
            <DayCell key={s.ymd} s={s} onClick={openEditor} />
          ))}
        </div>
      </div>
    );
  })();

  const weekGrid = (() => {
    const start = startOfWeekYmd(cursorYmd, timeZone, 1);
    const days = rangeYmd(start, 7);
    const statuses = days.map((d) =>
      deriveDayStatus({ ymd: d, monthStartYmd: monthStart, calendar, timeZone }),
    );
    return (
      <div className="space-y-2">
        {weekdayHeader}
        <div className="grid grid-cols-7 gap-2">
          {statuses.map((s) => (
            <DayCell key={s.ymd} s={s} onClick={openEditor} />
          ))}
        </div>
      </div>
    );
  })();

  const dayView = (() => {
    const s = deriveDayStatus({ ymd: cursorYmd, monthStartYmd: monthStart, calendar, timeZone });
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-lg font-black">{cursorYmd}</div>
          <Button type="button" onClick={() => openEditor(cursorYmd)}>
            Edit day
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {s.isClosed ? <Badge variant="destructive">Closed</Badge> : <Badge variant="secondary">Open</Badge>}
          {s.hoursLabel ? <Badge variant="outline">{s.hoursLabel}</Badge> : null}
          {s.note ? <Badge variant="outline">Note</Badge> : null}
        </div>
        {s.note ? <p className="mt-3 text-sm text-neutral-700">{s.note}</p> : null}
      </div>
    );
  })();

  return (
    <div className="space-y-4">
      {toolbar}
      {view === 'month' ? monthGrid : view === 'week' ? weekGrid : dayView}
      <DayEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        ymd={selectedYmd}
        calendar={calendar}
        onChangeCalendar={onChangeCalendar}
        baseOpeningMinutes={baseOpeningMinutes}
        baseClosingMinutes={baseClosingMinutes}
      />
    </div>
  );
}

