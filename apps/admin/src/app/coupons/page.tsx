'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { Button, Card, CardContent, CardHeader, CardTitle, FormToggleRow, Input, Label, toast } from '@wrap-roll/shared-ui';
import {
  adminPageContainerClass,
  adminPageShellClass,
  adminPageTitleClass,
  adminPageTitleSpacingClass,
} from '../../lib/admin-ui-contract';

type CouponRow = {
  id: string;
  code: string;
  discountPercent: string | number;
  minSubtotal: string | number | null;
  firstOrderOnly: boolean;
  isActive: boolean;
  expiryDate: string | null;
};

export default function AdminCouponsPage() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newPct, setNewPct] = useState('10');
  const [newMin, setNewMin] = useState('');
  const [newFirstOnly, setNewFirstOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CouponRow[]>('/admin/coupons');
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : null;
      toast.error(String(msg || 'Failed to load coupons'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pctToDisplay = (p: string | number) => {
    const n = Number(p);
    if (!Number.isFinite(n)) return '—';
    return `${Math.round(n * 1000) / 10}%`;
  };

  const onCreate = async () => {
    const code = newCode.trim().toUpperCase();
    const pctNum = Number(newPct);
    if (!code) {
      toast.error('Enter a code');
      return;
    }
    if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
      toast.error('Percent must be 0–100');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/coupons', {
        code,
        discountPercent: pctNum / 100,
        minSubtotal: newMin.trim() ? Number(newMin) : null,
        firstOrderOnly: newFirstOnly,
        isActive: true,
      });
      setNewCode('');
      setNewPct('10');
      setNewMin('');
      setNewFirstOnly(false);
      toast.success('Coupon created');
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as any).response?.data?.message : null;
      toast.error(String(msg || 'Create failed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: CouponRow, next: boolean) => {
    try {
      await api.patch(`/admin/coupons/${c.id}`, { isActive: next });
      toast.success(next ? 'Activated' : 'Deactivated');
      await load();
    } catch {
      toast.error('Update failed');
    }
  };

  const remove = async (c: CouponRow) => {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await api.delete(`/admin/coupons/${c.id}`);
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className={adminPageShellClass}>
      <div className={adminPageContainerClass}>
        <h1 className={`${adminPageTitleSpacingClass} ${adminPageTitleClass}`}>Coupons</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add coupon</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="SUMMER10" />
            </div>
            <div className="grid gap-2">
              <Label>Discount %</Label>
              <Input type="number" min={0} max={100} value={newPct} onChange={(e) => setNewPct(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Min subtotal (Rs, optional)</Label>
              <Input type="number" min={0} value={newMin} onChange={(e) => setNewMin(e.target.value)} placeholder="2000" />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <FormToggleRow
                className="text-sm"
                label="First order only"
                inputProps={{
                  type: 'checkbox',
                  checked: newFirstOnly,
                  onChange: (e) => setNewFirstOnly((e.target as HTMLInputElement).checked),
                }}
              />
              <Button type="button" disabled={saving} onClick={onCreate}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active codes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-neutral-500">No coupons yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-neutral-500">
                      <th className="pb-2 pr-4 font-medium">Code</th>
                      <th className="pb-2 pr-4 font-medium">Discount</th>
                      <th className="pb-2 pr-4 font-medium">Min subtotal</th>
                      <th className="pb-2 pr-4 font-medium">First only</th>
                      <th className="pb-2 pr-4 font-medium">Active</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr key={c.id} className="border-b border-neutral-100">
                        <td className="py-3 pr-4 font-mono font-medium">{c.code}</td>
                        <td className="py-3 pr-4">{pctToDisplay(c.discountPercent)}</td>
                        <td className="py-3 pr-4">
                          {c.minSubtotal != null && String(c.minSubtotal) !== '' ? c.minSubtotal : '—'}
                        </td>
                        <td className="py-3 pr-4">{c.firstOrderOnly ? 'Yes' : 'No'}</td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            className="text-primary underline"
                            onClick={() => toggleActive(c, !c.isActive)}
                          >
                            {c.isActive ? 'On' : 'Off'}
                          </button>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            className="text-red-600 underline"
                            onClick={() => remove(c)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
