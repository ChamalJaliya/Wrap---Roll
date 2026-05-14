'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ThumbsUp, MessageCircle, ChevronLeft, ChevronRight, ChevronDown, Star, ImagePlus, X, Package } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Label,
  Textarea,
} from '@wrap-roll/shared-ui';
import type { CustomerHistoryOrder } from '@wrap-roll/contracts';
import {
  isMenuItemImageUrl,
  MENU_ITEM_IMAGE_URL_MAX_LEN,
  MENU_ITEM_REVIEW_MAX_PHOTOS,
} from '@wrap-roll/contracts';
import { CustomerApiService } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  clientContentWideClass,
  clientPageShellClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';

const PAGE_SIZE = 6;

type MyReviewCard = {
  id: string;
  menuItemId: string;
  menuName: string;
  orderId: string;
  orderPlacedAt: string;
  rating: number;
  comment: string | null;
  photoUrls: string[];
  visibility: string;
  helpfulCount: number;
  replyCount: number;
  createdAt: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 36) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 10) return `${wk} wk ago`;
  return new Date(iso).toLocaleDateString();
}

function parseOrderTotal(total: unknown): number {
  if (typeof total === 'number') return total;
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

type OrderLifecycle = 'pending' | 'completed' | 'cancelled';

const CANCELLED_STATUSES = new Set(['cancelled', 'voided', 'refunded']);
const COMPLETED_STATUSES = new Set(['delivered']);

function orderLifecycle(status: string): OrderLifecycle {
  const s = (status ?? '').toLowerCase().trim();
  if (CANCELLED_STATUSES.has(s)) return 'cancelled';
  if (COMPLETED_STATUSES.has(s)) return 'completed';
  return 'pending';
}

function formatOrderStatus(status: string): string {
  const s = (status ?? '').toLowerCase().trim();
  const labels: Record<string, string> = {
    placed: 'Placed',
    paid: 'Paid',
    in_kitchen: 'In kitchen',
    ready: 'Ready for pickup',
    in_transit: 'Out for delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    voided: 'Voided',
    refunded: 'Refunded',
  };
  if (labels[s]) return labels[s];
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function lifecycleBadgeClass(lifecycle: OrderLifecycle): string {
  if (lifecycle === 'completed') return 'bg-emerald-100 text-emerald-900';
  if (lifecycle === 'cancelled') return 'bg-neutral-200 text-neutral-700';
  return 'bg-amber-100 text-amber-950';
}

function lifecycleLabel(lifecycle: OrderLifecycle): string {
  if (lifecycle === 'completed') return 'Completed';
  if (lifecycle === 'cancelled') return 'Cancelled';
  return 'Pending';
}

function ReviewsFilterSelect({
  label,
  tone,
  className,
  selectClassName,
  children,
  ...selectProps
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'> & {
  label: string;
  tone: 'light' | 'dark';
  className?: string;
  selectClassName?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className={cn('grid min-w-[10.5rem] gap-1.5 sm:min-w-[11rem]', className)}>
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="group relative">
        <select
          id={id}
          className={cn(
            'h-10 w-full cursor-pointer appearance-none rounded-2xl border py-0 pl-3.5 pr-10 text-sm font-semibold tracking-tight transition-[border-color,box-shadow,background-color] duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
            'disabled:cursor-not-allowed disabled:opacity-50',
            tone === 'light' &&
              'border-neutral-200/95 bg-white text-neutral-900 shadow-sm hover:border-neutral-300 hover:bg-neutral-50/90 hover:shadow-md',
            tone === 'dark' &&
              '[color-scheme:dark] border-neutral-800/90 bg-gradient-to-b from-neutral-800 to-neutral-950 text-white shadow-[0_10px_28px_-14px_rgba(0,0,0,0.5)] hover:border-neutral-600 hover:from-neutral-700 hover:to-neutral-950',
            selectClassName,
          )}
          {...selectProps}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-2.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 transition-colors',
            tone === 'light' ? 'text-neutral-500 group-hover:text-neutral-800' : 'text-white/60 group-hover:text-white/95',
          )}
          strokeWidth={2.25}
          aria-hidden
        />
      </div>
    </div>
  );
}

