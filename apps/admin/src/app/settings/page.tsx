'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';
import { AdminAuthService } from '../../lib/auth';
import {
  DEFAULT_OPERATIONS_CALENDAR,
  DEFAULT_PAYMENT_METHODS,
  type OperationsCalendar,
  type PaymentMethodsConfig,
} from '@wrap-roll/contracts';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormToggleRow,
  Input,
  Label,
  NativeSelect,
  OpsCalendar,
  toast,
} from '@wrap-roll/shared-ui';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import {
  adminInlineAlertErrorClass,
  adminPageContainerClass,
  adminPageRootClass,
} from '../../lib/admin-ui-contract';

type AdminSettings = {
  id: string;
  timezone: string;
  openingTimeMinutes: number;
  closingTimeMinutes: number;
  scheduleSameDayOnly: boolean;
  minLeadTimeMinutes: number;
  businessName: string;
  contactEmail: string;
  replyToEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  deliveryJson?: unknown;
  paymentJson?: unknown;
  operationsCalendarJson?: OperationsCalendar | null;
};

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

/** Merge partial `methods` into Advanced payment JSON (keeps textarea and toggles aligned). */
function patchPaymentJsonText(text: string, patch: Partial<PaymentMethodsConfig>): string {
  try {
    const root = JSON.parse(text) as Record<string, unknown>;
    const prev =
      root.methods && typeof root.methods === 'object'
        ? (root.methods as Record<string, unknown>)
        : {};
    root.methods = { ...prev, ...patch };
    return JSON.stringify(root, null, 2) + '\n';
  } catch {
    return text;
  }
}

