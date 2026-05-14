'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bike,
  ChefHat,
  Clock,
  Flame,
  Layers,
  RefreshCw,
  ShoppingBag,
  Trophy,
  Wallet,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import type {
  QueueOrder,
  OrderPipelineResponse,
  PipelineStage,
  TopSellerItem,
  DailySalesReport,
  PaymentReconciliation,
} from '@wrap-roll/contracts';
import { ACTIVE_PIPELINE_STATUSES } from '@wrap-roll/contracts';
import {
  Button,
  DataPanel,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  MetricCard,
  PageStack,
} from '@wrap-roll/shared-ui';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { CashReconciliationPanel } from '../components/CashReconciliationPanel';
import {
  adminHexBackground,
  adminHexBarGradientStyle,
  adminHexSolidStyle,
  adminHexTintStyle,
  adminPageContainerClass,
  adminPageRootClass,
  adminRankBadgeStyle,
} from '../lib/admin-ui-contract';

type OpsOrder = QueueOrder & {
  items?: Array<{ name: string; quantity: number; lineTotal: number }>;
};

// PipelineStage, PipelineTotals, OrderPipelineResponse, TopSellerItem — from @wrap-roll/contracts

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const STATUS_META: Record<string, { label: string; color: string; active: boolean }> = {
  placed:     { label: 'Placed',     color: '#f97316', active: true  },
  paid:       { label: 'Paid',       color: '#3b82f6', active: true  },
  in_kitchen: { label: 'Kitchen',    color: '#eab308', active: true  },
  ready:      { label: 'Ready',      color: '#22c55e', active: true  },
  in_transit: { label: 'Transit',    color: '#06b6d4', active: true  },
  delivered:  { label: 'Delivered',  color: '#a855f7', active: false },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', active: false },
  voided:     { label: 'Voided',     color: '#6b7280', active: false },
  refunded:   { label: 'Refunded',   color: '#d97706', active: false },
};

// ACTIVE_PIPELINE_STATUSES — imported from @wrap-roll/contracts

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const ORDERS_PAGE_SIZE = 20;

