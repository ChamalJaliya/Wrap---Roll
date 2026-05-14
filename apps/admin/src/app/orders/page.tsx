'use client';

import { useEffect, useRef, startTransition, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock,
  Hash,
  Hourglass,
  Truck,
  XCircle,
  Zap,
} from 'lucide-react';
import api from '../../services/api';
import { AdminAuthService } from '../../lib/auth';
import type {
  OpsActivityEventRow,
  PublicBusinessSettings,
  OpsQueueOrder,
  QueueOrderStatus,
  SupportOrderDetails,
} from '@wrap-roll/contracts';
import { ORDER_FLOW_BOARD_STATUSES, mergeQueueOrderFromApiPatch } from '@wrap-roll/contracts';
import { useQueueDirtyStream } from '@wrap-roll/order-kit';
import {
  Button,
  DataPanel,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  MetricCard,
  OrderQueueBoard,
  OrderDetailsModal,
  PageStack,
  QueueOrderCard,
  SegmentedControl,
  SegmentedControlItem,
  cn,
} from '@wrap-roll/shared-ui';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { adminPageContainerClass, adminPageRootClass } from '../../lib/admin-ui-contract';

type ReconciliationSummary = {
  totalOrders: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
};

/** Paginated queue wrapper; `GET /orders/queue` for ADMIN returns full ops rows (`OpsQueueOrder`). */
type QueueResponse = {
  items?: OpsQueueOrder[];
};

type QueueInfraQueueHealth = {
  name: string;
  ready: boolean;
  reason?: string;
  error?: string;
  counts?: {
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
  };
};

type QueueInfraHealthResponse = {
  enabled: boolean;
  prefix: string;
  queues: QueueInfraQueueHealth[];
};

type QueueLiveStatus = 'disabled' | 'connecting' | 'connected' | 'reconnecting';

function queueLiveStatusLabel(status: QueueLiveStatus): string {
  if (status === 'connected') return 'Live: connected';
  if (status === 'reconnecting') return 'Live: reconnecting';
  if (status === 'connecting') return 'Live: connecting';
  return 'Live: disabled';
}

function queueLiveStatusClass(status: QueueLiveStatus): string {
  if (status === 'connected') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'reconnecting') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'connecting') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-neutral-200 bg-neutral-50 text-neutral-600';
}

