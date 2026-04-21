'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bike,
  ChefHat,
  Clock,
  Flame,
  RefreshCw,
  ShoppingBag,
  Trophy,
  Wallet,
} from 'lucide-react';
import api from '../services/api';
import type { QueueOrder, OrderPipelineResponse, PipelineStage, TopSellerItem } from '@wrap-roll/contracts';
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
  PageHeader,
  PageStack,
} from '@wrap-roll/shared-ui';

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
                  style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                >
                  {stage.count}
                </span>
                <div
                  className="relative w-full min-h-[4px] rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${Math.max(4, heightPct * 0.8)}px`,
                    background: `linear-gradient(to top, ${meta.color}cc, ${meta.color}55)`,
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-0.5 rounded-full opacity-80"
                    style={{ backgroundColor: meta.color }}
                  />
                  {/* Always-visible count badge */}
                  <div
                    className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums"
                    style={{ backgroundColor: meta.color, color: '#fff' }}
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
                style={{
                  background:
                    item.rank === 1
                      ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
                      : item.rank === 2
                        ? 'linear-gradient(135deg,#94a3b8,#64748b)'
                        : item.rank === 3
                          ? 'linear-gradient(135deg,#b45309,#92400e)'
                          : '#e2e8f0',
                  color: item.rank <= 3 ? '#fff' : '#64748b',
                }}
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

export default function Index() {
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [pipeline, setPipeline] = useState<OrderPipelineResponse | null>(null);
  const [topSellers, setTopSellers] = useState<TopSellerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OpsOrder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, pipelineRes, sellersRes] = await Promise.allSettled([
        api.get('/orders'),
        api.get('/analytics/pipeline'),
        api.get('/analytics/top-sellers?limit=8'),
      ]);

      if (ordersRes.status === 'fulfilled') {
        setOrders(Array.isArray(ordersRes.value.data) ? ordersRes.value.data : []);
      }
      if (pipelineRes.status === 'fulfilled') {
        setPipeline(pipelineRes.value.data as OrderPipelineResponse);
      }
      if (sellersRes.status === 'fulfilled') {
        setTopSellers(Array.isArray(sellersRes.value.data) ? sellersRes.value.data : []);
      }
      setLastRefreshed(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load + 30-second auto-refresh
  useEffect(() => {
    void fetchAll(false);
    timerRef.current = setInterval(() => void fetchAll(true), 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  const collectCash = async (orderId: string) => {
    setCollectingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/mark-payment-received`, { method: 'cash' });
      await fetchAll(true);
    } finally {
      setCollectingId(null);
    }
  };

  const cashPending = orders.filter(
    (o) => o.paymentMethod === 'cash' && o.paymentStatus !== 'completed',
  );

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
    <PageStack>
      <PageHeader
        title="Dashboard"
        description="Live operations command center — auto-refreshes every 30 seconds."
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

      {/* ── Pipeline + Top Sellers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PipelineFunnel pipeline={pipelineStages} loading={loading} />
        </div>
        <TopSellersPanel sellers={topSellers} loading={loading} />
      </div>

      {/* ── Cash Collection Queue */}
      <DataPanel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Wallet className="h-4 w-4 text-emerald-500" />
            Cash Collection Queue
            {cashPending.length > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {cashPending.length} pending
              </span>
            )}
          </h3>
        </div>
        {cashPending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending cash collections. ✓</p>
        ) : (
          <div className="space-y-2">
            {cashPending.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm font-bold tracking-wide">
                    #{String(o.id).slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.customer?.name || 'Guest'} •{' '}
                    {String(o.fulfillmentType ?? '').replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">Rs. {Number(o.total).toFixed(2)}</span>
                  <Button
                    size="sm"
                    disabled={collectingId === o.id}
                    onClick={() => void collectCash(o.id)}
                    className="h-7 text-xs"
                  >
                    {collectingId === o.id ? 'Collecting…' : 'Mark Received'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataPanel>

      {/* ── Recent Orders */}
      <DataPanel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <ShoppingBag className="h-4 w-4 text-blue-500" />
            Recent Orders
          </h3>
          <span className="text-xs text-muted-foreground">Latest 20 — click for details</span>
        </div>

        {loading && orders.length === 0 ? (
          <EmptyState title="Loading orders…" description="Fetching live data." />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders today" description="Orders will appear here as they come in." />
        ) : (
          <div className="space-y-1.5">
            {orders.slice(0, 20).map((o) => {
              const isPaid = String(o.paymentStatus) === 'completed';
              const meta = STATUS_META[o.status as string] ?? { color: '#94a3b8', label: String(o.status) };
              return (
                <button
                  key={o.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedOrder(o)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div>
                      <p className="text-sm font-bold">
                        #{String(o.id).slice(0, 8).toUpperCase()}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {String(o.fulfillmentType ?? '').replace('_', ' ')}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.customer?.name || 'Guest'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: `${meta.color}20`,
                        color: meta.color,
                      }}
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
        )}
      </DataPanel>

      {/* ── Order Detail Drawer */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5 text-primary" />
              Order #{String(selectedOrder?.id ?? '').slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3">
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
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-primary">Rs. {Number(selectedOrder.total).toFixed(2)}</p>
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
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</p>
                {Array.isArray(selectedOrder.items) && selectedOrder.items.length ? (
                  <div className="space-y-1 rounded-xl border p-3">
                    {selectedOrder.items.map((it, idx) => (
                      <div key={`${it.name}-${idx}`} className="flex items-center justify-between">
                        <span>
                          <span className="font-semibold">×{it.quantity}</span> {it.name}
                        </span>
                        <span className="text-muted-foreground">Rs. {Number(it.lineTotal ?? 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No item details available.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageStack>
  );
}
