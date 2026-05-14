'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@wrap-roll/shared-ui';
import type { AdminMenuItemReviewList, AdminMenuItemReviewRow, AdminPatchMenuItemReviewBody, MenuItemReviewVisibility } from '@wrap-roll/contracts';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { adminPageContainerClass, adminPageRootClass } from '../../lib/admin-ui-contract';

const VIS_OPTIONS: Array<{ value: '' | MenuItemReviewVisibility; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'public', label: 'Public' },
  { value: 'hidden', label: 'Hidden' },
];

export default function DishReviewsPage() {
  const [filter, setFilter] = useState<'' | MenuItemReviewVisibility>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminMenuItemReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (filter) params.set('visibility', filter);
      // No leading `/` so axios always joins with baseURL (`/api/nest`) and never drops the proxy segment.
      const { data: raw } = await api.get<AdminMenuItemReviewList>(`admin/menu-item-reviews?${params}`);
      setData(raw);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { message?: unknown } } }).response?.data?.message : null;
      toast.error(String(msg || 'Failed to load reviews'));
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (row: AdminMenuItemReviewRow, visibility: MenuItemReviewVisibility) => {
    try {
      const body: AdminPatchMenuItemReviewBody = { visibility };
      if (Object.prototype.hasOwnProperty.call(notes, row.id)) {
        body.adminNote = (notes[row.id] ?? '').trim() || null;
      }
      await api.patch(`admin/menu-item-reviews/${row.id}`, body);
      toast.success('Review updated');
      setNotes((n) => {
        const next = { ...n };
        delete next[row.id];
        return next;
      });
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e ? (e as { response?: { data?: { message?: unknown } } }).response?.data?.message : null;
      toast.error(String(msg || 'Update failed'));
    }
  };

  const rows = data?.items ?? [];

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <AdminPageHeader
          title="Dish reviews"
          description="Approve public ratings, hide abuse, and leave internal notes."
        />

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="flex flex-col gap-4 border-b sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-lg">Moderation queue</CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label className="text-xs uppercase text-muted-foreground">Visibility</Label>
                <select
                  className="h-10 min-w-[140px] rounded-lg border border-input bg-background px-3 text-sm"
                  value={filter}
                  onChange={(e) => {
                    setPage(1);
                    setFilter(e.target.value as '' | MenuItemReviewVisibility);
                  }}
                >
                  {VIS_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No reviews match this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="whitespace-nowrap">Thread</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const photoUrls = r.photoUrls ?? [];
                    const helpfulCount = r.helpfulCount ?? 0;
                    const replyCount = r.replyCount ?? 0;
                    return (
                      <TableRow key={r.id}>
                      <TableCell className="max-w-[160px]">
                        <p className="truncate font-semibold">{r.menuItemName}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.menuItemId}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">#{r.orderId.slice(0, 8)}</TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-sm">{r.customerName}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.customerEmail ?? '—'}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.rating} ★</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="block">{helpfulCount} helpful</span>
                        <span className="block">{replyCount} replies</span>
                        <span className="block">
                          {photoUrls.length} photo{photoUrls.length === 1 ? '' : 's'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <p className="line-clamp-3 text-sm">{r.comment ?? '—'}</p>
                        <div className="mt-2 grid gap-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Admin note</Label>
                          <Input
                            value={r.id in notes ? notes[r.id]! : (r.adminNote ?? '')}
                            placeholder="Internal note"
                            onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            r.visibility === 'public'
                              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800'
                              : r.visibility === 'pending'
                                ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900'
                                : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800'
                          }
                        >
                          {r.visibility}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          {r.visibility !== 'public' ? (
                            <Button type="button" size="sm" onClick={() => void patch(r, 'public')}>
                              Approve
                            </Button>
                          ) : null}
                          {r.visibility !== 'hidden' ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => void patch(r, 'hidden')}>
                              Hide
                            </Button>
                          ) : null}
                          {r.visibility !== 'pending' ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => void patch(r, 'pending')}>
                              Mark pending
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {data?.meta ? (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                <span>
                  Page {data.meta.page} of {data.meta.lastPage} ({data.meta.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!data.meta.hasPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!data.meta.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