export default function OrdersConsolePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openOrderId = searchParams.get('openOrder');
  const [orders, setOrders] = useState<OpsQueueOrder[]>([]);
  const [selected, setSelected] = useState<OpsQueueOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<OpsQueueOrder[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<SupportOrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [paymentEvents, setPaymentEvents] = useState<OpsActivityEventRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<'customer' | 'fulfillment'>('customer');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editDeliveryAddress, setEditDeliveryAddress] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [boardView, setBoardView] = useState<'order' | 'payment'>('order');
  const [reconDate, setReconDate] = useState<string | null>(null);
  const [businessToday, setBusinessToday] = useState<string | null>(null);
  const [recon, setRecon] = useState<ReconciliationSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [queueLiveStatus, setQueueLiveStatus] = useState<QueueLiveStatus>('connecting');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagHealth, setDiagHealth] = useState<QueueInfraHealthResponse | null>(null);
  const [diagEvents, setDiagEvents] = useState<OpsActivityEventRow[]>([]);
  const [diagFetchedAt, setDiagFetchedAt] = useState<string | null>(null);
  const queueLoadInFlightRef = useRef<Promise<void> | null>(null);
  const queueLoadPendingRef = useRef<'silent' | 'loud' | null>(null);

  const handleAuthFailure = (error: unknown) => {
    const status =
      error &&
      typeof error === 'object' &&
      'response' in error &&
      typeof (error as { response?: { status?: number } }).response?.status === 'number'
        ? (error as { response?: { status?: number } }).response!.status!
        : null;
    if (status === 401 && typeof window !== 'undefined') {
      window.location.href = `/auth/signin?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return true;
    }
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    const fallback = new Date().toISOString().slice(0, 10);
    void (async () => {
      try {
        const res = await api.get<PublicBusinessSettings>('/settings');
        const d = res.data?.operationalCalendarDate;
        if (
          cancelled ||
          typeof d !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(d)
        ) {
          if (!cancelled) {
            setBusinessToday(fallback);
            setReconDate(fallback);
          }
          return;
        }
        setBusinessToday(d);
        setReconDate(d);
      } catch {
        if (!cancelled) {
          setBusinessToday(fallback);
          setReconDate(fallback);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runQueueLoad = async (silent: boolean) => {
    if (!reconDate) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(
        `/orders/queue?status=placed,paid,in_kitchen,ready,in_transit,delivered,cancelled,voided,refunded&date=${reconDate}`,
      );
      const payload = (res.data ?? {}) as QueueResponse | OpsQueueOrder[];
      if (Array.isArray(payload)) {
        setOrders(payload);
      } else {
        setOrders(Array.isArray(payload.items) ? payload.items : []);
      }
      setLoadError(null);
    } catch (error: unknown) {
      if (handleAuthFailure(error)) return;
      const message =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message?: string }).message === 'string'
          ? (error as { message?: string }).message!
          : 'Failed to load orders queue.';
      setLoadError(message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const load = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (queueLoadInFlightRef.current) {
      if (silent) {
        if (queueLoadPendingRef.current == null) {
          queueLoadPendingRef.current = 'silent';
        }
      } else {
        queueLoadPendingRef.current = 'loud';
      }
      return queueLoadInFlightRef.current;
    }
    const run = async () => {
      await runQueueLoad(silent);
      while (queueLoadPendingRef.current) {
        const next = queueLoadPendingRef.current;
        queueLoadPendingRef.current = null;
        await runQueueLoad(next === 'silent');
      }
    };
    queueLoadInFlightRef.current = run().finally(() => {
      queueLoadInFlightRef.current = null;
    });
    return queueLoadInFlightRef.current;
  };

  /**
   * Local dev: connect SSE directly to Nest to avoid Next route stream churn.
   * Hosted env: keep same-origin proxy path.
   */
  const queueStreamApiBase =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'http://127.0.0.1:4000/api'
      : '/api/nest';

  useQueueDirtyStream({
    enabled: Boolean(reconDate),
    apiBaseUrl: queueStreamApiBase,
    getAccessToken: async () => {
      const { session } = await AdminAuthService.getSession();
      const token =
        session && typeof session === 'object' && 'accessToken' in session
          ? (session as { accessToken?: string | null }).accessToken
          : null;
      return typeof token === 'string' && token.length > 0 ? token : null;
    },
    onDirty: () => void load({ silent: true }),
    onStatusChange: setQueueLiveStatus,
  });

  const loadReconciliation = async (date: string) => {
    try {
      const res = await api.get('/orders/reconciliation/summary', { params: { date } });
      setRecon(res.data ?? null);
    } catch (error: unknown) {
      if (handleAuthFailure(error)) return;
      setRecon(null);
    }
  };

  const loadDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const [healthRes, eventsRes] = await Promise.all([
        api.get<QueueInfraHealthResponse>('/queue/infra/health'),
        api.get<OpsActivityEventRow[]>('/orders/activity', {
          params: {
            take: 30,
            app: 'system',
            entityType: 'order',
          },
        }),
      ]);
      setDiagHealth(healthRes.data ?? null);
      setDiagEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setDiagError(null);
      setDiagFetchedAt(new Date().toISOString());
    } catch (error) {
      if (handleAuthFailure(error)) return;
      const message =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message?: string }).message === 'string'
          ? (error as { message?: string }).message!
          : 'Failed to load diagnostics.';
      setDiagError(message);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    if (!reconDate) return;
    void load();
    void loadReconciliation(reconDate);
    const t = setInterval(() => void load({ silent: true }), 90_000);
    return () => clearInterval(t);
  }, [reconDate]);

  useEffect(() => {
    if (!reconDate) return;
    if (queueLiveStatus === 'connected') return;
    // Fallback polling keeps queue fresh while SSE reconnects.
    const t = setInterval(() => void load({ silent: true }), 5000);
    return () => clearInterval(t);
  }, [reconDate, queueLiveStatus]);

  useEffect(() => {
    if (!diagnosticsOpen) return;
    void loadDiagnostics();
  }, [diagnosticsOpen]);

  const runSearch = async () => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await api.get('/orders/support/search', { params: { q } });
    setSearchResults(Array.isArray(res.data) ? res.data : []);
  };

  /**
   * Refetch queue after mutations without blanking the board (`silent` load).
   * Status-only moves skip reconciliation (lighter); payment actions refresh recon totals.
   * Runs in the background so the click handler returns as soon as the PATCH completes.
   */
  const refreshQueueAfterMutation = async (opts?: { withRecon?: boolean }) => {
    const withRecon = opts?.withRecon ?? true;
    if (!reconDate) {
      await load({ silent: true });
      return;
    }
    if (withRecon) {
      await Promise.all([load({ silent: true }), loadReconciliation(reconDate)]);
    } else {
      await load({ silent: true });
    }
  };

  /** Phase 2: apply PATCH response immediately; silent refresh reconciles projections (actions/SLA). */
  const patchOrderRowsFromApi = (orderId: string, apiBody: unknown) => {
    const apply = (row: OpsQueueOrder) => mergeQueueOrderFromApiPatch(row, apiBody);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? apply(o) : o)));
    setSearchResults((prev) => prev.map((o) => (o.id === orderId ? apply(o) : o)));
    setSelected((sel) => (sel && sel.id === orderId ? apply(sel) : sel));
  };

  const markCashReceived = async (id: string) => {
    const row =
      orders.find((x) => x.id === id) ?? searchResults.find((x) => x.id === id) ?? null;
    const totalLkr = Number(row?.total ?? 0);
    const tender = (Math.round(totalLkr * 100) / 100).toFixed(2);
    const res = await api.patch(`/orders/${id}/mark-payment-received`, {
      method: 'cash',
      ...(row
        ? { note: `Admin mark received · Tender Rs ${tender} · Change Rs 0.00` }
        : {}),
    });
    patchOrderRowsFromApi(id, res.data);
    void refreshQueueAfterMutation({ withRecon: true });
  };

  const markCardReceived = async (id: string) => {
    const res = await api.patch(`/orders/${id}/mark-payment-received`, { method: 'card' });
    patchOrderRowsFromApi(id, res.data);
    void refreshQueueAfterMutation({ withRecon: true });
  };

  const moveStatus = async (id: string, status: QueueOrderStatus) => {
    const res = await api.patch(`/orders/${id}/status`, { status });
    patchOrderRowsFromApi(id, res.data);
    void refreshQueueAfterMutation({ withRecon: false });
  };

  const loadOrderDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const [detailsRes, eventsRes] = await Promise.all([
        api.get(`/orders/support/${id}`),
        api.get(`/activity/orders/${id}`),
      ]);
      setSelectedDetails(detailsRes.data ?? null);
      setPaymentEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
    } finally {
      setDetailsLoading(false);
    }
  };

  const toQueueOrderFromDetails = (details: SupportOrderDetails): OpsQueueOrder => ({
    id: details.id,
    status: details.status,
    paymentStatus: details.paymentStatus,
    paymentMethod: details.paymentMethod,
    paymentCollection: details.paymentCollection ?? null,
    source: details.source,
    fulfillmentType: details.fulfillmentType,
    customer: details.customer ?? null,
    total: details.total,
    estimatedReadyTime: details.estimatedReadyTime ?? null,
    deliveryAddress: details.deliveryAddress ?? null,
    tableNumber: details.tableNumber ?? null,
    placedAt: details.placedAt,
    updatedAt: details.updatedAt,
    staffScheduleOverride: details.staffScheduleOverride === true,
  });

  const clearOpenOrderParam = () => {
    if (!searchParams.has('openOrder')) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('openOrder');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (!openOrderId) return;
    const existing = orders.find((o) => o.id === openOrderId) ?? null;
    if (existing) {
      setSelected(existing);
      void loadOrderDetails(existing.id);
      clearOpenOrderParam();
      return;
    }
    void (async () => {
      try {
        setDetailsLoading(true);
        const [detailsRes, eventsRes] = await Promise.all([
          api.get(`/orders/support/${openOrderId}`),
          api.get(`/activity/orders/${openOrderId}`),
        ]);
        const details = (detailsRes.data ?? null) as SupportOrderDetails | null;
        if (!details) return;
        setSelected(toQueueOrderFromDetails(details));
        setSelectedDetails(details);
        setPaymentEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        clearOpenOrderParam();
      } finally {
        setDetailsLoading(false);
      }
    })();
  }, [openOrderId, orders]);

  const nowMs = Date.now();
  const terminalOrderStatuses: OpsQueueOrder['status'][] = ['delivered', 'cancelled', 'voided', 'refunded'];
  const inProgressOrderStatuses: OpsQueueOrder['status'][] = ['paid', 'in_kitchen', 'ready', 'in_transit'];
  const isOverdueScheduled = (o: OpsQueueOrder) =>
    !!o.estimatedReadyTime &&
    new Date(String(o.estimatedReadyTime)).getTime() < nowMs &&
    !terminalOrderStatuses.includes(o.status);

  const opsOrders = orders.filter((o) => !terminalOrderStatuses.includes(o.status));
  const overdueSlaCount = opsOrders.filter((o) => o.slaBucket === 'overdue').length;
  const dueSoonSlaCount = opsOrders.filter((o) => o.slaBucket === 'due_soon').length;
  const scheduledHoldCount = opsOrders.filter((o) => o.releaseReason === 'SCHEDULED_PENDING').length;
  const rushCount = opsOrders.filter((o) => o.kitchenPriority === 'rush').length;

  const orderFilterOptions = [
    { id: 'all', label: 'All', match: (o: OpsQueueOrder) => true },
    { id: 'placed', label: 'Placed', match: (o: OpsQueueOrder) => o.status === 'placed' },
    {
      id: 'in_progress',
      label: 'In progress',
      match: (o: OpsQueueOrder) => inProgressOrderStatuses.includes(o.status),
    },
    {
      id: 'completed',
      label: 'Completed',
      match: (o: OpsQueueOrder) => terminalOrderStatuses.includes(o.status),
    },
    { id: 'scheduled_overdue', label: 'Scheduled overdue', match: (o: OpsQueueOrder) => isOverdueScheduled(o) },
    { id: 'sla_overdue', label: 'SLA overdue', match: (o: OpsQueueOrder) => o.slaBucket === 'overdue' },
    { id: 'sla_due_soon', label: 'Due soon', match: (o: OpsQueueOrder) => o.slaBucket === 'due_soon' },
    {
      id: 'scheduled_hold',
      label: 'Scheduled hold',
      match: (o: OpsQueueOrder) => o.releaseReason === 'SCHEDULED_PENDING',
    },
    { id: 'rush', label: 'Rush', match: (o: OpsQueueOrder) => o.kitchenPriority === 'rush' },
    { id: 'delivery_board', label: 'Delivery', match: (o: OpsQueueOrder) => o.fulfillmentType === 'delivery' },
    { id: 'phone_calls', label: 'Phone calls', match: (o: OpsQueueOrder) => o.source === 'cashier_pos_offline' },
  ];

  const paymentFilterOptions = [
    { id: 'all', label: 'All', match: (o: OpsQueueOrder) => true },
    {
      id: 'pending',
      label: 'Pending',
      match: (o: OpsQueueOrder) => o.paymentStatus === 'pending',
    },
    {
      id: 'completed',
      label: 'Completed',
      match: (o: OpsQueueOrder) => o.paymentStatus === 'completed',
    },
    { id: 'failed', label: 'Failed', match: (o: OpsQueueOrder) => o.paymentStatus === 'failed' },
    { id: 'refunded', label: 'Refunded', match: (o: OpsQueueOrder) => o.paymentStatus === 'refunded' },
    {
      id: 'cash_pending',
      label: 'Cash pending',
      match: (o: OpsQueueOrder) => o.paymentMethod === 'cash' && o.paymentStatus !== 'completed',
    },
    {
      id: 'checkout_aborted',
      label: 'Checkout aborted',
      match: (o: OpsQueueOrder) =>
        o.status === 'voided' &&
        o.paymentStatus === 'failed' &&
        (o.paymentMethod === 'payhere' || o.paymentMethod === 'online'),
    },
  ];

  const currentFilterOptions = boardView === 'order' ? orderFilterOptions : paymentFilterOptions;
  const activeFilterMatcher = currentFilterOptions.find((f) => f.id === activeFilter)?.match ?? ((o: OpsQueueOrder) => true);
  const scopedOrders = orders;
  const filteredOrders = scopedOrders.filter(activeFilterMatcher);
  const orderBoardStatuses = ORDER_FLOW_BOARD_STATUSES as readonly QueueOrderStatus[];
  const orderBoardTitle: Record<QueueOrderStatus, string> = {
    placed: 'Placed',
    paid: 'Paid',
    in_kitchen: 'In kitchen',
    ready: 'Ready',
    in_transit: 'In transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    voided: 'Voided',
    refunded: 'Refunded',
  };
  const orderBoardColumns = [
    ...orderBoardStatuses.filter((s) => s !== 'delivered'),
    'delivered_settled',
    'delivered_unpaid',
  ] as const;
  const orderBoardColumnTitle: Record<(typeof orderBoardColumns)[number], string> = {
    placed: 'Placed',
    paid: 'Paid',
    in_kitchen: 'In kitchen',
    ready: 'Ready',
    in_transit: 'In transit',
    cancelled: 'Cancelled',
    voided: 'Voided',
    refunded: 'Refunded',
    delivered_settled: 'Delivered settled',
    delivered_unpaid: 'Delivered unpaid follow-up',
  };
  const ordersForOrderColumn = (key: (typeof orderBoardColumns)[number]) => {
    if (key === 'delivered_settled') {
      return filteredOrders.filter((o) => o.status === 'delivered' && o.paymentStatus === 'completed');
    }
    if (key === 'delivered_unpaid') {
      return filteredOrders.filter((o) => o.status === 'delivered' && o.paymentStatus !== 'completed');
    }
    return filteredOrders.filter((o) => o.status === key);
  };

  useEffect(() => {
    if (!currentFilterOptions.some((f) => f.id === activeFilter)) {
      setActiveFilter('all');
    }
  }, [boardView, activeFilter, currentFilterOptions]);

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <PageStack>
          <AdminPageHeader
            title="Orders Console"
            description="Look up any order below, then use filters and the board for today’s queue."
          />
      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}
      {loading ? <EmptyState title="Loading orders..." description="Fetching active queue." /> : null}

      <section className="mb-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card/90 to-card p-4 shadow-sm md:p-5">
        <div className="mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Find an order
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Support search by order id, customer name, or phone (min. 2 characters). Results open here —
            they do not filter the kanban columns.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order id, customer name, phone…"
            className="h-10 min-w-0 flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch();
            }}
            aria-label="Support order search"
          />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" className="h-10 text-xs font-semibold" onClick={() => void runSearch()}>
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 text-xs font-semibold"
              onClick={() => void load({ silent: true })}
            >
              Refresh queue
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 text-xs font-semibold"
              onClick={() => setDiagnosticsOpen(true)}
            >
              Diagnostics
            </Button>
          </div>
        </div>
      </section>

      {searchResults.length > 0 ? (
        <div className="mb-5 rounded-xl border border-border/80 bg-card p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Support search results</p>
          <div className="space-y-1">
            {searchResults.map((o) => (
              <button
                key={`s-${o.id}`}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-muted/50"
                onClick={() => {
                  setSelected(o);
                  void loadOrderDetails(o.id);
                }}
              >
                <span className="text-xs font-semibold">
                  {o.id.slice(0, 8).toUpperCase()} • {o.customer?.name || 'Guest'}
                </span>
                <span className="text-xs text-muted-foreground">{o.status}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <DataPanel className="border-0 bg-transparent p-0 shadow-none hover:shadow-none">
        {boardView === 'order' ? (
          <section className="mb-5 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pipeline overview
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {scopedOrders.length} order{scopedOrders.length === 1 ? '' : 's'} on board date
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                size="sm"
                label="Placed"
                value={scopedOrders.filter((o) => o.status === 'placed').length}
                icon={ClipboardList}
                accent="#f97316"
              />
              <MetricCard
                size="sm"
                label="Kitchen flow"
                value={scopedOrders.filter((o) => ['paid', 'in_kitchen', 'ready'].includes(o.status)).length}
                icon={ChefHat}
                accent="#eab308"
              />
              <MetricCard
                size="sm"
                label="Delivery flow"
                value={scopedOrders.filter((o) => o.status === 'in_transit').length}
                icon={Truck}
                accent="#06b6d4"
              />
              <MetricCard
                size="sm"
                label="Completed"
                value={scopedOrders.filter((o) => terminalOrderStatuses.includes(o.status)).length}
                icon={CheckCircle2}
                accent="#22c55e"
              />
            </div>
            <div className="mt-5 border-t border-border/70 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attention (open tickets)
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  size="sm"
                  label="Overdue"
                  value={overdueSlaCount}
                  icon={AlertTriangle}
                  accent="#ef4444"
                  className="border-red-100 bg-red-50/80 dark:bg-red-950/25"
                />
                <MetricCard
                  size="sm"
                  label="Due soon"
                  value={dueSoonSlaCount}
                  icon={Clock}
                  accent="#d97706"
                  className="border-amber-100 bg-amber-50/80 dark:bg-amber-950/25"
                />
                <MetricCard
                  size="sm"
                  label="Scheduled hold"
                  value={scheduledHoldCount}
                  icon={CalendarClock}
                  accent="#ea580c"
                  className="border-orange-100 bg-orange-50/80 dark:bg-orange-950/25"
                />
                <MetricCard
                  size="sm"
                  label="Rush"
                  value={rushCount}
                  icon={Zap}
                  accent="#f43f5e"
                  className="border-rose-100 bg-rose-50/80 dark:bg-rose-950/25"
                />
              </div>
            </div>
          </section>
        ) : recon ? (
          <section className="mb-5 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Daily reconciliation
              </h2>
              <Input
                type="date"
                className="h-9 w-auto min-w-[10rem] text-xs"
                value={reconDate ?? ''}
                onChange={(e) => setReconDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                size="sm"
                label="Total orders"
                value={recon.totalOrders}
                icon={Hash}
                accent="#3b82f6"
              />
              <MetricCard
                size="sm"
                label="Completed"
                value={recon.completedPayments}
                icon={CheckCircle2}
                accent="#22c55e"
              />
              <MetricCard
                size="sm"
                label="Pending"
                value={recon.pendingPayments}
                icon={Hourglass}
                accent="#eab308"
              />
              <MetricCard
                size="sm"
                label="Failed"
                value={recon.failedPayments}
                icon={XCircle}
                accent="#ef4444"
              />
            </div>
          </section>
        ) : null}

        <div className="mb-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Filter
          </p>
          <div className="flex flex-wrap gap-2">
            {currentFilterOptions.map((filter) => {
              const count = scopedOrders.filter(filter.match).length;
              const active = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/90 bg-background text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
                  )}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}{' '}
                  <span className={cn('tabular-nums', active ? 'text-primary-foreground/90' : 'text-muted-foreground')}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedControl className="max-w-md">
            <SegmentedControlItem
              active={boardView === 'order'}
              onClick={() => startTransition(() => setBoardView('order'))}
            >
              Order flow
            </SegmentedControlItem>
            <SegmentedControlItem
              active={boardView === 'payment'}
              onClick={() => startTransition(() => setBoardView('payment'))}
            >
              Payment flow
            </SegmentedControlItem>
          </SegmentedControl>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-3 py-2">
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                queueLiveStatusClass(queueLiveStatus),
              )}
              title="Realtime queue stream status"
            >
              {queueLiveStatusLabel(queueLiveStatus)}
            </span>
            <div className="mx-1 hidden h-6 w-px shrink-0 bg-border/80 sm:block" aria-hidden />
            <label htmlFor="admin-board-date" className="sr-only">
              Board date
            </label>
            <Input
              id="admin-board-date"
              type="date"
              className="h-9 w-auto min-w-[10.5rem] shrink-0 text-xs"
              value={reconDate ?? ''}
              onChange={(e) => setReconDate(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-xs"
              onClick={() => setReconDate(businessToday ?? new Date().toISOString().slice(0, 10))}
              disabled={Boolean(reconDate && businessToday && reconDate === businessToday)}
            >
              Today
            </Button>
          </div>
        </div>

        {/* Both boards stay mounted; visibility toggles to avoid unmount/remount cost on tab switch. */}
        <div className={boardView === 'order' ? 'block' : 'hidden'} aria-hidden={boardView !== 'order'}>
          <OrderQueueBoard
            columns={orderBoardColumns.map((columnKey) => ({
              key: columnKey,
              title: orderBoardColumnTitle[columnKey],
              count: ordersForOrderColumn(columnKey).length,
              children: ordersForOrderColumn(columnKey)
                .map((o) => (
                  <QueueOrderCard
                    key={o.id}
                    order={o}
                    showPaymentActions={false}
                    onOpen={(id) => {
                      const target = filteredOrders.find((x) => x.id === id) ?? null;
                      if (!target) return;
                      setSelected(target);
                      void loadOrderDetails(id);
                    }}
                    onMove={(id, next) => void moveStatus(id, next)}
                  />
                )),
            }))}
          />
        </div>
        <div className={boardView === 'payment' ? 'block' : 'hidden'} aria-hidden={boardView !== 'payment'}>
          <OrderQueueBoard
            columns={[
              {
                key: 'pay-pending',
                title: 'Pending payment',
                count: filteredOrders.filter((o) => o.paymentStatus === 'pending').length,
                children: filteredOrders
                  .filter((o) => o.paymentStatus === 'pending')
                  .map((o) => (
                    <QueueOrderCard
                      key={o.id}
                      order={o}
                      showMoveAction={false}
                      onOpen={(id) => {
                        const target = filteredOrders.find((x) => x.id === id) ?? null;
                        if (!target) return;
                        setSelected(target);
                        void loadOrderDetails(id);
                      }}
                      onCollectCash={(id) => void markCashReceived(id)}
                      onCollectCard={(id) => void markCardReceived(id)}
                    />
                  )),
              },
              {
                key: 'pay-completed',
                title: 'Completed',
                count: filteredOrders.filter((o) => o.paymentStatus === 'completed').length,
                children: filteredOrders
                  .filter((o) => o.paymentStatus === 'completed')
                  .map((o) => (
                    <QueueOrderCard
                      key={o.id}
                      order={o}
                      showMoveAction={false}
                      showPaymentActions={false}
                      onOpen={(id) => {
                        const target = filteredOrders.find((x) => x.id === id) ?? null;
                        if (!target) return;
                        setSelected(target);
                        void loadOrderDetails(id);
                      }}
                    />
                  )),
              },
              {
                key: 'pay-failed',
                title: 'Failed',
                count: filteredOrders.filter((o) => o.paymentStatus === 'failed').length,
                children: filteredOrders
                  .filter((o) => o.paymentStatus === 'failed')
                  .map((o) => (
                    <QueueOrderCard
                      key={o.id}
                      order={o}
                      showMoveAction={false}
                      onOpen={(id) => {
                        const target = filteredOrders.find((x) => x.id === id) ?? null;
                        if (!target) return;
                        setSelected(target);
                        void loadOrderDetails(id);
                      }}
                      onCollectCash={(id) => void markCashReceived(id)}
                      onCollectCard={(id) => void markCardReceived(id)}
                    />
                  )),
              },
              {
                key: 'pay-refunded',
                title: 'Refunded',
                count: filteredOrders.filter((o) => o.paymentStatus === 'refunded').length,
                children: filteredOrders
                  .filter((o) => o.paymentStatus === 'refunded')
                  .map((o) => (
                    <QueueOrderCard
                      key={o.id}
                      order={o}
                      showMoveAction={false}
                      showPaymentActions={false}
                      onOpen={(id) => {
                        const target = filteredOrders.find((x) => x.id === id) ?? null;
                        if (!target) return;
                        setSelected(target);
                        void loadOrderDetails(id);
                      }}
                    />
                  )),
              },
            ]}
          />
        </div>
      </DataPanel>
      <Dialog open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
        <DialogContent showCloseButton className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Queue diagnostics</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-1 font-semibold ${queueLiveStatusClass(queueLiveStatus)}`}
              >
                {queueLiveStatusLabel(queueLiveStatus)}
              </span>
              <span className="text-muted-foreground">
                Last pulled: {diagFetchedAt ? new Date(diagFetchedAt).toLocaleTimeString() : 'not yet'}
              </span>
              <button
                type="button"
                className="rounded border px-2 py-1 font-semibold"
                onClick={() => void loadDiagnostics()}
                disabled={diagLoading}
              >
                {diagLoading ? 'Refreshing...' : 'Refresh diagnostics'}
              </button>
            </div>
            {diagError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {diagError}
              </div>
            ) : null}
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Queue infra health</p>
              {diagHealth ? (
                <div className="space-y-2 text-xs">
                  <p>
                    enabled: <strong>{String(diagHealth.enabled)}</strong> | prefix:{' '}
                    <strong>{diagHealth.prefix || '-'}</strong>
                  </p>
                  {diagHealth.queues.map((q) => (
                    <div key={q.name} className="rounded border px-2 py-1.5">
                      <p className="font-semibold">
                        {q.name} - {q.ready ? 'ready' : `not ready (${q.reason ?? 'unknown'})`}
                      </p>
                      {q.counts ? (
                        <p className="text-muted-foreground">
                          waiting {q.counts.waiting ?? 0}, active {q.counts.active ?? 0}, completed{' '}
                          {q.counts.completed ?? 0}, failed {q.counts.failed ?? 0}, delayed{' '}
                          {q.counts.delayed ?? 0}
                        </p>
                      ) : null}
                      {q.error ? <p className="text-red-600">{q.error}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No health payload yet.</p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Recent system activity (order pipeline)
              </p>
              {diagEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events available.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-auto text-xs">
                  {diagEvents.slice(0, 30).map((ev) => (
                    <p key={ev.id} className="text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleTimeString()} - {ev.summary || ev.eventType} -{' '}
                      {ev.eventType}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <OrderDetailsModal
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            clearOpenOrderParam();
          }
        }}
        order={selected}
        details={selectedDetails}
        paymentEvents={paymentEvents}
        loading={detailsLoading}
        onEditCustomer={() => {
          if (!selected) return;
          setEditMode('customer');
          setEditCustomerName(selected.customer?.name || '');
          setEditCustomerPhone(selected.customer?.phone || '');
          setEditOpen(true);
        }}
        onEditFulfillment={() => {
          if (!selected) return;
          setEditMode('fulfillment');
          setEditDeliveryAddress(selected.deliveryAddress || '');
          setEditTableNumber(selected.tableNumber || '');
          setEditOpen(true);
        }}
      />
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          showCloseButton
          className="z-[2320] gap-0 overflow-hidden border-0 p-0 sm:max-w-md"
        >
          <div className="border-b border-border px-6 pb-4 pt-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>
                {editMode === 'customer' ? 'Edit customer details' : 'Edit fulfillment details'}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {editMode === 'customer'
                  ? 'Updates name and phone on this order.'
                  : 'Updates delivery address and table for this order.'}
              </p>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 pb-2 pt-4">
            {editMode === 'customer' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-customer-name" className="text-xs">
                    Customer name
                  </Label>
                  <Input
                    id="edit-customer-name"
                    className="h-10"
                    autoComplete="name"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-customer-phone" className="text-xs">
                    Phone
                  </Label>
                  <Input
                    id="edit-customer-phone"
                    className="h-10"
                    inputMode="tel"
                    autoComplete="tel"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-delivery-address" className="text-xs">
                    Delivery address
                  </Label>
                  <Input
                    id="edit-delivery-address"
                    className="h-10"
                    value={editDeliveryAddress}
                    onChange={(e) => setEditDeliveryAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-table-number" className="text-xs">
                    Table number
                  </Label>
                  <Input
                    id="edit-table-number"
                    className="h-10"
                    value={editTableNumber}
                    onChange={(e) => setEditTableNumber(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 border-t border-border px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" className="h-10" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 min-w-[8rem]"
              onClick={async () => {
                if (!selected) return;
                const saveRes = await api.patch(`/orders/${selected.id}/support`, {
                  customerName: editMode === 'customer' ? editCustomerName : undefined,
                  customerPhone: editMode === 'customer' ? editCustomerPhone : undefined,
                  deliveryAddress: editMode === 'fulfillment' ? editDeliveryAddress : undefined,
                  tableNumber: editMode === 'fulfillment' ? editTableNumber : undefined,
                  note: `Updated from admin support console (${editMode})`,
                });
                patchOrderRowsFromApi(selected.id, saveRes.data);
                setEditOpen(false);
                void loadOrderDetails(selected.id);
                void refreshQueueAfterMutation({ withRecon: false });
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </PageStack>
      </div>
    </div>
  );
}