function formatOrderDateTime(value: string | Date | null | undefined): string {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const TRAFFIC_CHART_COLORS = ['#3b82f6', '#22c55e', '#f97316'];

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function PipelineFunnel({ pipeline, loading }: { pipeline: PipelineStage[]; loading: boolean }) {
  const activeStages = pipeline.filter((s) => (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(s.status));
  const maxCount = Math.max(...activeStages.map((s) => s.count), 1);

  return (
    <DataPanel>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <Flame className="h-4 w-4 text-orange-500" />
          Live Order Pipeline
          <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            Today
          </span>
        </h3>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-2 flex items-end gap-3">
          {activeStages.map((stage) => {
            const meta = STATUS_META[stage.status];
            const heightPct = (stage.count / maxCount) * 100;
            return (
              <div key={stage.status} className="group flex flex-1 flex-col items-center gap-1">
                <span
                  className="mb-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
                  style={adminHexTintStyle(meta.color)}
                >
                  {stage.count}
                </span>
                <div
                  className="relative w-full min-h-[4px] rounded-t-lg transition-all duration-500"
                  style={adminHexBarGradientStyle(meta.color, heightPct * 0.8)}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-0.5 rounded-full opacity-80"
                    style={adminHexBackground(meta.color)}
                  />
                  {/* Always-visible count badge */}
                  <div
                    className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums"
                    style={adminHexSolidStyle(meta.color)}
                  >
                    {stage.count}
                  </div>
                </div>
                <span className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DataPanel>
  );
}

function TrafficSourcePie({
  daily,
  loading,
}: {
  daily: DailySalesReport | null;
  loading: boolean;
}) {
  const sourceData = daily
    ? [
        { name: 'Web / Mobile', value: daily.sourceBreakdown.web },
        { name: 'POS', value: daily.sourceBreakdown.pos },
        { name: 'Delivery', value: daily.sourceBreakdown.delivery },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <DataPanel>
      <h3 className="mb-1 flex items-center gap-2 text-base font-bold">
        <Layers className="h-4 w-4 text-cyan-500" />
        Order traffic
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Paid orders by channel today (same metric as Analytics → daily sales).
      </p>

      {loading ? (
        <div className="flex h-[200px] items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sourceData.length === 0 ? (
        <p className="text-sm text-muted-foreground">No paid orders on this day.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {sourceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={TRAFFIC_CHART_COLORS[index % TRAFFIC_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value ?? 0)} orders`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1.5">
            {sourceData.map((s, i) => (
              <li key={s.name} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: TRAFFIC_CHART_COLORS[i % TRAFFIC_CHART_COLORS.length] }}
                  />
                  {s.name}
                </span>
                <span className="font-semibold tabular-nums">{s.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DataPanel>
  );
}

function TopSellersPanel({ sellers, loading }: { sellers: TopSellerItem[]; loading: boolean }) {
  return (
    <DataPanel>
      <h3 className="mb-4 flex items-center gap-2 text-base font-bold">
        <Trophy className="h-4 w-4 text-yellow-500" />
        Top Sellers Today
      </h3>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No paid orders yet today.</p>
      ) : (
        <div className="space-y-2">
          {sellers.map((item) => (
            <div key={item.menuItemId} className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                style={adminRankBadgeStyle(item.rank)}
              >
                {item.rank}
              </span>
              <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                ×{item.qtySold}
              </span>
              <span className="text-xs text-muted-foreground">Rs.{fmt(item.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

function parseFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === 'bigint') return Number(v);
  return null;
}

/** Accepts dashboard-list payloads even if numbers were serialized loosely; derives hasMore when omitted. */
function parseDashboardOrdersPayload(
  data: unknown,
  fallbackPage: number,
  fallbackLimit: number,
): { items: OpsOrder[]; total: number; hasMore: boolean } | null {
  if (typeof data !== 'object' || data === null) return null;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  const total = parseFiniteNumber(o.total);
  if (total === null || total < 0) return null;
  const page = parseFiniteNumber(o.page) ?? fallbackPage;
  const limit = parseFiniteNumber(o.limit) ?? fallbackLimit;
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const skip = (safePage - 1) * safeLimit;
  let hasMore: boolean;
  if (typeof o.hasMore === 'boolean') {
    hasMore = o.hasMore;
  } else {
    hasMore = skip + o.items.length < total;
  }
  return { items: o.items as OpsOrder[], total, hasMore };
}

export default function Index() {
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<OrderPipelineResponse | null>(null);
  const [topSellers, setTopSellers] = useState<TopSellerItem[]>([]);
  const [dailySales, setDailySales] = useState<DailySalesReport | null>(null);
  const [reconciliation, setReconciliation] = useState<PaymentReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OpsOrder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, pipelineRes, sellersRes, dailyRes, reconRes] = await Promise.allSettled([
        api.get('/orders/admin/dashboard-list', {
          params: {
            page: ordersPage,
            limit: ORDERS_PAGE_SIZE,
          },
        }),
        api.get('/analytics/pipeline'),
        api.get('/analytics/top-sellers?limit=8'),
        api.get('/analytics/sales/daily'),
        api.get('/analytics/payments/reconciliation'),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const data = ordersRes.value.data as unknown;
        const parsed = parseDashboardOrdersPayload(data, ordersPage, ORDERS_PAGE_SIZE);
        if (parsed) {
          setOrders(parsed.items);
          setOrdersTotal(parsed.total);
          setOrdersHasMore(parsed.hasMore);
          setOrdersError(null);
        } else {
          setOrders([]);
          setOrdersTotal(0);
          setOrdersHasMore(false);
          setOrdersError("Couldn't load today's orders (unexpected response shape).");
        }
      } else {
        const reason = ordersRes.reason;
        const msg =
          reason && typeof reason === 'object' && 'message' in reason && typeof (reason as Error).message === 'string'
            ? (reason as Error).message
            : 'Failed to load orders.';
        setOrdersError(msg);
      }
      if (pipelineRes.status === 'fulfilled') {
        setPipeline(pipelineRes.value.data as OrderPipelineResponse);
      }
      if (sellersRes.status === 'fulfilled') {
        setTopSellers(Array.isArray(sellersRes.value.data) ? sellersRes.value.data : []);
      }
      if (dailyRes.status === 'fulfilled') {
        setDailySales(dailyRes.value.data as DailySalesReport);
      } else {
        setDailySales(null);
      }
      if (reconRes.status === 'fulfilled') {
        setReconciliation(reconRes.value.data as PaymentReconciliation);
      } else {
        setReconciliation(null);
      }
      setLastRefreshed(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ordersPage]);

  // Initial load + 30-second auto-refresh
  useEffect(() => {
    void fetchAll(false);
    timerRef.current = setInterval(() => void fetchAll(true), 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  const totals = pipeline?.totals;
  const pipelineStages = pipeline?.pipeline ?? [];

  /* ── Yesterday comparison placeholder (could be wired to /analytics/sales/daily?date=yesterday) */
  const kpiCards = [
    {
      label: 'Revenue Today',
      value: totals ? `Rs. ${fmt(totals.revenueToday)}` : '—',
      icon: Wallet,
      accent: '#3b82f6',
      sub: 'Paid orders only',
    },
    {
      label: 'Orders Today',
      value: totals?.totalToday ?? '—',
      icon: ShoppingBag,
      accent: '#f97316',
      sub: `${totals?.paidOrdersToday ?? 0} paid`,
    },
    {
      label: 'Avg Ticket',
      value: totals ? `Rs. ${fmt(totals.avgTicket)}` : '—',
      icon: ArrowUpRight,
      accent: '#22c55e',
      sub: 'Per paid order',
    },
    {
      label: 'Active Queue',
      value: pipelineStages
        .filter((s) => (ACTIVE_PIPELINE_STATUSES as readonly string[]).includes(s.status))
        .reduce((s, p) => s + p.count, 0),
      icon: ChefHat,
      accent: '#eab308',
      sub: 'Kitchen + ready + transit',
    },
  ];

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <PageStack>
          <AdminPageHeader
            title="Dashboard"
            description="Live operations command center — today’s pipeline, sales, cash reconciliation, and orders; auto-refreshes every 30 seconds."
            actions={
              <div className="flex items-center gap-3">
                {lastRefreshed && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
                <Button
                  variant="outline"
                  onClick={() => void fetchAll(false)}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            }
          />

          {/* ── KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((c) => (
          <MetricCard key={c.label} {...c} loading={loading} />
        ))}
      </div>

      {/* ── Pipeline + Top Sellers + Traffic */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineFunnel pipeline={pipelineStages} loading={loading} />
        </div>
        <div className="flex flex-col gap-6">
          <TopSellersPanel sellers={topSellers} loading={loading} />
          <TrafficSourcePie daily={dailySales} loading={loading} />
        </div>
      </div>

      <CashReconciliationPanel reconciliation={reconciliation} loading={loading} />

      {/* ── Recent Orders */}
      <DataPanel>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold">
              <ShoppingBag className="h-4 w-4 text-blue-500" />
              Recent Orders
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Today&apos;s orders (server-paginated). Click a row for details.
            </p>
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <EmptyState title="Loading orders…" description="Fetching live data." />
        ) : ordersError ? (
          <EmptyState title="Orders list unavailable" description={ordersError} />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders today" description="Orders placed today will appear here." />
        ) : (
          <>
          <div className="space-y-1.5">
            {orders.map((o) => {
              const isPaid = String(o.paymentStatus) === 'completed';
              const meta = STATUS_META[o.status as string] ?? { color: '#94a3b8', label: String(o.status) };
              return (
                <button
                  key={o.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedOrder(o)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={adminHexBackground(meta.color)} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        #{String(o.id).slice(0, 8).toUpperCase()}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {String(o.fulfillmentType ?? '').replace('_', ' ')}
                        </span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{o.customer?.name || 'Guest'}</span>
                        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground/90">
                          {formatOrderDateTime(o.placedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={adminHexTintStyle(meta.color)}
                    >
                      {meta.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}
                    >
                      {isPaid ? 'Paid' : 'Pending'}
                    </span>
                    <span className="w-24 text-right text-sm font-semibold">
                      Rs. {Number(o.total).toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {ordersTotal === 0
                ? 'No orders'
                : `Showing ${(ordersPage - 1) * ORDERS_PAGE_SIZE + 1}–${Math.min(ordersPage * ORDERS_PAGE_SIZE, ordersTotal)} of ${ordersTotal} today`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ordersPage <= 1 || loading}
                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!ordersHasMore || loading}
                onClick={() => setOrdersPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
          </>
        )}
      </DataPanel>

      {/* ── Order Detail Drawer */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:max-w-lg">
          <DialogHeader className="border-b border-border/60 bg-muted/30 px-5 py-4 text-left sm:px-6">
            <DialogTitle className="flex items-center gap-2 pr-8 text-base font-bold">
              <Bike className="h-5 w-5 shrink-0 text-primary" />
              Order #{String(selectedOrder?.id ?? '').slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 px-5 pb-6 pt-4 text-sm sm:px-6">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Placed</p>
                  <p className="font-semibold">{formatOrderDateTime(selectedOrder.placedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{String(selectedOrder.status).replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment</p>
                  <p className="font-semibold capitalize">{String(selectedOrder.paymentMethod ?? '—')} / {String(selectedOrder.paymentStatus ?? '—')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fulfillment</p>
                  <p className="font-semibold capitalize">{String(selectedOrder.fulfillmentType ?? '—').replace('_', ' ')}</p>
                </div>
                <div className="col-span-2 border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-primary">Rs. {Number(selectedOrder.total).toFixed(2)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">
                  {selectedOrder.customer?.name || 'Guest'}
                  {selectedOrder.customer?.phone ? ` • ${selectedOrder.customer.phone}` : ''}
                </p>
              </div>
              {selectedOrder.estimatedReadyTime && (
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{new Date(String(selectedOrder.estimatedReadyTime)).toLocaleString()}</p>
                </div>
              )}
              <div className="pb-0.5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
                {Array.isArray(selectedOrder.items) && selectedOrder.items.length ? (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-muted/50">
                    {selectedOrder.items.map((it, idx) => (
                      <li
                        key={`${it.name}-${idx}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 first:pt-3.5 last:pb-3.5"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold tabular-nums">×{it.quantity}</span>{' '}
                          <span className="text-foreground">{it.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          Rs. {Number(it.lineTotal ?? 0).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No item details available.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </PageStack>
      </div>
    </div>
  );
}