function patchPaymentJsonPos(
  text: string,
  patch: Partial<{ requireSupervisorForCardCollection: boolean }>,
): string {
  try {
    const root = JSON.parse(text) as Record<string, unknown>;
    const prev =
      root.pos && typeof root.pos === 'object'
        ? (root.pos as Record<string, unknown>)
        : {};
    root.pos = { ...prev, ...patch };
    return JSON.stringify(root, null, 2) + '\n';
  } catch {
    return text;
  }
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<AdminSettings | null>(null);

  const [openTime, setOpenTime] = useState('10:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [minLead, setMinLead] = useState(20);
  const [sameDayOnly, setSameDayOnly] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Colombo');

  const [businessName, setBusinessName] = useState('Wrap & Roll');
  const [contactEmail, setContactEmail] = useState('hello@wrapandroll.lk');
  const [replyToEmail, setReplyToEmail] = useState('hello@wrapandroll.lk');
  const [contactPhone, setContactPhone] = useState('+94 77 123 4567');
  const [addressLine1, setAddressLine1] = useState('123 Flavor Street,');
  const [addressLine2, setAddressLine2] = useState('Foodie District, Colombo 03');
  const [orderCutoffBeforeCloseMinutes, setOrderCutoffBeforeCloseMinutes] = useState(60);

  const [paymentJsonText, setPaymentJsonText] = useState('{\n  "provider": "payhere"\n}\n');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsConfig>(DEFAULT_PAYMENT_METHODS);
  const [requireSupervisorForCardCollection, setRequireSupervisorForCardCollection] =
    useState(false);

  const [opsCalendar, setOpsCalendar] = useState<OperationsCalendar>(DEFAULT_OPERATIONS_CALENDAR);
  const [emergencyUntilLocal, setEmergencyUntilLocal] = useState('');
  const [emergencyMessage, setEmergencyMessage] = useState('');

  const [adminStaff, setAdminStaff] = useState<{ id: string; email: string; fullName: string }[]>(
    [],
  );
  const [supervisorStaffId, setSupervisorStaffId] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [supervisorPinConfirm, setSupervisorPinConfirm] = useState('');
  const [supervisorPinLoading, setSupervisorPinLoading] = useState(true);
  const [supervisorPinSaving, setSupervisorPinSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/admin/settings');
        const s = data as AdminSettings;
        setRaw(s);
        setTimezone(s.timezone ?? 'Asia/Colombo');
        setOpenTime(minutesToTime(Number(s.openingTimeMinutes ?? 600)));
        setCloseTime(minutesToTime(Number(s.closingTimeMinutes ?? 1380)));
        setSameDayOnly(Boolean(s.scheduleSameDayOnly ?? true));
        setMinLead(Number(s.minLeadTimeMinutes ?? 20));
        setBusinessName(s.businessName ?? 'Wrap & Roll');
        setContactEmail(s.contactEmail ?? 'hello@wrapandroll.lk');
        setReplyToEmail(s.replyToEmail ?? 'hello@wrapandroll.lk');
        setContactPhone(s.contactPhone ?? '+94 77 123 4567');
        setAddressLine1(s.addressLine1 ?? '123 Flavor Street,');
        setAddressLine2(s.addressLine2 ?? 'Foodie District, Colombo 03');
        const deliveryRules = ((s as { deliveryJson?: unknown }).deliveryJson ?? {
          orderCutoffBeforeCloseMinutes: 60,
        }) as Record<string, unknown>;
        setOrderCutoffBeforeCloseMinutes(
          Number(deliveryRules.orderCutoffBeforeCloseMinutes ?? 60),
        );
        const rawPayment = ((s as any).paymentJson ?? { provider: 'payhere' }) as any;
        const methods = rawPayment?.methods ?? {};
        setPaymentMethods({
          cash: methods.cash === undefined ? true : Boolean(methods.cash),
          payhere:
            methods.payhere === undefined
              ? String(rawPayment?.provider ?? 'payhere') === 'payhere'
              : Boolean(methods.payhere),
          card: methods.card === undefined ? false : Boolean(methods.card),
          online: methods.online === undefined ? false : Boolean(methods.online),
        });
        const posBlock =
          rawPayment?.pos && typeof rawPayment.pos === 'object'
            ? (rawPayment.pos as Record<string, unknown>)
            : {};
        setRequireSupervisorForCardCollection(
          posBlock.requireSupervisorForCardCollection === true,
        );
        setPaymentJsonText(JSON.stringify(rawPayment, null, 2) + '\n');

        const oc = (s as AdminSettings).operationsCalendarJson ?? DEFAULT_OPERATIONS_CALENDAR;
        setOpsCalendar({
          closedDates: Array.isArray(oc.closedDates) ? oc.closedDates : [],
          specialHours: oc.specialHours && typeof oc.specialHours === 'object' ? oc.specialHours : {},
          emergencyClosureUntil: oc.emergencyClosureUntil ?? null,
          emergencyClosureMessage: oc.emergencyClosureMessage,
        });
        if (oc.emergencyClosureUntil) {
          const d = new Date(oc.emergencyClosureUntil);
          if (!Number.isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            setEmergencyUntilLocal(
              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
            );
          } else {
            setEmergencyUntilLocal('');
          }
        } else {
          setEmergencyUntilLocal('');
        }
        setEmergencyMessage(oc.emergencyClosureMessage ?? '');
      } catch (e: any) {
        const message = e?.response?.data?.error || e?.message || 'Failed to load settings';
        setError(message);
        toast.error(String(message));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAdminsForPin() {
      setSupervisorPinLoading(true);
      try {
        const [{ user }, listRes] = await Promise.all([
          AdminAuthService.getCurrentUser(),
          api.get<{ items?: { id: string; email: string; fullName: string; role: string }[] }>(
            '/staff/users?role=ADMIN&limit=100&page=1',
          ),
        ]);
        if (cancelled) return;
        const items = Array.isArray(listRes.data?.items) ? listRes.data.items : [];
        const admins = items
          .filter((u) => u.role === 'ADMIN')
          .map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName || u.email,
          }));
        setAdminStaff(admins);
        const sessionEmail = String(user?.email ?? '')
          .trim()
          .toLowerCase();
        const match = admins.find((a) => a.email.trim().toLowerCase() === sessionEmail);
        setSupervisorStaffId((prev) => {
          if (prev && admins.some((a) => a.id === prev)) return prev;
          return match?.id ?? admins[0]?.id ?? '';
        });
      } catch {
        if (!cancelled) {
          setAdminStaff([]);
          setSupervisorStaffId('');
        }
      } finally {
        if (!cancelled) setSupervisorPinLoading(false);
      }
    }
    void loadAdminsForPin();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSupervisorPin = async (event: FormEvent) => {
    event.preventDefault();
    const pin = supervisorPin.trim();
    const confirm = supervisorPinConfirm.trim();
    if (!supervisorStaffId) {
      toast.error('Choose an admin account first.');
      return;
    }
    if (pin.length < 6) {
      toast.error('PIN must be at least 6 characters.');
      return;
    }
    if (pin !== confirm) {
      toast.error('PIN and confirmation do not match.');
      return;
    }
    setSupervisorPinSaving(true);
    try {
      await api.patch(`/supervisor/pins/${supervisorStaffId}`, { pin });
      setSupervisorPin('');
      setSupervisorPinConfirm('');
      toast.success('Supervisor PIN saved. Cashiers can use it for step-up on the register.');
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        e?.message ??
        'Could not save supervisor PIN';
      const text = Array.isArray(message) ? message.join(', ') : String(message);
      toast.error(text);
    } finally {
      setSupervisorPinSaving(false);
    }
  };

  const parsedPaymentJson = useMemo(() => {
    try {
      return { value: JSON.parse(paymentJsonText), error: null as string | null };
    } catch (e: any) {
      return { value: null, error: e?.message || 'Invalid JSON' };
    }
  }, [paymentJsonText]);

  // When you edit `methods` in the JSON textarea, mirror into toggles (Save uses `paymentMethods`).
  useEffect(() => {
    if (parsedPaymentJson.error || parsedPaymentJson.value == null) return;
    const root = parsedPaymentJson.value as Record<string, unknown>;
    const m = root.methods;
    if (!m || typeof m !== 'object') return;
    const mm = m as Record<string, unknown>;
    setPaymentMethods((prev) => ({
      cash: 'cash' in mm ? Boolean(mm.cash) : prev.cash,
      payhere: 'payhere' in mm ? Boolean(mm.payhere) : prev.payhere,
      card: 'card' in mm ? Boolean(mm.card) : prev.card,
      online: 'online' in mm ? Boolean(mm.online) : prev.online,
    }));
    const pos = root.pos;
    if (pos && typeof pos === 'object') {
      const pp = pos as Record<string, unknown>;
      setRequireSupervisorForCardCollection(pp.requireSupervisorForCardCollection === true);
    }
  }, [parsedPaymentJson.error, parsedPaymentJson.value]);

  const onSave = async () => {
    if (parsedPaymentJson.error) return;
    setSaving(true);
    setError(null);
    try {
      const paymentRoot = (parsedPaymentJson.value ?? {}) as Record<string, unknown>;
      let emergencyClosureUntil: string | null = null;
      if (emergencyUntilLocal.trim()) {
        const t = new Date(emergencyUntilLocal);
        emergencyClosureUntil = Number.isNaN(t.getTime()) ? null : t.toISOString();
      }
      const operationsCalendarJson: OperationsCalendar = {
        closedDates: Array.isArray(opsCalendar.closedDates) ? opsCalendar.closedDates : [],
        specialHours:
          opsCalendar.specialHours && typeof opsCalendar.specialHours === 'object'
            ? opsCalendar.specialHours
            : {},
        emergencyClosureUntil,
        emergencyClosureMessage: emergencyMessage.trim() || undefined,
      };
      const prevDelivery =
        raw?.deliveryJson && typeof raw.deliveryJson === 'object' && raw.deliveryJson !== null
          ? { ...(raw.deliveryJson as Record<string, unknown>) }
          : {};
      const payload = {
        timezone,
        openingTimeMinutes: timeToMinutes(openTime),
        closingTimeMinutes: timeToMinutes(closeTime),
        scheduleSameDayOnly: sameDayOnly,
        minLeadTimeMinutes: Number(minLead),
        businessName,
        contactEmail,
        replyToEmail,
        contactPhone,
        addressLine1,
        addressLine2,
        deliveryJson: {
          ...prevDelivery,
          orderCutoffBeforeCloseMinutes: Number(orderCutoffBeforeCloseMinutes),
        },
        // `paymentMethods` is kept in sync with valid JSON via the effect + checkbox patchers.
        paymentJson: {
          ...paymentRoot,
          methods: paymentMethods,
          pos: {
            ...(typeof paymentRoot.pos === 'object' && paymentRoot.pos !== null
              ? (paymentRoot.pos as Record<string, unknown>)
              : {}),
            requireSupervisorForCardCollection,
          },
        },
        operationsCalendarJson,
      };
      const { data } = await api.put('/admin/settings', payload);
      setRaw(data);
      toast.success('Settings saved successfully');
    } catch (e: any) {
      const message = e?.response?.data?.error || e?.message || 'Failed to save settings';
      setError(message);
      toast.error(String(message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <AdminPageHeader
          title="Business Settings"
          description="Timezone, hours, calendar overrides, contact details, payments JSON, and supervisor PIN."
        />

        {error ? <div className={adminInlineAlertErrorClass}>{error}</div> : null}

        <Card className="mb-6 border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
          <CardContent className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-neutral-900">Tax & local delivery</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Configure VAT for web checkout and delivery fees (flat fee, distance bands, and JSON).
              </p>
            </div>
            <Button className="h-10 shrink-0" variant="default" asChild>
              <Link href="/pricing">Open tax & delivery</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6 border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>Supervisor PIN (register)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm leading-relaxed text-neutral-600">
              Set the PIN cashiers enter with a supervisor&apos;s email when the POS asks for approval
              (discounts, voids, and similar). Only admin accounts can have a supervisor PIN.
            </p>
            {supervisorPinLoading ? (
              <p className="text-sm text-neutral-500">Loading admin accounts…</p>
            ) : adminStaff.length === 0 ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No admin users found. Add an admin under Staff first.
              </p>
            ) : (
              <form className="flex max-w-2xl flex-col gap-5" onSubmit={saveSupervisorPin}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="supervisor-pin-admin">Admin account</Label>
                  <NativeSelect
                    id="supervisor-pin-admin"
                    className="h-10 min-h-10 py-2"
                    value={supervisorStaffId}
                    onChange={(e) => setSupervisorStaffId(e.target.value)}
                  >
                    {adminStaff.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fullName} ({a.email})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="supervisor-pin-new">New PIN</Label>
                    <Input
                      id="supervisor-pin-new"
                      className="h-10"
                      type="password"
                      autoComplete="new-password"
                      value={supervisorPin}
                      onChange={(e) => setSupervisorPin(e.target.value)}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="supervisor-pin-confirm">Confirm PIN</Label>
                    <Input
                      id="supervisor-pin-confirm"
                      className="h-10"
                      type="password"
                      autoComplete="new-password"
                      value={supervisorPinConfirm}
                      onChange={(e) => setSupervisorPinConfirm(e.target.value)}
                      placeholder="Repeat PIN"
                    />
                  </div>
                </div>
                <div className="flex justify-end border-t border-border/70 pt-5">
                  <Button className="h-10 min-w-[12rem]" type="submit" disabled={supervisorPinSaving}>
                    {supervisorPinSaving ? 'Saving…' : 'Save supervisor PIN'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card className="border-border/80 shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle>Operations calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <p className="text-xs leading-relaxed text-neutral-500">
                Dates use the business <strong className="font-medium text-neutral-700">timezone</strong> from
                Operating hours below. Web checkout is blocked on closed days, during emergency closure, or
                outside special hours when configured.
              </p>
              <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2 sm:gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emergency-until">Emergency closure until (local)</Label>
                  <Input
                    id="emergency-until"
                    className="h-10"
                    type="datetime-local"
                    value={emergencyUntilLocal}
                    onChange={(e) => setEmergencyUntilLocal(e.target.value)}
                  />
                  <p className="text-xs leading-relaxed text-neutral-500">
                    While now is before this time, new online orders are rejected. Clear the field to
                    disable.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emergency-msg">Emergency message (shown to customers)</Label>
                  <Input
                    id="emergency-msg"
                    className="h-10"
                    value={emergencyMessage}
                    onChange={(e) => setEmergencyMessage(e.target.value)}
                    placeholder="e.g. Closed for staff training — back at 3pm"
                  />
                </div>
              </div>

              <OpsCalendar
                timeZone={timezone}
                calendar={opsCalendar}
                onChangeCalendar={setOpsCalendar}
                baseOpeningMinutes={timeToMinutes(openTime)}
                baseClosingMinutes={timeToMinutes(closeTime)}
                initialView="month"
              />
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Operating hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-timezone">Timezone</Label>
                <Input
                  id="biz-timezone"
                  className="h-10 max-w-md font-mono text-sm"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="biz-open">Open</Label>
                  <Input
                    id="biz-open"
                    className="h-10"
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="biz-close">Close</Label>
                  <Input
                    id="biz-close"
                    className="h-10"
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-neutral-500">
                The time picker uses 24-hour values internally (e.g. 23:00 for 11:00 PM). If close is set to
                noon (12:00 PM), online ordering ends after the morning window — last ASAP orders follow{' '}
                <strong className="font-medium text-neutral-700">close time minus</strong> “Order cutoff before
                close” below.
              </p>
              <div className="grid gap-4 border-t border-border/70 pt-6 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="min-lead">Min lead time (minutes)</Label>
                  <Input
                    id="min-lead"
                    className="h-10 max-w-[12rem]"
                    type="number"
                    min={0}
                    value={String(minLead)}
                    onChange={(e) => setMinLead(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Scheduling
                  </span>
                  <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-3">
                    <FormToggleRow
                      className="text-sm text-neutral-800"
                      label="Same-day scheduling only"
                      inputProps={{
                        type: 'checkbox',
                        className: 'size-4 accent-primary',
                        checked: sameDayOnly,
                        onChange: (e) => setSameDayOnly((e.target as HTMLInputElement).checked),
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-cutoff">Order cutoff before close (minutes)</Label>
                <Input
                  id="order-cutoff"
                  className="h-10 max-w-[12rem]"
                  type="number"
                  min={0}
                  value={String(orderCutoffBeforeCloseMinutes)}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value || 0));
                    setOrderCutoffBeforeCloseMinutes(v);
                  }}
                />
                <p className="text-xs leading-relaxed text-neutral-500">
                  New ASAP orders are blocked this many minutes before closing time.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Business profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-name">Business name</Label>
                <Input
                  id="biz-name"
                  className="h-10"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-contact-email">Contact email</Label>
                <Input
                  id="biz-contact-email"
                  className="h-10"
                  type="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-reply-email">Reply-to email</Label>
                <Input
                  id="biz-reply-email"
                  className="h-10"
                  type="email"
                  autoComplete="email"
                  value={replyToEmail}
                  onChange={(e) => setReplyToEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-phone">Contact phone</Label>
                <Input
                  id="biz-phone"
                  className="h-10"
                  type="tel"
                  autoComplete="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-addr-1">Address line 1</Label>
                <Input
                  id="biz-addr-1"
                  className="h-10"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="biz-addr-2">Address line 2</Label>
                <Input
                  id="biz-addr-2"
                  className="h-10"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle>Advanced — payment JSON</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Payment methods</Label>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    Toggle common methods here; use JSON for anything extra.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormToggleRow
                    label="Cash"
                    inputProps={{
                      type: 'checkbox',
                      className: 'size-4 accent-primary',
                      checked: paymentMethods.cash,
                      onChange: (e) => {
                        const v = (e.target as HTMLInputElement).checked;
                        setPaymentMethods((s) => ({ ...s, cash: v }));
                        setPaymentJsonText((t) => patchPaymentJsonText(t, { cash: v }));
                      },
                    }}
                  />
                  <FormToggleRow
                    label="PayHere"
                    inputProps={{
                      type: 'checkbox',
                      className: 'size-4 accent-primary',
                      checked: paymentMethods.payhere,
                      onChange: (e) => {
                        const v = (e.target as HTMLInputElement).checked;
                        setPaymentMethods((s) => ({ ...s, payhere: v }));
                        setPaymentJsonText((t) => patchPaymentJsonText(t, { payhere: v }));
                      },
                    }}
                  />
                  <FormToggleRow
                    label="Card (POS)"
                    inputProps={{
                      type: 'checkbox',
                      className: 'size-4 accent-primary',
                      checked: paymentMethods.card,
                      onChange: (e) => {
                        const v = (e.target as HTMLInputElement).checked;
                        setPaymentMethods((s) => ({ ...s, card: v }));
                        setPaymentJsonText((t) => patchPaymentJsonText(t, { card: v }));
                      },
                    }}
                  />
                  <FormToggleRow
                    label="Online"
                    inputProps={{
                      type: 'checkbox',
                      className: 'size-4 accent-primary',
                      checked: paymentMethods.online,
                      onChange: (e) => {
                        const v = (e.target as HTMLInputElement).checked;
                        setPaymentMethods((s) => ({ ...s, online: v }));
                        setPaymentJsonText((t) => patchPaymentJsonText(t, { online: v }));
                      },
                    }}
                  />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
                      <FormToggleRow
                        className="text-sm text-neutral-800"
                        label="Supervisor PIN to record card (POS)"
                        inputProps={{
                          type: 'checkbox',
                          className: 'size-4 accent-primary',
                          checked: requireSupervisorForCardCollection,
                          onChange: (e) => {
                            const v = (e.target as HTMLInputElement).checked;
                            setRequireSupervisorForCardCollection(v);
                            setPaymentJsonText((t) =>
                              patchPaymentJsonPos(t, { requireSupervisorForCardCollection: v }),
                            );
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-neutral-500">
                  Editing <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">methods</code>{' '}
                  in the JSON updates these toggles. A toggle updates the JSON too, so Save never drops{' '}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">card</code> because of
                  stale state.
                </p>
                <textarea
                  className="min-h-[160px] w-full rounded-xl border border-border/70 bg-background p-4 font-mono text-sm shadow-inner"
                  spellCheck={false}
                  value={paymentJsonText}
                  onChange={(e) => setPaymentJsonText(e.target.value)}
                />
                {parsedPaymentJson.error ? (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Invalid JSON: {parsedPaymentJson.error}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-neutral-500">
                  {loading ? 'Loading…' : raw ? `Loaded record: ${raw.id}` : 'Not loaded'}
                </div>
                <Button
                  className="h-10 min-w-[11rem]"
                  onClick={() => void onSave()}
                  disabled={saving || loading || !!parsedPaymentJson.error}
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

