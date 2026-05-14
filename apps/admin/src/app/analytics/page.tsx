'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Calendar,
  Download,
  Layers,
  Percent,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Package,
} from 'lucide-react';
import {
  Button,
  DataPanel,
  EmptyState,
  MetricCard,
  PageStack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@wrap-roll/shared-ui';
import type {
  AnalyticsGrouping,
  SalesStatPoint,
  DatedMarginReport,
  ItemMargin,
  DailySalesReport,
  DailyIngredientConsumptionReport,
} from '@wrap-roll/contracts';
import { ANALYTICS_GROUPINGS } from '@wrap-roll/contracts';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { adminHexBackground, adminPageContainerClass, adminPageRootClass } from '../../lib/admin-ui-contract';

// All response types imported from @wrap-roll/contracts above.
// SalesStatPoint, DatedMarginReport, ItemMargin, PaymentReconciliation, DailySalesReport

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const BRAND = '#f97316'; // Mandarin primary
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#06b6d4', '#eab308'];

function fmtCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/* ─── Custom Tooltip ─────────────────────────────────────────────────────────── */

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-card p-3 shadow-lg text-sm">
      <p className="mb-1.5 font-bold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={adminHexBackground(p.color)} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-semibold">
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue')
              ? `Rs. ${p.value.toLocaleString()}`
              : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────────── */

export default function AnalyticsDashboard() {
  const defaults = useMemo(defaultDateRange, []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [grouping, setGrouping] = useState<AnalyticsGrouping>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [salesStats, setSalesStats] = useState<SalesStatPoint[]>([]);
  const [grossMargin, setGrossMargin] = useState<DatedMarginReport | null>(null);
  const [itemMargins, setItemMargins] = useState<ItemMargin[]>([]);
  const [dailyToday, setDailyToday] = useState<DailySalesReport | null>(null);
  const [consumption, setConsumption] = useState<DailyIngredientConsumptionReport | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, marginRes, itemRes, dailyRes, consumptionRes] = await Promise.allSettled([
        api.get(`/analytics/sales?startDate=${startDate}&endDate=${endDate}&grouping=${grouping}`),
        api.get(`/analytics/margin/gross?startDate=${startDate}&endDate=${endDate}`),
        api.get('/analytics/margins'),
        api.get('/analytics/sales/daily'),
        api.get(`/analytics/inventory/daily-consumption?startDate=${startDate}&endDate=${endDate}`),
      ]);

      if (statsRes.status === 'fulfilled') setSalesStats(statsRes.value.data as SalesStatPoint[]);
      if (marginRes.status === 'fulfilled') setGrossMargin(marginRes.value.data as DatedMarginReport);
      if (itemRes.status === 'fulfilled') setItemMargins(itemRes.value.data as ItemMargin[]);
      if (dailyRes.status === 'fulfilled') setDailyToday(dailyRes.value.data as DailySalesReport);
      if (consumptionRes.status === 'fulfilled') {
        setConsumption(consumptionRes.value.data as DailyIngredientConsumptionReport);
      } else {
        setConsumption(null);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : 'Request failed';
      setError(msg === 'Network Error' ? 'Could not reach the API. Start the API server (port 4000).' : msg);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, grouping]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  /* ── CSV Export */
  const exportCsv = () => {
    const rows = [
      ['Period', 'Revenue (Rs.)', 'Orders'],
      ...salesStats.map((s) => [s.label, s.revenue, s.volume]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wrap-roll-sales-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Source Breakdown pie data */
  const sourceData = dailyToday
    ? [
        { name: 'Web / Mobile', value: dailyToday.sourceBreakdown.web },
        { name: 'POS', value: dailyToday.sourceBreakdown.pos },
        { name: 'Delivery', value: dailyToday.sourceBreakdown.delivery },
      ].filter((d) => d.value > 0)
    : [];

  /* ── Overhead pie data */
  const overheadData = (grossMargin?.overheadByType ?? []).map((o) => ({
    name: o.costType.charAt(0) + o.costType.slice(1).toLowerCase(),
    value: o.amount,
  }));

  /* ── P&L stacked chart data */
  const plData = grossMargin
    ? [
        {
          label: 'Revenue',
          amount: grossMargin.totalRevenue,
        },
        {
          label: 'COGS',
          amount: grossMargin.totalCOGS,
        },
        {
          label: 'Overhead',
          amount: grossMargin.totalOverhead,
        },
        {
          label: 'Waste',
          amount: grossMargin.wasteImpact.estimatedValue,
        },
        {
          label: 'Contribution\nMargin',
          amount: grossMargin.contributionMargin,
        },
      ]
    : [];

  /* ── Summary KPIs from gross margin */
  const summaryKpis = [
    {
      label: 'Total Revenue',
      value: grossMargin ? fmtCurrency(grossMargin.totalRevenue) : '—',
      icon: Wallet,
      accent: '#3b82f6',
      sub: `${salesStats.reduce((s, r) => s + r.volume, 0)} orders in range`,
      subTrend: 'up' as const,
    },
    {
      label: 'Total COGS',
      value: grossMargin ? fmtCurrency(grossMargin.totalCOGS) : '—',
      icon: ShoppingBag,
      accent: '#ef4444',
      sub: 'Cost of goods sold',
    },
    {
      label: 'Gross Margin',
      value: grossMargin ? fmtPct(grossMargin.grossMarginPercentage) : '—',
      icon: Percent,
      accent: '#22c55e',
      sub: grossMargin ? fmtCurrency(grossMargin.grossMargin) : undefined,
      subTrend: grossMargin
        ? (grossMargin.grossMarginPercentage ?? 0) >= 60
          ? ('up' as const)
          : ('down' as const)
        : undefined,
    },
    {
      label: 'Contribution Margin',
      value: grossMargin ? fmtPct(grossMargin.contributionMarginPercentage) : '—',
      icon: TrendingUp,
      accent: '#a855f7',
      sub: grossMargin ? fmtCurrency(grossMargin.contributionMargin) : undefined,
      subTrend: grossMargin
        ? (grossMargin.contributionMarginPercentage ?? 0) >= 40
          ? ('up' as const)
          : ('down' as const)
        : undefined,
    },
  ];

  /* ─── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <PageStack>
          <AdminPageHeader
            title="Business Analytics"
            description="Financial intelligence — revenue, margins, COGS, and ingredient usage (restocking). Cash reconciliation lives on the Dashboard."
            actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Grouping toggle */}
            <div className="flex rounded-xl border bg-background p-1">
              {ANALYTICS_GROUPINGS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrouping(g)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                    grouping === g
                      ? 'bg-primary text-white shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1 rounded-xl border bg-background px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-32 bg-transparent text-xs font-medium text-foreground outline-none"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-32 bg-transparent text-xs font-medium text-foreground outline-none"
              />
            </div>

            <Button variant="outline" onClick={() => void fetchAll()} className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={exportCsv} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
            }
          />

              {error && (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ── KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryKpis.map((k) => (
          <MetricCard key={k.label} {...k} loading={loading} />
        ))}
      </div>

      {/* ── Revenue & Volume Chart */}
      <DataPanel>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h3 className="text-base font-bold">Revenue & Order Volume</h3>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {grouping}
          </span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : salesStats.length === 0 ? (
          <EmptyState title="No sales data" description="Adjust the date range or check the API." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={salesStats} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="revenue"
                orientation="left"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(value) => <span className="capitalize">{value}</span>}
              />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                name="revenue"
                fill={BRAND}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                opacity={0.85}
              />
              <Line
                yAxisId="volume"
                type="monotone"
                dataKey="volume"
                name="orders"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </DataPanel>

      {/* ── P&L + Source Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* P&L Waterfall */}
        <DataPanel>
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            <h3 className="text-base font-bold">P&L Breakdown</h3>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !grossMargin ? (
            <EmptyState title="No margin data" description="Set a date range and refresh." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" name="amount" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {plData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.label === 'Revenue' ? '#3b82f6'
                          : entry.label === 'COGS' ? '#ef4444'
                          : entry.label === 'Overhead' ? '#f97316'
                          : entry.label === 'Waste' ? '#eab308'
                          : '#22c55e'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Overhead breakdown */}
              {overheadData.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overhead by Type</p>
                  <div className="space-y-1.5">
                    {overheadData.map((o, i) => (
                      <div key={o.name} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={adminHexBackground(CHART_COLORS[i % CHART_COLORS.length])}
                          />
                          <span className="text-xs font-medium">{o.name}</span>
                        </div>
                        <span className="text-xs font-semibold">{fmtCurrency(o.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waste impact */}
              {grossMargin.wasteImpact.estimatedValue > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Waste impact: {fmtCurrency(grossMargin.wasteImpact.estimatedValue)} ({grossMargin.wasteImpact.quantity.toFixed(1)} units)
                  </span>
                </div>
              )}
            </>
          )}
        </DataPanel>

        {/* Source Breakdown Today */}
        <DataPanel>
          <div className="mb-4 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-cyan-500" />
            <h3 className="text-base font-bold">Order Source Today</h3>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sourceData.length === 0 ? (
            <EmptyState title="No orders today" description="Source breakdown will appear once orders come in." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v ?? 0} orders`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span
                            className="h-2 w-2 rounded-full"
                            style={adminHexBackground(CHART_COLORS[i % CHART_COLORS.length])}
                          />
                      <span className="text-xs font-medium">{s.name}</span>
                    </div>
                    <span className="text-xs font-bold">{s.value} orders</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DataPanel>
      </div>

      {/* ── Ingredient consumption (restocking) */}
      <DataPanel>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Package className="h-4 w-4 text-amber-600" />
          <h3 className="text-base font-bold">Ingredient usage (restocking)</h3>
          <span className="text-xs text-muted-foreground">
            From recorded COGS when orders enter the kitchen — same date range as above.
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Use <strong>period totals</strong> to estimate what to order; <strong>by day</strong> helps spot busy days.
        </p>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !consumption || consumption.totalsByIngredient.length === 0 ? (
          <EmptyState
            title="No consumption in this range"
            description="Usage appears after orders move to in_kitchen and COGS lines are written. Try a wider range or check inventory is wired."
          />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Totals for selected period
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Qty used</TableHead>
                      <TableHead className="text-right">Est. value (COGS)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumption.totalsByIngredient.map((row) => (
                      <TableRow key={row.ingredientId}>
                        <TableCell className="font-semibold">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.qtyConsumed.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmtCurrency(row.lineCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                By day (detail)
              </p>
              <div className="max-h-[320px] overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Day</TableHead>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumption.daily.map((row) => (
                      <TableRow key={`${row.day}-${row.ingredientId}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{row.day}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.qtyConsumed.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmtCurrency(row.lineCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DataPanel>

      {/* ── Per-Item Profitability Table */}
      <DataPanel>
        <div className="mb-4 flex items-center gap-2">
          <Percent className="h-4 w-4 text-green-500" />
          <h3 className="text-base font-bold">Per-Item Profitability</h3>
          <span className="text-xs text-muted-foreground">Sorted by gross margin — high to low</span>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : itemMargins.length === 0 ? (
          <EmptyState title="No margin data" description="Add recipes to menu items to see cost analysis." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>COGS</TableHead>
                  <TableHead>Gross Margin</TableHead>
                  <TableHead className="text-right">Food Cost %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemMargins.map((item) => {
                  const isHighMargin = item.foodCostPercentage < 35;
                  const isMidMargin = item.foodCostPercentage < 50;
                  return (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-semibold">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category || '—'}</TableCell>
                      <TableCell>{fmtCurrency(item.basePrice)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtCurrency(item.theoreticalCost)}</TableCell>
                      <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(item.grossMargin)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                            isHighMargin
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : isMidMargin
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {fmtPct(item.foodCostPercentage)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataPanel>
        </PageStack>
      </div>
    </div>
  );
}

