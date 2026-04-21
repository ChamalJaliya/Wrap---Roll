'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';
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
  OpsCalendar,
  toast,
} from '@wrap-roll/shared-ui';
import {
  adminPageContainerClass,
  adminPageShellClass,
  adminPageTitleClass,
  adminPageTitleSpacingClass,
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

  const [opsCalendar, setOpsCalendar] = useState<OperationsCalendar>(DEFAULT_OPERATIONS_CALENDAR);
  const [emergencyUntilLocal, setEmergencyUntilLocal] = useState('');
  const [emergencyMessage, setEmergencyMessage] = useState('');

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
    <div className={adminPageShellClass}>
      <div className={adminPageContainerClass}>
        <h1 className={`${adminPageTitleSpacingClass} ${adminPageTitleClass}`}>
          Business Settings
        </h1>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Card className="mb-8 border-primary/25 bg-gradient-to-br from-primary/5 to-transparent lg:col-span-2">
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-lg font-bold text-neutral-900">Tax & local delivery</p>
              <p className="mt-1 text-sm text-neutral-600">
                Configure VAT for web checkout and delivery fees (flat fee and advanced JSON).
              </p>
            </div>
            <Button variant="default" asChild>
              <Link href="/pricing">Open tax & delivery</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Operations calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-xs text-neutral-500">
                Dates use the business <strong>timezone</strong> above. Customer orders (web checkout)
                are blocked on closed days, during emergency closure, or outside special hours when
                configured.
              </p>
              <div className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Emergency closure until (local)</Label>
                  <Input
                    type="datetime-local"
                    value={emergencyUntilLocal}
                    onChange={(e) => setEmergencyUntilLocal(e.target.value)}
                  />
                  <p className="text-xs text-neutral-500">
                    While now is before this time, new online orders are rejected. Clear the field to
                    disable.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Emergency message (shown to customers)</Label>
                  <Input
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

          <Card>
            <CardHeader>
              <CardTitle>Operating hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Open</Label>
                  <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Close</Label>
                  <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Min lead time (minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={String(minLead)}
                    onChange={(e) => setMinLead(Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Same-day scheduling only</Label>
                  <FormToggleRow
                    className="text-sm text-neutral-700"
                    label="Enabled"
                    inputProps={{
                      type: 'checkbox',
                      checked: sameDayOnly,
                      onChange: (e) => setSameDayOnly((e.target as HTMLInputElement).checked),
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Order cutoff before close (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={String(orderCutoffBeforeCloseMinutes)}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value || 0));
                    setOrderCutoffBeforeCloseMinutes(v);
                  }}
                />
                <p className="text-xs text-neutral-500">
                  New ASAP orders are blocked this many minutes before closing time.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label>Business name</Label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Contact email</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Reply-to email</Label>
                <Input value={replyToEmail} onChange={(e) => setReplyToEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Contact phone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Address line 1</Label>
                <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Address line 2</Label>
                <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Advanced (JSON)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label>Payment config (paymentJson)</Label>
                <p className="text-xs text-neutral-500">
                  Toggle common methods here; use JSON for anything extra.
                </p>
                <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl border p-3 text-sm sm:grid-cols-4">
                  <FormToggleRow
                    label="Cash"
                    inputProps={{
                      type: 'checkbox',
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
                      checked: paymentMethods.online,
                      onChange: (e) => {
                        const v = (e.target as HTMLInputElement).checked;
                        setPaymentMethods((s) => ({ ...s, online: v }));
                        setPaymentJsonText((t) => patchPaymentJsonText(t, { online: v }));
                      },
                    }}
                  />
                </div>
                <p className="mb-1 text-xs text-neutral-500">
                  Editing <code className="rounded bg-neutral-100 px-1">methods</code> in the JSON updates these
                  toggles. A toggle updates the JSON too, so Save never drops{' '}
                  <code className="rounded bg-neutral-100 px-1">card</code> because of stale state.
                </p>
                <textarea
                  className="min-h-[140px] w-full rounded-xl border bg-white p-3 font-mono text-sm"
                  value={paymentJsonText}
                  onChange={(e) => setPaymentJsonText(e.target.value)}
                />
                {parsedPaymentJson.error ? (
                  <p className="text-sm text-red-600">Invalid JSON: {parsedPaymentJson.error}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-500">
                  {loading ? 'Loading…' : raw ? `Loaded: ${raw.id}` : 'Not loaded'}
                </div>
                <Button
                  onClick={onSave}
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

