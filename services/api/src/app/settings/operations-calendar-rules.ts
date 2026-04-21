import {
  DEFAULT_OPERATIONS_CALENDAR,
  type OperationsCalendar,
} from '@wrap-roll/contracts';
import {
  getBusinessMinuteOfDay,
  zonedYmd,
} from './operational-calendar-date';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function clampMinute(m: number): number {
  return Math.min(24 * 60 - 1, Math.max(0, Number.isFinite(m) ? m : 0));
}

export function normalizeOperationsCalendar(raw: unknown): OperationsCalendar {
  const base = { ...DEFAULT_OPERATIONS_CALENDAR };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const closedDates = Array.isArray(o.closedDates)
    ? o.closedDates
        .map((x) => String(x ?? '').trim())
        .filter((d) => YMD.test(d))
    : [];

  const specialHours: OperationsCalendar['specialHours'] = {};
  if (o.specialHours && typeof o.specialHours === 'object') {
    for (const [k, v] of Object.entries(o.specialHours as Record<string, unknown>)) {
      if (!YMD.test(k.trim())) continue;
      const key = k.trim();
      if (!v || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      specialHours[key] = {
        closedForDay: e.closedForDay === true,
        note: typeof e.note === 'string' ? e.note : undefined,
        openingTimeMinutes:
          e.openingTimeMinutes !== undefined ? clampMinute(Number(e.openingTimeMinutes)) : undefined,
        closingTimeMinutes:
          e.closingTimeMinutes !== undefined ? clampMinute(Number(e.closingTimeMinutes)) : undefined,
      };
    }
  }

  let emergencyClosureUntil: string | null | undefined;
  if (o.emergencyClosureUntil === null || o.emergencyClosureUntil === undefined) {
    emergencyClosureUntil = undefined;
  } else if (typeof o.emergencyClosureUntil === 'string' && o.emergencyClosureUntil.trim().length > 0) {
    const t = new Date(o.emergencyClosureUntil.trim());
    emergencyClosureUntil = Number.isNaN(t.getTime()) ? undefined : t.toISOString();
  } else {
    emergencyClosureUntil = undefined;
  }

  const emergencyClosureMessage =
    typeof o.emergencyClosureMessage === 'string' ? o.emergencyClosureMessage : undefined;

  return {
    closedDates,
    specialHours,
    emergencyClosureUntil: emergencyClosureUntil ?? null,
    emergencyClosureMessage,
  };
}

function deliveryCutoffMinutes(deliveryJson: unknown): number {
  const deliveryConfig =
    deliveryJson && typeof deliveryJson === 'object'
      ? (deliveryJson as Record<string, unknown>)
      : {};
  return Math.max(0, Number(deliveryConfig.orderCutoffBeforeCloseMinutes ?? 60));
}

/** Same window math as `OrderService.resolveOperationalWindowForReference` (server-local calendar day). */
export function resolveOperationalServiceWindow(
  reference: Date,
  openMins: number,
  closeMins: number,
): { start: Date; end: Date } {
  const dayStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    0,
    0,
    0,
    0,
  );
  const overnight = closeMins <= openMins;
  if (!overnight) {
    return {
      start: new Date(dayStart.getTime() + openMins * 60_000),
      end: new Date(dayStart.getTime() + closeMins * 60_000),
    };
  }
  const minsNow = reference.getHours() * 60 + reference.getMinutes();
  if (minsNow < closeMins) {
    return {
      start: new Date(dayStart.getTime() - 24 * 60 * 60 * 1000 + openMins * 60_000),
      end: new Date(dayStart.getTime() + closeMins * 60_000),
    };
  }
  return {
    start: new Date(dayStart.getTime() + openMins * 60_000),
    end: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 + closeMins * 60_000),
  };
}

