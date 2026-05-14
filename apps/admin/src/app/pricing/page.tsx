'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '../../services/api';
import { Button, Card, CardContent, CardHeader, CardTitle, FormToggleRow, Input, Label, toast } from '@wrap-roll/shared-ui';
import type { DeliveryFeeMode, DistanceBand } from '@wrap-roll/contracts';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import {
  adminInlineAlertErrorClass,
  adminPageContainerClass,
  adminPageRootClass,
} from '../../lib/admin-ui-contract';

type AdminSettingsRow = {
  checkoutVatRate?: unknown;
  deliveryJson?: unknown;
};

type DeliveryJsonPatch = Partial<{
  enabled: boolean;
  feeFlat: number;
  orderCutoffBeforeCloseMinutes: number;
}>;

function patchDeliveryJsonText(text: string, patch: DeliveryJsonPatch): string {
  try {
    const root = JSON.parse(text) as Record<string, unknown>;
    return JSON.stringify({ ...root, ...patch }, null, 2) + '\n';
  } catch {
    return text;
  }
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type BandRow = { id: string; maxKmStr: string; feeStr: string };

export default function AdminPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkoutVatRate, setCheckoutVatRate] = useState(0.15);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [deliveryFeeFlat, setDeliveryFeeFlat] = useState(0);
  const [feeMode, setFeeMode] = useState<DeliveryFeeMode>('flat');
  const [originLatStr, setOriginLatStr] = useState('');
  const [originLngStr, setOriginLngStr] = useState('');
  const [maxDeliveryKmStr, setMaxDeliveryKmStr] = useState('');
  const [previewKmStr, setPreviewKmStr] = useState('4');
  const [bandRows, setBandRows] = useState<BandRow[]>([
    { id: uid(), maxKmStr: '3', feeStr: '200' },
    { id: uid(), maxKmStr: '', feeStr: '400' },
  ]);

  const [deliveryJsonText, setDeliveryJsonText] = useState(
    '{\n  "enabled": true,\n  "feeFlat": 0\n}\n',
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/admin/settings');
        const s = data as AdminSettingsRow;
        setCheckoutVatRate(
          typeof s.checkoutVatRate === 'number' || typeof s.checkoutVatRate === 'string'
            ? Number(s.checkoutVatRate)
            : 0.15,
        );
        const deliveryRules = ((s as { deliveryJson?: unknown }).deliveryJson ?? {
          enabled: true,
          feeFlat: 0,
        }) as Record<string, unknown>;
        setDeliveryEnabled(deliveryRules.enabled === undefined ? true : Boolean(deliveryRules.enabled));
        setDeliveryFeeFlat(Number(deliveryRules.feeFlat ?? 0));
        const mode = String(deliveryRules.feeMode ?? 'flat').toLowerCase();
        setFeeMode(mode === 'distance' ? 'distance' : 'flat');
        setOriginLatStr(
          deliveryRules.originLat != null && deliveryRules.originLat !== ''
            ? String(deliveryRules.originLat)
            : '',
        );
        setOriginLngStr(
          deliveryRules.originLng != null && deliveryRules.originLng !== ''
            ? String(deliveryRules.originLng)
            : '',
        );
        setMaxDeliveryKmStr(
          deliveryRules.maxDeliveryKm != null && deliveryRules.maxDeliveryKm !== ''
            ? String(deliveryRules.maxDeliveryKm)
            : '',
        );
        const rawBands = deliveryRules.distanceBands;
        if (Array.isArray(rawBands) && rawBands.length > 0) {
          setBandRows(
            rawBands.map((b: unknown) => {
              const row = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
              const maxKm = row.maxKm;
              return {
                id: uid(),
                maxKmStr:
                  maxKm === null || maxKm === undefined || String(maxKm).toLowerCase() === 'null'
                    ? ''
                    : String(maxKm),
                feeStr: String(row.fee ?? 0),
              };
            }),
          );
        } else {
          setBandRows([
            { id: uid(), maxKmStr: '3', feeStr: '200' },
            { id: uid(), maxKmStr: '', feeStr: '400' },
          ]);
        }
        setDeliveryJsonText(JSON.stringify(deliveryRules, null, 2) + '\n');
      } catch (e: unknown) {
        const message =
          e && typeof e === 'object' && 'response' in e
            ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
            : null;
        setError(String(message || 'Failed to load'));
        toast.error(String(message || 'Failed to load'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const parsedDeliveryJson = useMemo(() => {
    try {
      return { value: JSON.parse(deliveryJsonText), error: null as string | null };
    } catch (e: unknown) {
      return { value: null, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [deliveryJsonText]);

  useEffect(() => {
    if (parsedDeliveryJson.error || parsedDeliveryJson.value == null) return;
    const d = parsedDeliveryJson.value as Record<string, unknown>;
    if ('enabled' in d) setDeliveryEnabled(Boolean(d.enabled));
    if ('feeFlat' in d) setDeliveryFeeFlat(Number(d.feeFlat ?? 0));
    if ('feeMode' in d) {
      const m = String(d.feeMode ?? 'flat').toLowerCase();
      setFeeMode(m === 'distance' ? 'distance' : 'flat');
    }
  }, [parsedDeliveryJson.error, parsedDeliveryJson.value]);

  const buildDistanceBandsFromRows = (): DistanceBand[] => {
    return bandRows.map((row) => {
      const fee = Math.max(0, Number(row.feeStr) || 0);
      const maxRaw = row.maxKmStr.trim();
      if (maxRaw === '') return { maxKm: null, fee };
      const n = Number(maxRaw);
      const maxKm = Number.isFinite(n) && n > 0 ? n : null;
      return { maxKm, fee };
    });
  };

  const previewFeeForKm = (km: number): number | null => {
    if (!Number.isFinite(km) || km < 0) return null;
    const bands = buildDistanceBandsFromRows().sort((a, b) => {
      const ai = a.maxKm ?? Number.POSITIVE_INFINITY;
      const bi = b.maxKm ?? Number.POSITIVE_INFINITY;
      return ai - bi;
    });
    for (const band of bands) {
      const cap = band.maxKm ?? Number.POSITIVE_INFINITY;
      if (km <= cap) return band.fee;
    }
    return bands[bands.length - 1]?.fee ?? 0;
  };

  const onSave = async () => {
    if (parsedDeliveryJson.error) return;

    if (feeMode === 'distance') {
      const olat = Number(originLatStr);
      const olng = Number(originLngStr);
      if (!Number.isFinite(olat) || olat < -90 || olat > 90) {
        toast.error('Enter a valid origin latitude (−90 to 90).');
        return;
      }
      if (!Number.isFinite(olng) || olng < -180 || olng > 180) {
        toast.error('Enter a valid origin longitude (−180 to 180).');
        return;
      }
      const bands = buildDistanceBandsFromRows();
      if (bands.length === 0) {
        toast.error('Add at least one distance band.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const root = (parsedDeliveryJson.value ?? {}) as Record<string, unknown>;
      const mx = maxDeliveryKmStr.trim();
      const maxDeliveryKm =
        feeMode === 'distance' && mx !== '' && Number.isFinite(Number(mx)) && Number(mx) > 0
          ? Number(mx)
          : null;

      const deliveryJson: Record<string, unknown> = {
        ...root,
        enabled: deliveryEnabled,
        feeMode,
        feeFlat: feeMode === 'flat' ? deliveryFeeFlat : Number(root.feeFlat ?? 0) || 0,
        orderCutoffBeforeCloseMinutes: Number(
          root.orderCutoffBeforeCloseMinutes ?? 60,
        ),
      };

      if (feeMode === 'distance') {
        deliveryJson.originLat = Number(originLatStr);
        deliveryJson.originLng = Number(originLngStr);
        deliveryJson.maxDeliveryKm = maxDeliveryKm;
        deliveryJson.distanceBands = buildDistanceBandsFromRows().map((b) => ({
          maxKm: b.maxKm,
          fee: Math.round(b.fee * 100) / 100,
        }));
      } else {
        deliveryJson.feeFlat = deliveryFeeFlat;
      }

      await api.put('/admin/settings', {
        checkoutVatRate: Math.min(1, Math.max(0, Number(checkoutVatRate) || 0)),
        deliveryJson,
      });
      setDeliveryJsonText(JSON.stringify(deliveryJson, null, 2) + '\n');
      toast.success('Tax & delivery saved');
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(String(message || 'Save failed'));
      toast.error(String(message || 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={adminPageRootClass}>
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <AdminPageHeader
          title="Tax & delivery"
          description={
            <>
              Web checkout VAT on subtotal and local delivery fees. Order cutoff before closing stays under{' '}
              <Link href="/settings" className="font-medium text-primary underline">
                Settings → Operating hours
              </Link>
              .
            </>
          }
          actions={
            <Button variant="outline" asChild>
              <Link href="/settings">Back to settings</Link>
            </Button>
          }
        />

        {error ? <div className={adminInlineAlertErrorClass}>{error}</div> : null}

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Storefront VAT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex max-w-md flex-col gap-1.5">
                <Label htmlFor="checkout-vat-rate">Checkout VAT rate (decimal)</Label>
                <Input
                  id="checkout-vat-rate"
                  className="h-10 max-w-[11rem]"
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={String(checkoutVatRate)}
                  onChange={(e) => setCheckoutVatRate(Number(e.target.value))}
                />
                <p className="text-xs leading-relaxed text-neutral-500">
                  Example: <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">0.15</code>{' '}
                  for 15% on subtotal. Used for online totals and PayHere.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Local delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
                <FormToggleRow
                  className="gap-3 text-sm font-medium text-neutral-800"
                  label="Offer delivery on web checkout"
                  inputProps={{
                    type: 'checkbox',
                    className: 'size-4 accent-primary',
                    checked: deliveryEnabled,
                    onChange: (e) => {
                      const v = (e.target as HTMLInputElement).checked;
                      setDeliveryEnabled(v);
                      setDeliveryJsonText((t) => patchDeliveryJsonText(t, { enabled: v }));
                    },
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Delivery fee mode
                </Label>
                <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-3 sm:flex-row sm:flex-wrap sm:gap-6">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="radio"
                      name="feeMode"
                      className="size-4 accent-primary"
                      checked={feeMode === 'flat'}
                      onChange={() => setFeeMode('flat')}
                    />
                    Flat fee
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="radio"
                      name="feeMode"
                      className="size-4 accent-primary"
                      checked={feeMode === 'distance'}
                      onChange={() => setFeeMode('distance')}
                    />
                    Distance bands (straight-line km)
                  </label>
                </div>
              </div>

              {feeMode === 'flat' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delivery-flat-fee">Flat delivery fee (LKR)</Label>
                  <Input
                    id="delivery-flat-fee"
                    className="h-10 max-w-[14rem]"
                    type="number"
                    min={0}
                    step="1"
                    value={String(deliveryFeeFlat)}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value || 0));
                      setDeliveryFeeFlat(v);
                      setDeliveryJsonText((t) => patchDeliveryJsonText(t, { feeFlat: v }));
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <p className="text-xs leading-relaxed text-neutral-500">
                    Set your kitchen or dispatch point, then tiers by distance (straight-line / haversine).
                    Customers share their browser location at checkout.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="origin-lat">Origin latitude</Label>
                      <Input
                        id="origin-lat"
                        className="h-10 font-mono text-sm"
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 6.9271"
                        value={originLatStr}
                        onChange={(e) => setOriginLatStr(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="origin-lng">Origin longitude</Label>
                      <Input
                        id="origin-lng"
                        className="h-10 font-mono text-sm"
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 79.8612"
                        value={originLngStr}
                        onChange={(e) => setOriginLngStr(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="max-delivery-km">Max delivery radius (km, optional)</Label>
                    <Input
                      id="max-delivery-km"
                      className="h-10 max-w-md"
                      type="text"
                      inputMode="decimal"
                      placeholder="Leave empty for no hard limit"
                      value={maxDeliveryKmStr}
                      onChange={(e) => setMaxDeliveryKmStr(e.target.value)}
                    />
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Orders beyond this distance are rejected at checkout (bands still apply below the cap).
                    </p>
                  </div>

                  <div className="space-y-4 border-t border-border/70 pt-6">
                    <div className="space-y-1">
                      <Label>Distance bands</Label>
                      <p className="text-xs leading-relaxed text-neutral-500">
                        First matching tier wins. Leave <strong className="font-medium">Max km</strong> empty on the
                        last row for all farther distances (∞).
                      </p>
                    </div>
                    <div className="space-y-3">
                      {bandRows.map((row) => (
                        <div
                          key={row.id}
                          className="grid grid-cols-1 gap-3 rounded-lg border border-border/70 bg-muted/10 p-3 sm:grid-cols-12 sm:items-end"
                        >
                          <div className="flex flex-col gap-1.5 sm:col-span-5">
                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Max km
                            </Label>
                            <Input
                              className="h-10 font-mono text-sm"
                              type="text"
                              inputMode="decimal"
                              placeholder="∞ blank"
                              title="Blank means unlimited upper tier"
                              value={row.maxKmStr}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBandRows((rows) =>
                                  rows.map((r) => (r.id === row.id ? { ...r, maxKmStr: v } : r)),
                                );
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-5">
                            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Fee (LKR)
                            </Label>
                            <Input
                              className="h-10"
                              type="number"
                              min={0}
                              step={1}
                              value={row.feeStr}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBandRows((rows) =>
                                  rows.map((r) => (r.id === row.id ? { ...r, feeStr: v } : r)),
                                );
                              }}
                            />
                          </div>
                          <div className="flex sm:col-span-2 sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 w-full shrink-0 sm:w-auto"
                              disabled={bandRows.length <= 1}
                              onClick={() =>
                                setBandRows((rows) => rows.filter((r) => r.id !== row.id))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full sm:w-fit"
                      onClick={() =>
                        setBandRows((rows) => [...rows, { id: uid(), maxKmStr: '', feeStr: '0' }])
                      }
                    >
                      Add band
                    </Button>

                    <div className="space-y-3 border-t border-border/70 pt-6">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Validation preview
                      </p>
                      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="preview-km" className="text-[11px] uppercase text-muted-foreground">
                            Test distance (km)
                          </Label>
                          <Input
                            id="preview-km"
                            className="h-10 max-w-[10rem] font-mono text-sm"
                            type="text"
                            inputMode="decimal"
                            value={previewKmStr}
                            onChange={(e) => setPreviewKmStr(e.target.value)}
                          />
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background px-4 py-3 text-sm text-neutral-800 sm:min-w-[12rem]">
                          <span className="text-muted-foreground">Quoted fee</span>
                          <p className="mt-1 font-display text-lg font-bold tabular-nums">
                            {(() => {
                              const km = Number(previewKmStr);
                              const fee = previewFeeForKm(km);
                              return fee == null ? '—' : `LKR ${fee.toLocaleString()}`;
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Advanced — delivery JSON</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-neutral-500">
                Full merged config. Quick fields above update this on save; you can hand-edit edge cases
                here if needed.
              </p>
              <textarea
                className="min-h-[200px] w-full rounded-xl border bg-white p-3 font-mono text-sm"
                value={deliveryJsonText}
                onChange={(e) => setDeliveryJsonText(e.target.value)}
              />
              {parsedDeliveryJson.error ? (
                <p className="text-sm text-red-600">Invalid JSON: {parsedDeliveryJson.error}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 flex justify-end">
          <Button type="button" disabled={saving || !!parsedDeliveryJson.error} onClick={() => void onSave()}>
            {saving ? 'Saving…' : 'Save tax & delivery'}
          </Button>
        </div>
      </div>
    </div>
  );
}