/** Mirrors loaded layout: hero → orders → rate → public review grid */
function PurchasesLoadingSkeleton() {
  return (
    <div
      className={cn(clientPageShellClass, 'overflow-hidden')}
      role="status"
      aria-live="polite"
      aria-label="Loading orders and reviews"
    >
      <div className={clientContentWideClass}>
        <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 pt-8">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-800/40 bg-gradient-to-br from-neutral-900 to-neutral-950 px-6 py-10 sm:px-10 sm:py-12">
            <div className="space-y-4">
              <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
              <div className="h-10 max-w-md animate-pulse rounded-lg bg-white/12" />
              <div className="h-4 max-w-xl animate-pulse rounded bg-white/10" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[4.75rem] animate-pulse rounded-2xl bg-white/10" />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.03] sm:p-8">
            <div className="mb-5 h-6 w-40 animate-pulse rounded-md bg-neutral-200/80" />
            <div className="mb-5 h-4 max-w-md animate-pulse rounded bg-neutral-100" />
            <div className="mb-5 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 w-[5.5rem] animate-pulse rounded-full bg-neutral-100" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-neutral-200/90" />
                    <div className="h-3 w-52 max-w-full animate-pulse rounded bg-neutral-200/50" />
                    <div className="h-4 w-36 animate-pulse rounded bg-neutral-200/70" />
                  </div>
                  <div className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-neutral-200/70 sm:self-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.03] sm:p-8">
            <div className="mb-6 border-b border-neutral-100 pb-6">
              <div className="h-3 w-20 animate-pulse rounded bg-orange-200/70" />
              <div className="mt-3 h-8 w-48 animate-pulse rounded-lg bg-neutral-200/80" />
              <div className="mt-2 h-4 max-w-lg animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-2xl bg-gradient-to-b from-neutral-100 to-neutral-50/80"
                />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm ring-1 ring-black/[0.03] sm:p-8">
            <div className="mb-6 flex flex-col gap-4 border-b border-neutral-100 pb-6 lg:flex-row lg:justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-orange-200/60" />
                <div className="h-8 w-56 animate-pulse rounded-lg bg-neutral-200/80" />
                <div className="h-4 max-w-md animate-pulse rounded bg-neutral-100" />
              </div>
              <div className="h-32 w-full max-w-xs animate-pulse rounded-2xl bg-neutral-100 lg:shrink-0" />
            </div>
            <div className="mb-6 flex flex-wrap gap-3">
              <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-100" />
              <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200/80" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-2xl border border-neutral-100 bg-neutral-50/70 p-5"
                  aria-hidden
                >
                  <div className="flex gap-3">
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-neutral-200/90" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-neutral-200/80" />
                      <div className="h-3 w-28 animate-pulse rounded bg-neutral-200/50" />
                      <div className="mt-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <div key={s} className="h-4 w-4 animate-pulse rounded-sm bg-neutral-200/70" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-neutral-200/40" />
                    <div className="h-3 w-[88%] animate-pulse rounded bg-neutral-200/30" />
                    <div className="h-3 w-[72%] animate-pulse rounded bg-neutral-200/25" />
                  </div>
                  <div className="mt-4 flex justify-between border-t border-neutral-100 pt-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-neutral-200/50" />
                    <div className="h-3 w-24 animate-pulse rounded bg-neutral-200/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseHistoryPage() {
  const locale = useLocale();
  const [history, setHistory] = useState<CustomerHistoryOrder[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const [page, setPage] = useState(1);
  const [orderFilter, setOrderFilter] = useState<'all' | OrderLifecycle>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, profile] = await Promise.all([
        CustomerApiService.getHistory(),
        CustomerApiService.getProfile().catch(() => null),
      ]);
      setHistory(Array.isArray(hist) ? hist : []);
      setDisplayName((profile?.name ?? '').trim());
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reviewCards: MyReviewCard[] = useMemo(() => {
    const out: MyReviewCard[] = [];
    for (const o of history) {
      for (const h of o.dishReviewHints ?? []) {
        const ex = h.existingReview;
        if (!ex?.id) continue;
        out.push({
          id: ex.id,
          menuItemId: h.menuItemId,
          menuName: h.name,
          orderId: o.id,
          orderPlacedAt: o.placedAt,
          rating: ex.rating,
          comment: ex.comment ?? null,
          photoUrls: ex.photoUrls ?? [],
          visibility: ex.visibility,
          helpfulCount: ex.helpfulCount ?? 0,
          replyCount: ex.replyCount ?? 0,
          createdAt: ex.createdAt ?? o.placedAt,
        });
      }
    }
    return out;
  }, [history]);

  const stats = useMemo(() => {
    const n = reviewCards.length;
    const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const c of reviewCards) {
      const r = c.rating as 1 | 2 | 3 | 4 | 5;
      if (r >= 1 && r <= 5) dist[r] += 1;
      sum += c.rating;
    }
    const avg = n > 0 ? sum / n : null;
    const pct = (k: 1 | 2 | 3 | 4 | 5) => (n > 0 ? Math.round((dist[k] / n) * 100) : 0);
    return { n, dist, avg, pct };
  }, [reviewCards]);

  const filtered = useMemo(() => {
    let rows = [...reviewCards];
    if (ratingFilter !== 'all') {
      rows = rows.filter((c) => c.rating === ratingFilter);
    }
    rows.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === 'latest' ? tb - ta : ta - tb;
    });
    return rows;
  }, [reviewCards, ratingFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [ratingFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const initials = initialsFromName(displayName);

  const orderCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let cancelled = 0;
    for (const o of history) {
      const b = orderLifecycle(o.status);
      if (b === 'pending') pending += 1;
      else if (b === 'completed') completed += 1;
      else cancelled += 1;
    }
    return { pending, completed, cancelled, all: history.length };
  }, [history]);

  const filteredOrders = useMemo(() => {
    let rows = [...history];
    if (orderFilter !== 'all') {
      rows = rows.filter((o) => orderLifecycle(o.status) === orderFilter);
    }
    rows.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
    return rows;
  }, [history, orderFilter]);

  const unratedEligibleCount = useMemo(() => {
    let n = 0;
    for (const o of history) {
      for (const h of o.dishReviewHints ?? []) {
        if (h.canSubmit && !h.existingReview?.id) n += 1;
      }
    }
    return n;
  }, [history]);

  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { rating: number; comment: string; photoUrls: string[] }>
  >({});
  const [submittingReviewKey, setSubmittingReviewKey] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState('');

  const reviewTargets = useMemo(() => {
    const pending: { key: string; orderId: string; menuItemId: string; name: string }[] = [];
    const done: { key: string; orderId: string; name: string; rating: number; visibility: string }[] = [];
    for (const o of history) {
      for (const h of o.dishReviewHints ?? []) {
        const key = `${o.id}:${h.menuItemId}`;
        if (h.canSubmit) {
          pending.push({ key, orderId: o.id, menuItemId: h.menuItemId, name: h.name });
        } else if (h.existingReview) {
          done.push({
            key,
            orderId: o.id,
            name: h.name,
            rating: h.existingReview.rating,
            visibility: h.existingReview.visibility,
          });
        }
      }
    }
    return { pending, done };
  }, [history]);

  const getDraft = (key: string) =>
    reviewDrafts[key] ?? {
      rating: 5,
      comment: '',
      photoUrls: [] as string[],
    };

  const getReviewErrorMessage = (error: unknown, fallback: string): string => {
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
    ) {
      return String((error as { response?: { data?: { message?: unknown } } }).response?.data?.message);
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const submitReview = async (orderId: string, menuItemId: string, key: string) => {
    const d = getDraft(key);
    setSubmittingReviewKey(key);
    setReviewNotice('');
    try {
      await CustomerApiService.createDishReview(orderId, menuItemId, {
        rating: d.rating,
        comment: d.comment.trim() || null,
        photoUrls: d.photoUrls.length ? d.photoUrls : undefined,
      });
      setReviewNotice('Thanks — your review was submitted for moderation.');
      await load();
    } catch (error) {
      setReviewNotice(getReviewErrorMessage(error, 'Could not submit review.'));
    } finally {
      setSubmittingReviewKey(null);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#rate-dishes') return;
    const el = document.getElementById('rate-dishes');
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [loading, history]);

  if (loading) {
    return <PurchasesLoadingSkeleton />;
  }

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <div className="mx-auto w-full max-w-6xl space-y-8 pb-16 pt-8">
          <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900 to-orange-950 px-6 py-10 text-white shadow-[0_32px_100px_-40px_rgba(0,0,0,0.55)] sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-500/25 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-amber-400/10 blur-2xl" aria-hidden />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">Your account</p>
              <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Orders & ratings</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
                Check order status first, then rate dishes from those orders. Published reviews appear at the bottom.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Orders</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{orderCounts.all}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">In progress</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-amber-200">{orderCounts.pending}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Published reviews</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-emerald-200">{stats.n}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Your average</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">
                    {stats.avg != null ? stats.avg.toFixed(1) : '—'}
                    <span className="ml-1 text-sm font-semibold text-white/50">/5</span>
                  </p>
                </div>
              </div>
            </div>
          </header>

          {unratedEligibleCount > 0 ? (
            <div className="rounded-2xl border border-orange-200/60 bg-gradient-to-r from-orange-50 to-amber-50/80 p-5 shadow-sm ring-1 ring-orange-500/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium leading-relaxed text-neutral-800">
                  <span className="font-bold tabular-nums text-orange-900">{unratedEligibleCount}</span> dish
                  {unratedEligibleCount === 1 ? '' : 'es'} waiting for your rating.
                </p>
                <Button className="shrink-0 rounded-full shadow-sm" asChild>
                  <Link href={`/${locale}/profile/purchases#rate-dishes`}>Rate dishes now</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {/* Orders — shown first so status & totals are immediate; rate dishes follows the same history. */}
          <Card className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.2)] ring-1 ring-black/[0.03]">
            <CardHeader className="border-b border-neutral-100 bg-neutral-50/80 px-6 py-5 sm:px-8">
              <CardTitle className={cn(clientSectionTitleClass, 'text-xl text-neutral-900')}>Order timeline</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                In progress until delivered. Cancelled covers voided and refunded orders.
              </p>
            </CardHeader>
            <CardContent className="px-6 py-6 sm:px-8">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {(
                      [
                        { key: 'all' as const, label: 'All', count: orderCounts.all },
                        { key: 'pending' as const, label: 'Pending', count: orderCounts.pending },
                        { key: 'completed' as const, label: 'Completed', count: orderCounts.completed },
                        { key: 'cancelled' as const, label: 'Cancelled', count: orderCounts.cancelled },
                      ] as const
                    ).map(({ key, label, count }) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={orderFilter === key ? 'default' : 'outline'}
                        className="rounded-full"
                        onClick={() => setOrderFilter(key)}
                      >
                        {label}
                        <span className="ml-1.5 tabular-nums text-xs opacity-90">({count})</span>
                      </Button>
                    ))}
                  </div>
                  {filteredOrders.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-10 text-center text-sm text-muted-foreground">
                      No orders in this category.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredOrders.map((o) => {
                        const life = orderLifecycle(o.status);
                        const trackHref = `/${locale}/order/success?id=${encodeURIComponent(o.id)}`;
                        return (
                          <li
                            key={o.id}
                            className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50/50 p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                          >
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-neutral-500">#{o.id.slice(0, 8)}</span>
                                <span
                                  className={cn(
                                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                    lifecycleBadgeClass(life),
                                  )}
                                >
                                  {lifecycleLabel(life)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(o.placedAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                                <span className="mx-1.5 text-neutral-300">·</span>
                                <span className="capitalize">{o.fulfillmentType?.replace(/_/g, ' ') ?? '—'}</span>
                              </p>
                              <p className="text-sm font-medium text-neutral-800">{formatOrderStatus(o.status)}</p>
                              {o.paymentStatus && o.paymentStatus !== 'completed' ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Payment: {formatOrderStatus(o.paymentStatus)}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
                              <p className="text-lg font-black tabular-nums text-neutral-900">
                                LKR {parseOrderTotal(o.total).toLocaleString()}
                              </p>
                              {life === 'pending' ? (
                                <Button variant="default" size="sm" className="rounded-full px-5" asChild>
                                  <Link href={trackHref}>Track order</Link>
                                </Button>
                              ) : (
                                <span className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-right">
                                  Closed
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card
            id="rate-dishes"
            className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.03]"
          >
            <CardHeader className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Reviews</p>
                  <CardTitle className={cn(clientSectionTitleClass, 'text-2xl text-neutral-900')}>Rate your dishes</CardTitle>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    Stars, photos, and comments are tied to each order. Public threads open after moderation.
                  </p>
                </div>
                <Package className="hidden h-10 w-10 shrink-0 text-orange-200 sm:block" aria-hidden />
              </div>
            </CardHeader>
            <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
              {reviewNotice ? (
                <p className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
                  {reviewNotice}
                </p>
              ) : null}
              {reviewTargets.pending.length === 0 && reviewTargets.done.length === 0 ? (
                <EmptyState
                  title="Nothing to rate yet"
                  description="When you complete an eligible order, dishes you ordered will appear here. Use the order timeline above to track progress."
                />
              ) : (
                <div className="space-y-10">
                  {reviewTargets.pending.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold text-neutral-900">Awaiting your rating</p>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {reviewTargets.pending.map((row) => {
                          const d = getDraft(row.key);
                          const fileInputId = `dish-photo-${row.key.replace(/:/g, '-')}`;
                          return (
                            <div
                              key={row.key}
                              className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/90 shadow-sm"
                            >
                              <div className="flex flex-col gap-3 border-b border-neutral-100/90 bg-white/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-semibold text-neutral-900">{row.name}</p>
                                  <p className="text-xs text-muted-foreground">Order #{row.orderId.slice(0, 8)}</p>
                                </div>
                                <div className="flex items-center gap-0.5" role="group" aria-label="Star rating">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      className="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                                      aria-label={`${n} out of 5 stars`}
                                      onClick={() =>
                                        setReviewDrafts((s) => ({
                                          ...s,
                                          [row.key]: { ...d, rating: n },
                                        }))
                                      }
                                    >
                                      <Star
                                        className={cn(
                                          'h-8 w-8',
                                          n <= d.rating
                                            ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                                            : 'fill-neutral-200/50 text-neutral-300',
                                        )}
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                                <div>
                                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Photos (optional)
                                  </Label>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {d.photoUrls.map((url, idx) => (
                                      <div key={`${idx}-${url.slice(0, 24)}`} className="relative h-14 w-14 shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={url}
                                          alt=""
                                          className="h-full w-full rounded-lg border border-neutral-200 object-cover"
                                        />
                                        <button
                                          type="button"
                                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white shadow"
                                          aria-label="Remove photo"
                                          onClick={() =>
                                            setReviewDrafts((s) => ({
                                              ...s,
                                              [row.key]: {
                                                ...d,
                                                photoUrls: d.photoUrls.filter((_, i) => i !== idx),
                                              },
                                            }))
                                          }
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                    {d.photoUrls.length < MENU_ITEM_REVIEW_MAX_PHOTOS ? (
                                      <>
                                        <input
                                          id={fileInputId}
                                          type="file"
                                          accept="image/png,image/jpeg,image/webp,image/gif"
                                          className="sr-only"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = '';
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                              const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                                              if (!dataUrl || dataUrl.length > MENU_ITEM_IMAGE_URL_MAX_LEN) {
                                                setReviewNotice('That image is too large. Try a smaller photo.');
                                                return;
                                              }
                                              if (!isMenuItemImageUrl(dataUrl)) {
                                                setReviewNotice('Unsupported image format.');
                                                return;
                                              }
                                              setReviewDrafts((s) => {
                                                const cur = s[row.key] ?? {
                                                  rating: 5,
                                                  comment: '',
                                                  photoUrls: [] as string[],
                                                };
                                                if (cur.photoUrls.length >= MENU_ITEM_REVIEW_MAX_PHOTOS) return s;
                                                return {
                                                  ...s,
                                                  [row.key]: { ...cur, photoUrls: [...cur.photoUrls, dataUrl] },
                                                };
                                              });
                                            };
                                            reader.readAsDataURL(file);
                                          }}
                                        />
                                        <label
                                          htmlFor={fileInputId}
                                          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-orange-300 hover:text-orange-600"
                                        >
                                          <ImagePlus className="h-6 w-6" />
                                        </label>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    Comment (optional)
                                  </Label>
                                  <Textarea
                                    className="mt-1 min-h-[72px] rounded-xl border-neutral-200"
                                    value={d.comment}
                                    onChange={(e) =>
                                      setReviewDrafts((s) => ({
                                        ...s,
                                        [row.key]: { ...d, comment: e.target.value },
                                      }))
                                    }
                                    maxLength={2000}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  className="w-full rounded-full sm:w-auto"
                                  disabled={submittingReviewKey === row.key}
                                  onClick={() => void submitReview(row.orderId, row.menuItemId, row.key)}
                                >
                                  {submittingReviewKey === row.key ? 'Submitting…' : 'Submit review'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {reviewTargets.done.length > 0 ? (
                    <div className="space-y-3 border-t border-neutral-100 pt-8">
                      <p className="text-sm font-semibold text-neutral-900">Recently submitted</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {reviewTargets.done.map((row) => (
                          <li
                            key={row.key}
                            className="flex items-center justify-between gap-2 rounded-xl border border-neutral-100 bg-neutral-50/90 px-4 py-3 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-neutral-900">{row.name}</span>
                              <span className="text-muted-foreground"> · #{row.orderId.slice(0, 8)}</span>
                            </span>
                            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              {row.rating}★ · {row.visibility}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Public reviews gallery */}
          <Card className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.03]">
            <CardHeader className="border-b border-neutral-100 px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Published</p>
                  <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-2xl text-neutral-900')}>
                    Your public reviews
                  </CardTitle>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    These are the dish ratings live on your profile after moderation. Filter by stars or date.
                  </p>
                </div>
                {stats.n > 0 ? (
                  <div className="w-full max-w-xs space-y-1.5 rounded-2xl border border-neutral-100 bg-neutral-50/90 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Star mix</p>
                    {([5, 4, 3, 2, 1] as const).map((k) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-6 shrink-0 font-bold text-neutral-600">{k}★</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-full rounded-full bg-orange-500/90"
                            style={{ width: `${stats.pct(k)}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-[10px] font-semibold text-muted-foreground">
                          {stats.pct(k)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="px-6 py-6 sm:px-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div className="flex flex-wrap gap-4 sm:gap-5">
                  <ReviewsFilterSelect
                    label="Rating"
                    tone="light"
                    value={ratingFilter === 'all' ? 'all' : String(ratingFilter)}
                    onChange={(e) =>
                      setRatingFilter(
                        e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
                      )
                    }
                  >
                    <option value="all">All ratings</option>
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        {r} stars
                      </option>
                    ))}
                  </ReviewsFilterSelect>
                  <ReviewsFilterSelect
                    label="Sort"
                    tone="dark"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as 'latest' | 'oldest')}
                  >
                    <option value="latest">Latest first</option>
                    <option value="oldest">Oldest first</option>
                  </ReviewsFilterSelect>
                </div>
              </div>

            {filtered.length === 0 ? (
              <EmptyState
                title={reviewCards.length === 0 ? 'No public reviews yet' : 'No matches'}
                description={
                  reviewCards.length === 0
                    ? 'Submit reviews from the Rate your dishes section above. After approval, they appear here with engagement.'
                    : 'Try a different star filter.'
                }
              />
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {slice.map((c) => (
                    <article
                      key={c.id}
                      className="group flex flex-col rounded-2xl border border-neutral-200/60 bg-gradient-to-b from-white to-neutral-50/80 p-5 shadow-sm ring-1 ring-black/[0.02] transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-sm font-black text-white shadow-inner">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-neutral-900">{c.menuName}</p>
                          <p className="text-xs text-muted-foreground">
                            Order #{c.orderId.slice(0, 8)} · {c.visibility}
                          </p>
                          <div className="mt-2 flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-4 w-4',
                                  i <= c.rating ? 'fill-amber-400 text-amber-500' : 'fill-neutral-200 text-neutral-300',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      {c.comment ? (
                        <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-neutral-700">{c.comment}</p>
                      ) : (
                        <p className="mt-3 text-sm italic text-muted-foreground">No written comment</p>
                      )}
                      {c.photoUrls.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {c.photoUrls.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={url.slice(0, 48)}
                              src={url}
                              alt=""
                              className="h-20 w-20 rounded-xl border border-neutral-100 object-cover"
                            />
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-muted-foreground">
                        <span>{formatRelative(c.createdAt)}</span>
                        <div className="flex items-center gap-3 font-semibold text-neutral-600">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {c.helpfulCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {c.replyCount}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-8 flex items-center justify-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[2rem] text-center text-sm font-bold text-primary tabular-nums">{safePage}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