function formatMinutesAsClock(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const mi = mins % 60;
  return new Date(2000, 0, 1, h, mi).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type EffectiveDay =
  | { kind: 'closed'; detail?: string }
  | { kind: 'open'; openMins: number; closeMins: number };

function effectiveDayMinutes(
  ymd: string,
  globalOpen: number,
  globalClose: number,
  cal: OperationsCalendar,
): EffectiveDay {
  if (cal.closedDates.includes(ymd)) {
    return { kind: 'closed', detail: 'This date is closed (holiday).' };
  }
  const sp = cal.specialHours[ymd];
  if (sp?.closedForDay) {
    return { kind: 'closed', detail: sp.note?.trim() || 'This date is marked closed in the calendar.' };
  }
  if (
    sp &&
    sp.openingTimeMinutes !== undefined &&
    sp.closingTimeMinutes !== undefined
  ) {
    const openMins = clampMinute(sp.openingTimeMinutes);
    const closeMins = clampMinute(sp.closingTimeMinutes);
    return { kind: 'open', openMins, closeMins };
  }
  return { kind: 'open', openMins: globalOpen, closeMins: globalClose };
}

export type CustomerOrderTimingInput = {
  now: Date;
  /** Null/undefined = ASAP */
  requestedTime: Date | null | undefined;
  timezone: string;
  openingTimeMinutes: number;
  closingTimeMinutes: number;
  scheduleSameDayOnly: boolean;
  minLeadTimeMinutes: number;
  deliveryJson: unknown;
  operationsCalendarJson: unknown;
  /**
   * In-store POS (takeaway / dine-in): staff can ring sales outside public opening/cutoff windows.
   * Never use for `delivery` or client-facing channels — those must respect schedule rules.
   * Emergency closure still applies.
   */
  bypassOperatingWindowForPos?: boolean;
};

export type CustomerOrderTimingResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateCustomerOrderTiming(input: CustomerOrderTimingInput): CustomerOrderTimingResult {
  const tz =
    typeof input.timezone === 'string' && input.timezone.trim().length > 0
      ? input.timezone.trim()
      : 'Asia/Colombo';
  const openMinsRaw = Number(input.openingTimeMinutes ?? 0);
  const closeMinsRaw = Number(input.closingTimeMinutes ?? 24 * 60 - 1);
  const globalOpen = clampMinute(Number.isFinite(openMinsRaw) ? openMinsRaw : 0);
  const globalClose = clampMinute(Number.isFinite(closeMinsRaw) ? closeMinsRaw : 24 * 60 - 1);

  const cal = normalizeOperationsCalendar(input.operationsCalendarJson);
  const cutoffBeforeCloseMins = deliveryCutoffMinutes(input.deliveryJson);

  if (cal.emergencyClosureUntil) {
    const until = new Date(cal.emergencyClosureUntil);
    if (!Number.isNaN(until.getTime()) && input.now.getTime() < until.getTime()) {
      return {
        ok: false,
        message:
          cal.emergencyClosureMessage?.trim() ||
          'Ordering is temporarily unavailable. Please try again later.',
      };
    }
  }

  if (input.bypassOperatingWindowForPos === true) {
    return { ok: true as const };
  }

  const requested = input.requestedTime ?? null;

  if (!requested) {
    const todayYmd = zonedYmd(input.now, tz);
    const eff = effectiveDayMinutes(todayYmd, globalOpen, globalClose, cal);
    if (eff.kind === 'closed') {
      return { ok: false, message: eff.detail ?? 'Ordering is closed today.' };
    }
    const openMins = eff.openMins;
    const closeMins = eff.closeMins;
    const overnight = closeMins <= openMins;
    const lastOrderMinuteOfDay = closeMins - cutoffBeforeCloseMins;

    if (!overnight) {
      const mod = getBusinessMinuteOfDay(input.now, tz);
      if (mod < openMins) {
        return {
          ok: false,
          message: `Ordering is not open yet. Service starts at ${formatMinutesAsClock(openMins)} (${tz}).`,
        };
      }
      if (mod >= lastOrderMinuteOfDay) {
        return {
          ok: false,
          message: `Ordering is closed for this service window. Last order time is ${formatMinutesAsClock(lastOrderMinuteOfDay)} (${tz}).`,
        };
      }
    } else {
      const nowWindow = resolveOperationalServiceWindow(input.now, openMins, closeMins);
      const lastOrderAt = new Date(nowWindow.end.getTime() - cutoffBeforeCloseMins * 60_000);
      if (input.now.getTime() < nowWindow.start.getTime()) {
        return {
          ok: false,
          message: `Ordering is not open yet. Service starts at ${nowWindow.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        };
      }
      if (input.now.getTime() >= lastOrderAt.getTime()) {
        return {
          ok: false,
          message: `Ordering is closed for this service window. Last order time is ${lastOrderAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        };
      }
    }
    return { ok: true as const };
  }

  if (Number.isNaN(requested.getTime())) {
    return { ok: false, message: 'Invalid requested time' };
  }

  if (input.scheduleSameDayOnly) {
    const a = zonedYmd(requested, tz);
    const b = zonedYmd(input.now, tz);
    if (a !== b) {
      return {
        ok: false,
        message: `Scheduled orders must be for the same calendar day as now (${tz}).`,
      };
    }
  }

  const reqYmd = zonedYmd(requested, tz);
  const eff = effectiveDayMinutes(reqYmd, globalOpen, globalClose, cal);
  if (eff.kind === 'closed') {
    return { ok: false, message: eff.detail ?? 'Cannot schedule for a closed day.' };
  }
  const openMins = eff.openMins;
  const closeMins = eff.closeMins;
  const overnight = closeMins <= openMins;

  if (!overnight) {
    const modR = getBusinessMinuteOfDay(requested, tz);
    if (modR < openMins || modR >= closeMins) {
      return {
        ok: false,
        message: `Scheduled time must be within opening hours (${tz}).`,
      };
    }
    if (modR >= closeMins - cutoffBeforeCloseMins) {
      return {
        ok: false,
        message: `Scheduled time is too close to closing. Last slot is before ${formatMinutesAsClock(closeMins - cutoffBeforeCloseMins)} (${tz}).`,
      };
    }
  } else {
    const reqWindow = resolveOperationalServiceWindow(requested, openMins, closeMins);
    if (requested.getTime() < reqWindow.start.getTime() || requested.getTime() > reqWindow.end.getTime()) {
      return { ok: false, message: 'Scheduled time must be within opening hours' };
    }
    const requestedCutoffAt = new Date(reqWindow.end.getTime() - cutoffBeforeCloseMins * 60_000);
    if (requested.getTime() >= requestedCutoffAt.getTime()) {
      return {
        ok: false,
        message: `Scheduled time is too close to closing. Last slot is before ${requestedCutoffAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      };
    }
  }

  const lead = Number(input.minLeadTimeMinutes ?? 0);
  const minAllowed = new Date(input.now.getTime() + lead * 60_000);
  if (requested.getTime() < minAllowed.getTime()) {
    return {
      ok: false,
      message: `Scheduled time must be at least ${lead} minutes from now`,
    };
  }

  return { ok: true as const };
}

export function evaluatePublicOrderAcceptance(input: {
  now: Date;
  timezone: string;
  openingTimeMinutes: number;
  closingTimeMinutes: number;
  deliveryJson: unknown;
  operationsCalendarJson: unknown;
}): { accepting: boolean; closureReason?: string } {
  const r = validateCustomerOrderTiming({
    now: input.now,
    requestedTime: null,
    timezone: input.timezone,
    openingTimeMinutes: input.openingTimeMinutes,
    closingTimeMinutes: input.closingTimeMinutes,
    scheduleSameDayOnly: true,
    minLeadTimeMinutes: 0,
    deliveryJson: input.deliveryJson,
    operationsCalendarJson: input.operationsCalendarJson,
  });
  if (r.ok === false) {
    return { accepting: false, closureReason: r.message };
  }
  return { accepting: true };
}
