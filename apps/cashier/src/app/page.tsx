'use client';

import { useEffect, useMemo, useRef, startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePosStore } from '../store/usePosStore';
import {
  Wifi,
  WifiOff,
  ShoppingCart,
  Trash2,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  Info,
  Leaf,
  Flame,
  Milk,
  Dumbbell,
  Wheat,
  Coffee,
  LogOut,
  ListTodo,
  CheckCircle2,
  Hash,
  Hourglass,
  XCircle,
} from 'lucide-react';
import {
  Button,
  ClientDirectory,
  type ClientDirectoryRow as SharedClientDirectoryRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  MetricCard,
  OrderQueueBoard,
  OpsHeader,
  OpsLayout,
  ProductPickTile,
  QueueOrderCard,
  StatusPill,
  useClientDirectoryCatalog,
} from '@wrap-roll/shared-ui';
import type {
  CashierPaymentCollection,
  CashierPaymentMethod,
  PublicBusinessSettings,
  OpsQueueOrder,
  QueueOrder,
  QueueOrderStatus,
  SupportOrderDetails,
} from '@wrap-roll/contracts';
import {
  CASHIER_RESOLVE_ORDER_QUERY,
  formatPaymentCollectionLabel,
  ORDER_FLOW_BOARD_STATUSES,
  mergeQueueOrderFromApiPatch,
} from '@wrap-roll/contracts';
import {
  getOrderItemModifierDisplayLines,
  isModifierLinePriority,
  useQueueDirtyStream,
} from '@wrap-roll/order-kit';
import { syncOrders, initSyncDB, clearQueuedOrders } from '../lib/sync-queue';
import { CashierAuthService } from '../lib/auth';
import {
  isPhoneIntakeValid,
  MAX_PHONE_DIGITS,
  MIN_PHONE_DIGITS,
  normalizeCashierPhone,
  phoneDigits,
} from '../lib/phone';
import { toast } from 'sonner';

type ProductRow = {
  id: string;
  name: string;
  price: number;
  category: string;
  prepTimeMinutes?: number;
  modifierGroups?: Array<{
    groupId: string;
    name: string;
    type: 'single' | 'multi';
    required?: boolean;
    options: Array<{
      optionId: string;
      label: string;
      priceAdjust?: number;
      isDefault?: boolean;
    }>;
  }>;
};

type ReconciliationSummary = {
  date: string;
  totalOrders: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  byMethod: Array<{
    method: string;
    orderCount: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    completedTotal: number;
  }>;
};

type ProductInfo = {
  itemId: string;
  name: string;
  categoryName: string;
  prepTimeMinutes: number;
  categoryAveragePrepTimeMinutes: number;
  ingredientHighlights: string[];
  healthTips: string[];
  nutritionTags: Array<{ key: string; label: string }>;
  modifierIngredientImpacts?: Array<{
    optionLabel: string;
    ingredients: string[];
  }>;
};

type IntakeLookupResponse = {
  found: boolean;
  customer?: { id: string; name: string; phone?: string | null; type: 'guest' | 'client' };
  suggestedAddress?: string | null;
  inferredAddress?: string | null;
};

type CustomerDirectoryRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  supabaseUserId: string | null;
  orderCount: number;
  defaultAddress: string | null;
  latestOrderPlacedAt: string | null;
};

/** Matches `GET /api/orders/delivery-quote` — POS delivery cart preview. */
type PosDeliveryQuote = {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  feeMode: 'flat' | 'distance';
  distanceKm: number | null;
  message?: string;
  code?: string;
};

/** Single “do this first” line per order for the Ops attention lane (lowest score = show first). */
type CashierAttentionItem = {
  order: OpsQueueOrder;
  score: number;
  headline: string;
  detail: string;
};

/**
 * “Out for delivery” monitoring rows (score 58) can flood the hub during peak hours.
 * Urgent in-transit work (e.g. cash to collect, score 28) is never capped.
 */
const NEXT_UP_MAX_DELIVERY_STATUS_ROWS = 15;

function classifyCashierAttention(order: OpsQueueOrder): CashierAttentionItem | null {
  const terminal = ['cancelled', 'voided', 'refunded'].includes(order.status);
  if (terminal) return null;
  if (order.status === 'delivered' && order.paymentStatus === 'completed') return null;

  const now = Date.now();
  const pastPromised =
    !!order.estimatedReadyTime &&
    new Date(String(order.estimatedReadyTime)).getTime() < now &&
    !['delivered', 'cancelled', 'voided', 'refunded'].includes(order.status);

  type Rule = { score: number; headline: string; detail: string };
  const rules: Rule[] = [];

  if (order.paymentStatus === 'failed') {
    rules.push({
      score: 10,
      headline: 'Payment failed',
      detail: 'Sort out with the customer — retry, switch method, or collect at the counter.',
    });
  }
  if (pastPromised) {
    rules.push({
      score: 18,
      headline: 'Past promised time',
      detail: 'Someone may be waiting — check the line or reset expectations with the guest.',
    });
  }
  if (
    order.slaBucket === 'overdue' &&
    ['placed', 'paid', 'in_kitchen', 'ready'].includes(order.status)
  ) {
    rules.push({
      score: 22,
      headline: 'Prep timeline overdue',
      detail: 'Escalate with kitchen or update the customer on wait time.',
    });
  }
  if (
    order.paymentMethod === 'cash' &&
    order.paymentStatus !== 'completed' &&
    ['ready', 'delivered', 'in_transit'].includes(order.status)
  ) {
    rules.push({
      score: 28,
      headline: 'Collect cash',
      detail: 'Cash still owed — take payment at or right before handoff.',
    });
  }
  if (
    order.paymentMethod === 'cash' &&
    order.paymentStatus === 'pending' &&
    ['placed', 'paid', 'in_kitchen'].includes(order.status)
  ) {
    rules.push({
      score: 32,
      headline: 'Take cash payment',
      detail: 'Payment not marked yet — collect when the guest pays at the POS.',
    });
  }
  if (order.status === 'delivered' && order.paymentStatus !== 'completed' && order.paymentMethod !== 'cash') {
    rules.push({
      score: 34,
      headline: 'Payment still open',
      detail: 'Delivery is done but payment is not completed — follow up.',
    });
  }
  if (order.status === 'ready') {
    rules.push({
      score: 40,
      headline:
        order.fulfillmentType === 'delivery' ? 'Ready — pack / hand off' : 'Ready — customer pickup',
      detail:
        order.fulfillmentType === 'delivery'
          ? 'Food is ready for driver or customer.'
          : 'Tell the guest their order is ready at the counter.',
    });
  }
  if (
    order.paymentStatus === 'pending' &&
    ['card', 'payhere', 'online'].includes(order.paymentMethod)
  ) {
    rules.push({
      score: 44,
      headline: 'Payment pending',
      detail: 'Card or online charge not completed — check terminal or payment status.',
    });
  }
  if (order.kitchenPriority === 'rush' && ['placed', 'paid', 'in_kitchen'].includes(order.status)) {
    rules.push({
      score: 48,
      headline: 'Rush order',
      detail: 'Marked urgent — align with the kitchen so it does not slip.',
    });
  }
  if (order.slaBucket === 'due_soon' && order.status === 'in_kitchen') {
    rules.push({
      score: 52,
      headline: 'Due out soon',
      detail: 'Watch the clock so the guest is not kept waiting.',
    });
  }
  if (order.status === 'in_transit') {
    rules.push({
      score: 58,
      headline: 'Out for delivery',
      detail: 'For phone or counter questions: order is on the way.',
    });
  }

  if (rules.length === 0) return null;
  rules.sort((a, b) => a.score - b.score);
  const best = rules[0];
  return { order, score: best.score, headline: best.headline, detail: best.detail };
}

function attentionUrgencyFrameClass(score: number): string {
  if (score <= 22) return 'border-red-200 bg-red-50/90';
  if (score <= 40) return 'border-amber-200 bg-amber-50/90';
  return 'border-sky-200 bg-sky-50/80';
}

type QueueLiveStatus = 'disabled' | 'connecting' | 'connected' | 'reconnecting';

function queueLiveStatusLabel(status: QueueLiveStatus): string {
  if (status === 'connected') return 'Queue live connected';
  if (status === 'reconnecting') return 'Queue live reconnecting';
  if (status === 'connecting') return 'Queue live connecting';
  return 'Queue live disabled';
}

function queueLiveStatusClass(status: QueueLiveStatus): string {
  if (status === 'connected') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'reconnecting') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'connecting') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-neutral-200 bg-neutral-50 text-neutral-600';
}

export default function Index() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queueLiveStatus, setQueueLiveStatus] = useState<QueueLiveStatus>('connecting');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<ProductInfo | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [productToCustomize, setProductToCustomize] = useState<ProductRow | null>(null);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [itemNotes, setItemNotes] = useState('');
  const [customizeTab, setCustomizeTab] = useState<'options' | 'notes'>('options');
  const [customizeImpactLoading, setCustomizeImpactLoading] = useState(false);
  const [customizeOptionImpacts, setCustomizeOptionImpacts] = useState<
    Record<string, string[]>
  >({});
  const [paymentMethod, setPaymentMethod] = useState<CashierPaymentMethod>('CASH');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false);
  const [paymentSettingsLoaded, setPaymentSettingsLoaded] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderIntake, setOrderIntake] = useState<'counter' | 'phone'>('counter');
  const [fulfillmentType, setFulfillmentType] = useState<'takeaway' | 'dine_in' | 'delivery'>(
    'takeaway',
  );
  const [tableNumber, setTableNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerLookupMeta, setCustomerLookupMeta] = useState<string | null>(null);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | string>('ALL');
  const [authChecking, setAuthChecking] = useState(true);
  const [cashierProfile, setCashierProfile] = useState<{
    email: string | null;
    role: string;
  } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [queueOrders, setQueueOrders] = useState<OpsQueueOrder[]>([]);
  const [supportQuery, setSupportQuery] = useState('');
  const [supportResults, setSupportResults] = useState<OpsQueueOrder[]>([]);
  const [supportListFilter, setSupportListFilter] = useState<'all' | 'dine_in_needs_table'>('all');
  const [customerDirectoryQuery, setCustomerDirectoryQuery] = useState('');
  const [customerDirectoryRows, setCustomerDirectoryRows] = useState<CustomerDirectoryRow[]>([]);
  const [customerDirectoryLoading, setCustomerDirectoryLoading] = useState(false);
  const [customerDirectoryError, setCustomerDirectoryError] = useState<string | null>(null);
  const [customerDirectoryLetter, setCustomerDirectoryLetter] = useState<string>('ALL');
  const [customerDirectoryType, setCustomerDirectoryType] = useState<'all' | 'client' | 'guest'>('all');
  const [pinnedDirectoryIds, setPinnedDirectoryIds] = useState<string[]>([]);
  const [supportEditOpen, setSupportEditOpen] = useState(false);
  const [supportEditOrder, setSupportEditOrder] = useState<OpsQueueOrder | null>(null);
  const [supportEditName, setSupportEditName] = useState('');
  const [supportEditPhone, setSupportEditPhone] = useState('');
  const [supportEditAddress, setSupportEditAddress] = useState('');
  const [supportEditTable, setSupportEditTable] = useState('');
  const [supportEditSchedule, setSupportEditSchedule] = useState('');
  const [supportSaving, setSupportSaving] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [selectedSupportOrder, setSelectedSupportOrder] = useState<SupportOrderDetails | null>(null);
  const [supportDetailsLoading, setSupportDetailsLoading] = useState(false);
  const [supportViewOpen, setSupportViewOpen] = useState(false);
  const [supportViewTab, setSupportViewTab] = useState<'summary' | 'items' | 'totals'>('summary');
  const [counterTableDraft, setCounterTableDraft] = useState('');
  const [counterTableSaving, setCounterTableSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'pos' | 'ops' | 'clients'>('pos');
  const [reconDate, setReconDate] = useState<string | null>(null);
  const [businessToday, setBusinessToday] = useState<string | null>(null);
  const [reconSummary, setReconSummary] = useState<ReconciliationSummary | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [opsBoardView, setOpsBoardView] = useState<'attention' | 'order' | 'payment'>('attention');
  const [cashCollectLoading, setCashCollectLoading] = useState<Record<string, boolean>>({});
  const [posDeliveryQuote, setPosDeliveryQuote] = useState<PosDeliveryQuote | null>(null);
  const [posDeliveryQuoteLoading, setPosDeliveryQuoteLoading] = useState(false);
  const queueRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const queueRefreshPendingRef = useRef(false);
  const cashierResolveConsumedRef = useRef(false);
  const { cart, addItem, incrementItem, decrementItem, removeItem, pay, clearCart } =
    usePosStore();

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await CashierAuthService.signOut();
      toast.success('Signed out');
    } catch {
      toast.error('Could not reach server; clearing this device session.');
    } finally {
      clearCart();
      setCashierProfile(null);
      router.replace('/auth/signin');
      setSigningOut(false);
    }
  };

  const fetchProtectedNest = async (
    url: string,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      let res = await fetch(url, init);
      if (res.status !== 401) return res;
      await CashierAuthService.getSession();
      res = await fetch(url, init);
      return res;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reach cashier API';
      return new Response(
        JSON.stringify({
          error: 'Cashier API request failed',
          detail: message,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };

  const tagIcon = (key: string) => {
    switch (key) {
      case 'protein':
        return Dumbbell;
      case 'fresh':
        return Leaf;
      case 'spicy':
        return Flame;
      case 'dairy':
        return Milk;
      case 'fiber':
        return Wheat;
      case 'caffeine':
        return Coffee;
      default:
        return Info;
    }
  };

  const updatePendingCount = async () => {
    const db = await initSyncDB();
    const count = await db.count('order-sync-queue');
    setPendingSyncCount(count);
  };

  /** Loads today’s queue; CASHIER receives full `OpsQueueOrder` rows from the API. */
  const runQueueRefresh = async () => {
    if (!reconDate) return;
    const next = await fetchProtectedNest(
      `/api/nest/orders/queue?status=placed,paid,in_kitchen,ready,in_transit,delivered,cancelled,voided,refunded&date=${encodeURIComponent(reconDate)}`,
      { cache: 'no-store' },
    );
    if (!next.ok) return;
    const data = await next.json();
    if (!Array.isArray(data)) return;
    setQueueOrders(
      data.map((o: any) => ({
        id: String(o.id),
        status: String(o.status ?? '') as OpsQueueOrder['status'],
        source: String(o.source ?? '') as OpsQueueOrder['source'],
        fulfillmentType: o.fulfillmentType
          ? (String(o.fulfillmentType) as OpsQueueOrder['fulfillmentType'])
          : undefined,
        estimatedReadyTime: o.estimatedReadyTime ? String(o.estimatedReadyTime) : null,
        placedAt: o.placedAt ? String(o.placedAt) : null,
        customer: o.customer
          ? {
              id: o.customer.id ? String(o.customer.id) : undefined,
              name: o.customer.name ? String(o.customer.name) : undefined,
              phone: o.customer.phone ? String(o.customer.phone) : undefined,
            }
          : null,
        customerName: o.customer?.name ? String(o.customer.name) : null,
        total: Number(o.total ?? 0),
        itemCount: Number(o.itemCount ?? 0),
        items: Array.isArray(o.items)
          ? o.items.map((item: any) => ({
              name: String(item?.name ?? ''),
              quantity: Number(item?.quantity ?? 0),
            }))
          : [],
        paymentStatus: String(o.paymentStatus ?? '') as OpsQueueOrder['paymentStatus'],
        paymentMethod: String(o.paymentMethod ?? '') as OpsQueueOrder['paymentMethod'],
        paymentCollection: o.paymentCollection
          ? (String(o.paymentCollection) as OpsQueueOrder['paymentCollection'])
          : undefined,
        paymentRisk: o.paymentRisk,
        allowedNextStatuses: Array.isArray(o.allowedNextStatuses)
          ? (o.allowedNextStatuses as OpsQueueOrder['allowedNextStatuses'])
          : [],
        actions:
          o.actions && typeof o.actions === 'object'
            ? {
                canMove: Boolean(o.actions.canMove),
                canAssignCourier: Boolean(o.actions.canAssignCourier),
                canCollectPayment: Boolean(o.actions.canCollectPayment),
                canMarkDelivered: Boolean(o.actions.canMarkDelivered),
                canVoid: Boolean(o.actions.canVoid),
                canRefund: Boolean(o.actions.canRefund),
              }
            : undefined,
        blockedReasonsByStatus:
          o.blockedReasonsByStatus && typeof o.blockedReasonsByStatus === 'object'
            ? (o.blockedReasonsByStatus as OpsQueueOrder['blockedReasonsByStatus'])
            : undefined,
        staffScheduleOverride: Boolean(o.staffScheduleOverride),
      })),
    );
  };

  const refreshQueueOrders = async () => {
    if (queueRefreshInFlightRef.current) {
      queueRefreshPendingRef.current = true;
      return queueRefreshInFlightRef.current;
    }
    const run = async () => {
      await runQueueRefresh();
      while (queueRefreshPendingRef.current) {
        queueRefreshPendingRef.current = false;
        await runQueueRefresh();
      }
    };
    queueRefreshInFlightRef.current = run().finally(() => {
      queueRefreshInFlightRef.current = null;
    });
    return queueRefreshInFlightRef.current;
  };

  const loadReconciliation = async (opts?: { silent?: boolean }) => {
    if (!reconDate) return;
    const silent = opts?.silent ?? false;
    if (!silent) setReconLoading(true);
    try {
      const res = await fetchProtectedNest(
        `/api/nest/orders/reconciliation/summary?date=${encodeURIComponent(reconDate)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setReconSummary(null);
        return;
      }
      const data = (await res.json()) as ReconciliationSummary;
      setReconSummary(data);
    } finally {
      if (!silent) setReconLoading(false);
    }
  };

  /**
   * Queue + optional recon. Status moves skip recon (faster); payment actions refresh totals.
   * Background refresh — do not await from click handlers so the UI returns right after PATCH.
   */
  const refreshOpsQueueAfterAction = async (opts?: { withRecon?: boolean }) => {
    const withRecon = opts?.withRecon ?? true;
    if (!reconDate) {
      await refreshQueueOrders();
      return;
    }
    if (withRecon) {
      await Promise.all([
        refreshQueueOrders(),
        loadReconciliation({ silent: true }),
      ]);
    } else {
      await refreshQueueOrders();
    }
  };

  /** Phase 2: merge PATCH body onto queue + support search rows immediately. */
  const patchQueueOrderRowsFromApi = (orderId: string, apiBody: unknown) => {
    const apply = (row: OpsQueueOrder) =>
      mergeQueueOrderFromApiPatch(row as QueueOrder, apiBody) as OpsQueueOrder;
    setQueueOrders((prev) => prev.map((o) => (o.id === orderId ? apply(o) : o)));
    setSupportResults((prev) => prev.map((o) => (o.id === orderId ? apply(o) : o)));
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
    enabled:
      activeTab === 'ops' &&
      Boolean(reconDate) &&
      Boolean(cashierProfile) &&
      !authChecking,
    apiBaseUrl: queueStreamApiBase,
    getAccessToken: async () => {
      const { session } = await CashierAuthService.getSession();
      const token = session?.accessToken;
      return typeof token === 'string' && token.length > 0 ? token : null;
    },
    onDirty: () => void refreshQueueOrders(),
    onStatusChange: setQueueLiveStatus,
  });

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      const { session, role } = await CashierAuthService.getSession();
      if (!session || (role !== 'CASHIER' && role !== 'ADMIN')) {
        const path =
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '/';
        router.replace(`/auth/signin?returnTo=${encodeURIComponent(path || '/')}`);
        return;
      }
      if (mounted) {
        setCashierProfile({
          email: session.user.email ?? null,
          role,
        });
        setAuthChecking(false);
      }
    };
    verify();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('cashier-client-directory-pins');
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        setPinnedDirectoryIds(parsed.filter((v): v is string => typeof v === 'string'));
      }
    } catch {
      setPinnedDirectoryIds([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('cashier-client-directory-pins', JSON.stringify(pinnedDirectoryIds));
    } catch {
      // ignore local storage write failures
    }
  }, [pinnedDirectoryIds]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOrders().then(updatePendingCount);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();
    if (navigator.onLine) {
      syncOrders().then(updatePendingCount);
    }

    const pollInterval = setInterval(() => {
      if (navigator.onLine) {
        void syncOrders().then(updatePendingCount);
      } else {
        void updatePendingCount();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    const onDup = (e: Event) => {
      const ce = e as CustomEvent<{ duplicateOf?: string }>;
      const id = ce.detail?.duplicateOf;
      toast.error(
        id
          ? `Similar order already exists (${String(id).slice(0, 8).toUpperCase()}). Removed from sync queue.`
          : 'Similar order may already exist. Removed from sync queue.',
      );
    };
    window.addEventListener('cashier-order-duplicate', onDup);
    return () => window.removeEventListener('cashier-order-duplicate', onDup);
  }, []);

  useEffect(() => {
    const onQueued = () => {
      toast.info('Order queued locally. Syncing with server...');
      setSyncFeedback({
        type: 'info',
        message: 'Order queued locally. Syncing...',
      });
      void updatePendingCount();
    };
    const onSynced = () => {
      toast.success('Order synced successfully.');
      setSyncFeedback({
        type: 'success',
        message: 'Order synced successfully.',
      });
      setTimeout(() => {
        setSyncFeedback((current) => (current?.type === 'success' ? null : current));
      }, 3000);
      void updatePendingCount();
      if (activeTab === 'ops') {
        void refreshOpsQueueAfterAction({ withRecon: true });
      }
    };
    const onSyncFailed = (e: Event) => {
      const ce = e as CustomEvent<{ status?: number; reason?: string }>;
      const status = Number(ce.detail?.status ?? 0);
      const reason = String(ce.detail?.reason ?? 'Unknown sync failure');
      toast.error(
        status > 0
          ? `Order sync failed (${status}): ${reason}`
          : `Order sync failed: ${reason}`,
      );
      setSyncFeedback({
        type: 'error',
        message:
          status === 401
            ? 'Sync failed: session expired. Please sign in again.'
            : status > 0
              ? `Sync failed (${status}): ${reason}`
              : `Sync failed: ${reason}`,
      });
      void updatePendingCount();
    };
    window.addEventListener('cashier-order-queued', onQueued);
    window.addEventListener('cashier-order-synced', onSynced);
    window.addEventListener('cashier-order-sync-failed', onSyncFailed);
    return () => {
      window.removeEventListener('cashier-order-queued', onQueued);
      window.removeEventListener('cashier-order-synced', onSynced);
      window.removeEventListener('cashier-order-sync-failed', onSyncFailed);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'ops' || !reconDate) return;
    void Promise.all([
      refreshQueueOrders(),
      loadReconciliation({ silent: false }),
    ]);
    const interval = setInterval(() => {
      void refreshQueueOrders();
    }, 90_000);
    return () => clearInterval(interval);
  }, [activeTab, reconDate]);

  useEffect(() => {
    if (activeTab !== 'ops' || !reconDate) return;
    if (queueLiveStatus === 'connected') return;
    // Fallback polling keeps ops board updating when SSE is reconnecting.
    const interval = setInterval(() => {
      void refreshQueueOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, reconDate, queueLiveStatus]);

  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const res = await fetch('/api/nest/menu?limit=100');
        if (!res.ok) throw new Error('Failed to load menu from API');
        const data = await res.json();
        const rows = Array.isArray(data?.items)
          ? data.items.map((item: any) => ({
              id: String(item.itemId ?? item.id),
              name: String(item.name),
              price: Number(item.basePrice),
              category: String(item.categoryName ?? item.category ?? 'Menu'),
              prepTimeMinutes: Number(item.prepTimeMinutes ?? 0),
              modifierGroups: Array.isArray(item.modifierGroups)
                ? item.modifierGroups
                : [],
            }))
          : [];
        setProducts(rows);
      } catch (err) {
        setProducts([]);
        setProductsError(err instanceof Error ? err.message : 'Failed to load menu');
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    const loadPaymentSettings = async () => {
      try {
        const res = await fetch('/api/nest/settings', { cache: 'no-store' });
        if (!res.ok) {
          const fallback = new Date().toISOString().slice(0, 10);
          setBusinessToday(fallback);
          setReconDate(fallback);
          setPaymentSettingsLoaded(true);
          return;
        }
        const data = (await res.json()) as PublicBusinessSettings & {
          paymentConfig?: { methods?: { card?: boolean } };
          paymentJson?: { methods?: { card?: boolean } };
        };
        const od = data?.operationalCalendarDate;
        if (typeof od === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(od)) {
          setBusinessToday(od);
          setReconDate(od);
        } else {
          const fallback = new Date().toISOString().slice(0, 10);
          setBusinessToday(fallback);
          setReconDate(fallback);
        }
        const cardEnabled =
          typeof data?.paymentConfig?.methods?.card === 'boolean'
            ? data.paymentConfig.methods.card
            : typeof data?.paymentJson?.methods?.card === 'boolean'
              ? data.paymentJson.methods.card
              : true;
        setCardPaymentsEnabled(cardEnabled);
      } catch {
        const fallback = new Date().toISOString().slice(0, 10);
        setBusinessToday(fallback);
        setReconDate(fallback);
      } finally {
        setPaymentSettingsLoaded(true);
      }
    };
    void loadPaymentSettings();
  }, []);

  useEffect(() => {
    if (!cardPaymentsEnabled && paymentMethod === 'CARD') {
      setPaymentMethod('CASH');
      toast.info('Card payments are disabled in settings. Switched to cash.');
    }
  }, [cardPaymentsEnabled, paymentMethod]);

  const openInfo = async (itemId: string) => {
    setInfoOpen(true);
    setInfoLoading(true);
    try {
      const res = await fetch(`/api/nest/menu/${itemId}/info`);
      if (!res.ok) throw new Error('info fetch failed');
      const data = (await res.json()) as ProductInfo;
      setSelectedInfo(data);
    } catch {
      setSelectedInfo(null);
    } finally {
      setInfoLoading(false);
    }
  };

  const subtotal = cart.reduce(
    (acc, item) => acc + item.unitPrice * item.quantity,
    0,
  );

  useEffect(() => {
    if (fulfillmentType !== 'delivery' || cart.length === 0 || !isOnline) {
      setPosDeliveryQuote(null);
      setPosDeliveryQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setPosDeliveryQuoteLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({
            address: deliveryAddress.trim(),
            subtotal: String(subtotal),
          });
          const res = await fetchProtectedNest(
            `/api/nest/orders/delivery-quote?${params.toString()}`,
            { cache: 'no-store' },
          );
          if (cancelled) return;
          if (!res.ok) {
            setPosDeliveryQuote(null);
            return;
          }
          const data = (await res.json()) as PosDeliveryQuote;
          if (!cancelled) setPosDeliveryQuote(data);
        } catch {
          if (!cancelled) setPosDeliveryQuote(null);
        } finally {
          if (!cancelled) setPosDeliveryQuoteLoading(false);
        }
      })();
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [fulfillmentType, deliveryAddress, subtotal, cart.length, isOnline]);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return products.filter((p) => {
      const categoryMatch = activeCategory === 'ALL' || p.category === activeCategory;
      const searchMatch =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return categoryMatch && searchMatch;
    });
  }, [products, activeCategory, menuSearch]);
  const groupedProducts = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const p of filteredProducts) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProducts]);
  const queueToday = useMemo(() => queueOrders, [queueOrders]);
  const queueBuckets = useMemo(() => {
    const completed = queueToday.filter((o) =>
      ['delivered', 'cancelled', 'voided', 'refunded'].includes(o.status),
    );
    const completedIds = new Set(completed.map((o) => o.id));
    const scheduled = queueToday.filter(
      (o) =>
        !!o.estimatedReadyTime &&
        !completedIds.has(o.id),
    );
    const scheduledIds = new Set(scheduled.map((o) => o.id));
    const ongoing = queueToday.filter(
      (o) =>
        ['placed', 'paid', 'in_kitchen', 'ready', 'in_transit'].includes(o.status) &&
        !scheduledIds.has(o.id) &&
        !completedIds.has(o.id),
    );
    return { ongoing, scheduled, completed };
  }, [queueToday]);
  const queueStats = useMemo(() => {
    const walkin = queueBuckets.ongoing.filter(
      (o) => o.source === 'cashier_pos' || o.source === 'cashier_pos_offline',
    );
    return {
      total: queueToday.length,
      ongoing: queueBuckets.ongoing.length,
      scheduled: queueBuckets.scheduled.length,
      completed: queueBuckets.completed.length,
      walkin: walkin.length,
    };
  }, [queueToday, queueBuckets]);
  const queueBoardOrders = useMemo(
    () =>
      [...queueToday].sort((a, b) => {
        const aScheduled = a.estimatedReadyTime ? 1 : 0;
        const bScheduled = b.estimatedReadyTime ? 1 : 0;
        if (aScheduled !== bScheduled) return bScheduled - aScheduled;
        return String(a.status).localeCompare(String(b.status));
      }),
    [queueToday],
  );
  const supportResultsForList = useMemo(() => {
    if (supportListFilter !== 'dine_in_needs_table') return supportResults;
    return supportResults.filter(
      (o) => o.fulfillmentType === 'dine_in' && !(o.tableNumber?.trim()),
    );
  }, [supportResults, supportListFilter]);
  /** Prioritized “do this next” list — fewer simultaneous decisions than scanning every column. */
  const cashierAttentionDisplay = useMemo(() => {
    const rows: CashierAttentionItem[] = [];
    for (const o of queueBoardOrders) {
      const a = classifyCashierAttention(o);
      if (a) rows.push(a);
    }
    rows.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const ta = a.order.placedAt ? new Date(String(a.order.placedAt)).getTime() : 0;
      const tb = b.order.placedAt ? new Date(String(b.order.placedAt)).getTime() : 0;
      return ta - tb;
    });

    const isDeliveryStatusOnly = (r: CashierAttentionItem) =>
      r.order.status === 'in_transit' && r.score === 58;

    const priorityRows = rows.filter((r) => !isDeliveryStatusOnly(r));
    const deliveryStatusRows = rows.filter(isDeliveryStatusOnly);
    const shownDeliveryStatus = deliveryStatusRows.slice(0, NEXT_UP_MAX_DELIVERY_STATUS_ROWS);
    const hiddenDeliveryStatusCount = Math.max(
      0,
      deliveryStatusRows.length - shownDeliveryStatus.length,
    );

    const merged = [...priorityRows, ...shownDeliveryStatus];
    merged.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const ta = a.order.placedAt ? new Date(String(a.order.placedAt)).getTime() : 0;
      const tb = b.order.placedAt ? new Date(String(b.order.placedAt)).getTime() : 0;
      return ta - tb;
    });

    return {
      items: merged,
      /** “Out for delivery” lines not shown so the list stays scannable. */
      hiddenDeliveryStatusCount,
    };
  }, [queueBoardOrders]);
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
      return queueBoardOrders.filter((o) => o.status === 'delivered' && o.paymentStatus === 'completed');
    }
    if (key === 'delivered_unpaid') {
      return queueBoardOrders.filter((o) => o.status === 'delivered' && o.paymentStatus !== 'completed');
    }
    return queueBoardOrders.filter((o) => o.status === key);
  };
  const queueExceptions = useMemo(() => {
    const now = Date.now();
    const pendingCash = queueToday.filter(
      (o) => o.paymentMethod === 'cash' && o.paymentStatus !== 'completed',
    ).length;
    const failedPayment = queueToday.filter((o) => o.paymentStatus === 'failed').length;
    const scheduledOverdue = queueToday.filter(
      (o) =>
        !!o.estimatedReadyTime &&
        new Date(String(o.estimatedReadyTime)).getTime() < now &&
        !['delivered', 'cancelled', 'voided', 'refunded'].includes(o.status),
    ).length;
    return { pendingCash, failedPayment, scheduledOverdue };
  }, [queueToday]);
  const summarizeOrderRecipes = (order: OpsQueueOrder) => {
    const items = (order.items ?? []).filter((i) => String(i.name).trim().length > 0);
    if (items.length === 0) return `${Number(order.itemCount ?? 0)} recipes`;
    const top = items.slice(0, 2).map((item) => `${item.quantity}x ${item.name}`);
    const remaining = items.length - top.length;
    return remaining > 0 ? `${top.join(', ')} +${remaining} more` : top.join(', ');
  };
  const orderLifecycleLabel = (status: string) =>
    ['delivered', 'cancelled', 'voided', 'refunded'].includes(status)
      ? 'completed'
      : 'active';

  const collectCashFromQueue = async (orderId: string) => {
    if (cashCollectLoading[orderId]) return;
    setCashCollectLoading((p) => ({ ...p, [orderId]: true }));
    try {
      const res = await fetchProtectedNest(`/api/nest/orders/${orderId}/mark-payment-received`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'cash', note: 'Collected at cashier handoff' }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
        toast.error(
          String(
            err?.message ??
              (typeof err?.detail === 'string' ? err.detail : null) ??
              'Could not record cash collection',
          ),
        );
        return;
      }
      const data = (await res.json()) as { collectionApplied?: boolean; order?: unknown };
      if (data?.collectionApplied === false) {
        toast.info('Cash was already marked collected for this order.');
        void refreshOpsQueueAfterAction({ withRecon: true });
      } else {
        toast.success('Cash collected.');
        patchQueueOrderRowsFromApi(orderId, data);
        void refreshOpsQueueAfterAction({ withRecon: true });
      }
    } finally {
      setCashCollectLoading((p) => {
        const next = { ...p };
        delete next[orderId];
        return next;
      });
    }
  };

  const collectCardFromQueue = async (orderId: string) => {
    const res = await fetchProtectedNest(`/api/nest/orders/${orderId}/mark-payment-received`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'card', note: 'Collected via card at cashier handoff' }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
      toast.error(String(err?.message ?? err?.detail ?? 'Could not record card payment'));
      return;
    }
    const data = await res.json();
    toast.success('Card payment collected.');
    patchQueueOrderRowsFromApi(orderId, data);
    void refreshOpsQueueAfterAction({ withRecon: true });
  };

  /** Refresh support modal after counter payment collection */
  const collectAtCounterAndRefreshSupport = async (orderId: string, method: 'cash' | 'card') => {
    if (method === 'cash') {
      await collectCashFromQueue(orderId);
    } else {
      await collectCardFromQueue(orderId);
    }
    await openSupportOrder(orderId);
  };

  const moveQueueOrderStatus = async (orderId: string, nextStatus: QueueOrderStatus) => {
    const res = await fetchProtectedNest(`/api/nest/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
      toast.error(String(err?.message ?? err?.detail ?? `Cannot move to ${nextStatus}`));
      return;
    }
    const data = await res.json();
    toast.success(`Order moved to ${nextStatus.replaceAll('_', ' ')}`);
    patchQueueOrderRowsFromApi(orderId, data);
    void refreshOpsQueueAfterAction({ withRecon: false });
  };

  const downloadThermalReceipt = async (orderId: string) => {
    const res = await fetchProtectedNest(`/api/nest/print/receipt/${orderId}/regenerate`);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        detail?: string;
      };
      const msg = String(
        err?.message ?? err?.detail ?? err?.error ?? `HTTP ${res.status}`,
      );
      toast.error(
        res.status === 403
          ? `Print not allowed: ${msg}. Ask an admin to set your staff role (e.g. CASHIER) in Supabase.`
          : `Could not build thermal receipt: ${msg}`,
      );
      return;
    }
    const body = (await res.json()) as { payload?: string };
    if (!body?.payload) {
      toast.error('Empty receipt payload');
      return;
    }
    try {
      const binary = atob(body.payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${String(orderId).slice(0, 8)}.bin`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Thermal receipt file downloaded');
    } catch {
      toast.error('Could not download receipt file');
    }
  };

  const runSupportSearch = async () => {
    const q = supportQuery.trim();
    setSupportError(null);
    if (q.length < 2) {
      setSupportResults([]);
      return;
    }
    const res = await fetchProtectedNest(
      `/api/nest/orders/support/search?q=${encodeURIComponent(q)}`,
      {
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Search failed' }));
      setSupportError(String(err?.detail ?? err?.error ?? 'Search failed'));
      setSupportResults([]);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      setSupportResults(
        data.map((o: any) => ({
          id: String(o.id),
          status: String(o.status ?? '') as OpsQueueOrder['status'],
          source: String(o.source ?? '') as OpsQueueOrder['source'],
          fulfillmentType: o.fulfillmentType
            ? (String(o.fulfillmentType) as OpsQueueOrder['fulfillmentType'])
            : undefined,
          tableNumber: o.tableNumber != null ? String(o.tableNumber) : null,
          estimatedReadyTime: o.estimatedReadyTime ? String(o.estimatedReadyTime) : null,
          customerName: o.customerName ? String(o.customerName) : null,
          total: Number(o.total ?? 0),
          itemCount: Number(o.itemCount ?? 0),
          paymentStatus: String(o.paymentStatus ?? '') as OpsQueueOrder['paymentStatus'],
          paymentMethod: String(o.paymentMethod ?? '') as OpsQueueOrder['paymentMethod'],
          paymentCollection: o.paymentCollection
            ? (String(o.paymentCollection) as OpsQueueOrder['paymentCollection'])
            : undefined,
          staffScheduleOverride: Boolean(o.staffScheduleOverride),
        })),
      );
    }
  };

  const runCustomerDirectorySearch = async () => {
    const q = customerDirectoryQuery.trim();
    setCustomerDirectoryLoading(true);
    setCustomerDirectoryError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '24');
      params.set('sortBy', 'name');
      params.set('sortDir', 'asc');
      if (q.length > 0) params.set('search', q);
      const res = await fetchProtectedNest(
        `/api/nest/customer/admin/list?${params.toString()}`,
        { cache: 'no-store', signal: controller.signal },
      );
      if (!res.ok) {
        setCustomerDirectoryRows([]);
        const body = await res.json().catch(() => ({}));
        setCustomerDirectoryError(
          String((body as any)?.message ?? (body as any)?.detail ?? `Directory failed (${res.status})`),
        );
        return;
      }
      const body = (await res.json()) as { items?: any[] };
      const items = Array.isArray(body?.items) ? body.items : [];
      setCustomerDirectoryRows(
        items.map((r: any) => ({
          id: String(r.id),
          name: String(r.name ?? 'Guest'),
          email: r.email ? String(r.email) : null,
          phone: r.phone ? String(r.phone) : null,
          supabaseUserId: r.supabaseUserId ? String(r.supabaseUserId) : null,
          orderCount: Number(r.orderCount ?? 0),
          defaultAddress: r.defaultAddress ? String(r.defaultAddress) : null,
          latestOrderPlacedAt: r.latestOrder?.placedAt ? String(r.latestOrder.placedAt) : null,
        })),
      );
    } catch (error) {
      setCustomerDirectoryRows([]);
      if (error instanceof DOMException && error.name === 'AbortError') {
        setCustomerDirectoryError('Directory request timed out. Check API connectivity and try again.');
      } else {
        setCustomerDirectoryError('Could not load customer directory right now.');
      }
    } finally {
      window.clearTimeout(timeout);
      setCustomerDirectoryLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === 'clients') {
      void runCustomerDirectorySearch();
    }
  }, [activeTab]);
  const useDirectoryCustomerForOrder = (
    r: CustomerDirectoryRow,
    fulfillment: 'takeaway' | 'delivery' = 'takeaway',
  ) => {
    setOrderIntake('phone');
    setFulfillmentType(fulfillment);
    setCustomerName(r.name || '');
    if (r.phone) setCustomerPhone(r.phone);
    if (r.defaultAddress && !deliveryAddress.trim()) setDeliveryAddress(r.defaultAddress);
    setActiveTab('pos');
    setCustomerLookupMeta(
      fulfillment === 'delivery'
        ? 'Applied customer from directory (delivery).'
        : 'Applied customer from directory (takeaway).',
    );
  };
  const { filteredRows: filteredCustomerDirectoryRows, recentRows: recentDirectoryRows } =
    useClientDirectoryCatalog(customerDirectoryRows, {
      catalogType: customerDirectoryType,
      catalogLetter: customerDirectoryLetter,
    });
  const pinnedDirectoryRows = useMemo(
    () =>
      customerDirectoryRows
        .filter((r) => pinnedDirectoryIds.includes(r.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [customerDirectoryRows, pinnedDirectoryIds],
  );
  const togglePinnedDirectoryRow = (row: CustomerDirectoryRow) => {
    setPinnedDirectoryIds((prev) =>
      prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
    );
  };
  const clearPinnedDirectoryRows = () => setPinnedDirectoryIds([]);

  const editSupportOrder = (order: OpsQueueOrder) => {
    setSupportEditOrder(order);
    setSupportEditName(order.customerName ?? '');
    setSupportEditPhone('');
    setSupportEditAddress('');
    setSupportEditTable('');
    setSupportEditSchedule('');
    setSupportEditOpen(true);
    void (async () => {
      const detail = await openSupportOrder(order.id);
      if (!detail) return;
      setSupportEditName(detail.customer?.name ?? order.customerName ?? '');
      setSupportEditPhone(detail.customer?.phone ?? '');
      setSupportEditAddress(detail.deliveryAddress ?? '');
      setSupportEditTable(detail.tableNumber ?? '');
      setSupportEditSchedule(
        detail.estimatedReadyTime
          ? new Date(detail.estimatedReadyTime).toISOString().slice(0, 16)
          : '',
      );
    })();
  };

  const openSupportOrder = async (orderId: string) => {
    setSupportDetailsLoading(true);
    setSelectedSupportOrder(null);
    try {
      let resolvedId = String(orderId ?? '').trim();
      if (resolvedId.length < 30) {
        const lookup = await fetchProtectedNest(
          `/api/nest/orders/support/search?q=${encodeURIComponent(resolvedId)}`,
          { cache: 'no-store' },
        );
        if (lookup.ok) {
          const list = await lookup.json().catch(() => []);
          if (Array.isArray(list) && list.length > 0 && list[0]?.id) {
            resolvedId = String(list[0].id);
          }
        }
      }
      const res = await fetchProtectedNest(`/api/nest/orders/support/${resolvedId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Order details unavailable' }));
        setSupportError(String(err?.detail ?? err?.error ?? 'Order details unavailable'));
        return null;
      }
      const data = await res.json();
      const normalized = data as SupportOrderDetails;
      setSupportError(null);
      setSelectedSupportOrder(normalized);
      return normalized;
    } finally {
      setSupportDetailsLoading(false);
    }
  };

  const viewSupportOrder = (orderId: string) => {
    setSupportViewTab('summary');
    setSupportViewOpen(true);
    void openSupportOrder(orderId);
  };

  useEffect(() => {
    if (!selectedSupportOrder) {
      setCounterTableDraft('');
      return;
    }
    setCounterTableDraft(String(selectedSupportOrder.tableNumber ?? ''));
  }, [selectedSupportOrder?.id, selectedSupportOrder?.tableNumber]);

  const saveCounterTableOnly = async () => {
    if (!selectedSupportOrder) return;
    setCounterTableSaving(true);
    try {
      const res = await fetchProtectedNest(`/api/nest/orders/${selectedSupportOrder.id}/support`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: counterTableDraft,
          note: 'Table set from cashier counter',
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string; message?: string };
        toast.error(String(err?.detail ?? err?.message ?? 'Could not save table'));
        return;
      }
      const body = await res.json().catch(() => null);
      if (body) patchQueueOrderRowsFromApi(selectedSupportOrder.id, body);
      await openSupportOrder(selectedSupportOrder.id);
      void refreshOpsQueueAfterAction({ withRecon: false });
      void runSupportSearch();
      toast.success('Table saved');
    } finally {
      setCounterTableSaving(false);
    }
  };

  useEffect(() => {
    if (authChecking || !cashierProfile) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(CASHIER_RESOLVE_ORDER_QUERY)?.trim();
    if (!raw) {
      cashierResolveConsumedRef.current = false;
      return;
    }
    if (cashierResolveConsumedRef.current) return;
    cashierResolveConsumedRef.current = true;
    setActiveTab('ops');
    setSupportViewTab('summary');
    setSupportViewOpen(true);
    void openSupportOrder(raw);
    params.delete(CASHIER_RESOLVE_ORDER_QUERY);
    const next =
      window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
    router.replace(next);
  }, [authChecking, cashierProfile, router]);

  const openEditFromView = () => {
    if (!selectedSupportOrder) return;
    setSupportEditOrder({
      id: selectedSupportOrder.id,
      status: selectedSupportOrder.status,
      source: selectedSupportOrder.source,
      fulfillmentType: selectedSupportOrder.fulfillmentType,
      estimatedReadyTime: selectedSupportOrder.estimatedReadyTime ?? null,
      customerName: selectedSupportOrder.customer?.name ?? null,
      total: Number((selectedSupportOrder as any).total ?? 0),
      paymentStatus: selectedSupportOrder.paymentStatus,
      paymentMethod: selectedSupportOrder.paymentMethod,
    });
    setSupportEditName(selectedSupportOrder.customer?.name ?? '');
    setSupportEditPhone(selectedSupportOrder.customer?.phone ?? '');
    setSupportEditAddress(selectedSupportOrder.deliveryAddress ?? '');
    setSupportEditTable(selectedSupportOrder.tableNumber ?? '');
    setSupportEditSchedule(
      selectedSupportOrder.estimatedReadyTime
        ? new Date(selectedSupportOrder.estimatedReadyTime).toISOString().slice(0, 16)
        : '',
    );
    setSupportViewOpen(false);
    setSupportEditOpen(true);
  };

  const openBrowserPrintBill = (order: SupportOrderDetails) => {
    const esc = (v: string | null | undefined) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const intakeLabel =
      order.source === 'cashier_pos_offline'
        ? 'Phone order'
        : order.source === 'cashier_pos'
          ? 'Counter POS'
          : String(order.source).replaceAll('_', ' ');
    const itemsHtml = order.items
      .map((item) => {
        const modLines = getOrderItemModifierDisplayLines(item.modifiers);
        const modsBlock =
          modLines.length > 0
            ? `<div class="item-mods">${modLines
                .map((l) => `<div class="mod-line">${esc(l.label)} · ${esc(l.value)}</div>`)
                .join('')}</div>`
            : '';
        return `<div class="line-item">
          <div class="line-item-top">
            <span class="line-qty">${esc(String(item.quantity))}×</span>
            <span class="line-name">${esc(item.name)}</span>
            <span class="line-price">Rs ${Number(item.lineTotal).toFixed(2)}</span>
          </div>
          ${modsBlock}
        </div>`;
      })
      .join('');
    const subtotal = Number((order as any).subtotal ?? 0);
    const discount = Number((order as any).discountAmount ?? 0);
    const tax = Number((order as any).tax ?? 0);
    const delivery = Number((order as any).deliveryFee ?? 0);
    const total = Number((order as any).total ?? 0);
    const printedAt = new Date().toLocaleString();
    const orderIdShort = String(order.id).slice(0, 8).toUpperCase();
    const orderIdFull = esc(String(order.id));
    const placedAtStr = order.placedAt
      ? new Date(String(order.placedAt)).toLocaleString()
      : '—';
    const readyStr = order.estimatedReadyTime
      ? new Date(String(order.estimatedReadyTime)).toLocaleString()
      : 'ASAP';
    const statusPretty = esc(
      String(order.status ?? '')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    );
    const payTiming = esc(formatPaymentCollectionLabel(order.paymentCollection ?? 'immediate'));
    const isDelivery = String(order.fulfillmentType ?? '').toLowerCase() === 'delivery';
    const courierRow = isDelivery
      ? `<div class="kv"><span>Courier</span><span>${order.courierName ? esc(order.courierName) : '—'}</span></div>`
      : '';
    const fulfill = String(order.fulfillmentType ?? '-').replaceAll('_', ' ');
    const tableLine = order.tableNumber ? esc(order.tableNumber) : '—';
    const addrLine = order.deliveryAddress ? esc(order.deliveryAddress) : '—';
    const phoneLine = order.customer?.phone ? esc(order.customer.phone) : '—';
    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Wrap & Roll · ${orderIdShort}</title>
          <style>
            :root {
              --ink: #0f172a;
              --muted: #64748b;
              --accent: #c2410c;
              --rule: #cbd5e1;
              --paper: #fafaf9;
            }
            * { box-sizing: border-box; }
            @page { margin: 10mm; size: auto; }
            @media print {
              body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .receipt { box-shadow: none !important; border: 0 !important; }
            }
            body {
              margin: 0;
              padding: 16px;
              font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 11.5px;
              line-height: 1.45;
              color: var(--ink);
              background: var(--paper);
            }
            .receipt {
              max-width: 360px;
              margin: 0 auto;
              padding: 20px 18px 24px;
              background: #fff;
              border: 1px solid var(--rule);
              border-radius: 2px;
              box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
            }
            .brand {
              text-align: center;
              padding-bottom: 14px;
              border-bottom: 2px dashed var(--rule);
            }
            .brand-name {
              margin: 0;
              font-size: 1.35rem;
              font-weight: 800;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: var(--accent);
            }
            .brand-tag {
              margin: 6px 0 0;
              font-size: 0.72rem;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: var(--muted);
            }
            .order-chip {
              display: inline-block;
              margin-top: 12px;
              padding: 4px 12px;
              font-size: 0.75rem;
              font-weight: 700;
              letter-spacing: 0.08em;
              border: 1px solid var(--rule);
              border-radius: 999px;
              background: #f8fafc;
            }
            .section-title {
              margin: 16px 0 8px;
              font-size: 0.65rem;
              font-weight: 700;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: var(--muted);
            }
            .kv { margin: 3px 0; display: flex; justify-content: space-between; gap: 12px; }
            .kv span:first-child { color: var(--muted); flex-shrink: 0; }
            .kv span:last-child { text-align: right; font-weight: 500; }
            .rule { height: 0; margin: 14px 0; border: 0; border-top: 1px dashed var(--rule); }
            .line-item { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dotted #e2e8f0; }
            .line-item:last-of-type { border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }
            .line-item-top {
              display: grid;
              grid-template-columns: auto 1fr auto;
              gap: 8px;
              align-items: start;
            }
            .line-qty { font-weight: 800; color: var(--accent); min-width: 1.75rem; }
            .line-name { font-weight: 600; }
            .line-price { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
            .item-mods { margin: 6px 0 0 1.75rem; padding-left: 8px; border-left: 2px solid #fed7aa; }
            .mod-line { font-size: 0.8rem; color: var(--muted); line-height: 1.35; }
            .totals { margin-top: 4px; }
            .tot-row {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              padding: 4px 0;
              font-size: 0.92rem;
              font-variant-numeric: tabular-nums;
            }
            .tot-row span:first-child { color: var(--muted); }
            .tot-grand {
              margin-top: 10px;
              padding: 12px 12px;
              border: 2px solid var(--ink);
              border-radius: 4px;
              background: #fafaf9;
            }
            .tot-grand .tot-row { padding: 0; font-size: 1.05rem; font-weight: 800; }
            .tot-grand span:first-child { color: var(--ink); }
            .footer {
              margin-top: 18px;
              padding-top: 14px;
              border-top: 2px dashed var(--rule);
              text-align: center;
              font-size: 0.78rem;
              color: var(--muted);
            }
            .footer strong { display: block; margin-bottom: 4px; color: var(--ink); font-size: 0.85rem; }
            .ref-id { margin-top: 10px; font-size: 0.65rem; font-family: ui-monospace, monospace; color: var(--muted); word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <header class="brand">
              <h1 class="brand-name">Wrap &amp; Roll</h1>
              <p class="brand-tag">Gourmet street food</p>
              <div class="order-chip">Order #${esc(orderIdShort)}</div>
            </header>

            <div class="section-title">Order details</div>
            <div class="kv"><span>Order status</span><span>${statusPretty}</span></div>
            <div class="kv"><span>Placed</span><span>${esc(placedAtStr)}</span></div>
            <div class="kv"><span>Ready / scheduled</span><span>${esc(readyStr)}</span></div>
            <div class="kv"><span>Printed</span><span>${esc(printedAt)}</span></div>
            <div class="kv"><span>Intake</span><span>${esc(intakeLabel)}</span></div>
            <div class="kv"><span>Fulfillment</span><span>${esc(fulfill)}</span></div>
            <div class="kv"><span>Table</span><span>${tableLine}</span></div>
            <div class="kv"><span>Address</span><span>${addrLine}</span></div>
            ${courierRow}

            <div class="section-title">Customer</div>
            <div class="kv"><span>Name</span><span>${esc(order.customer?.name ?? 'Guest')}</span></div>
            <div class="kv"><span>Phone</span><span>${phoneLine}</span></div>
            <div class="kv"><span>Payment</span><span>${esc(String(order.paymentMethod))} · ${esc(String(order.paymentStatus))}</span></div>
            <div class="kv"><span>Pay timing</span><span>${payTiming}</span></div>

            <hr class="rule" />

            <div class="section-title">Items</div>
            ${itemsHtml}

            <hr class="rule" />

            <div class="section-title">Totals</div>
            <div class="totals">
              <div class="tot-row"><span>Subtotal</span><span>Rs ${subtotal.toFixed(2)}</span></div>
              <div class="tot-row"><span>Discount</span><span>Rs ${discount.toFixed(2)}</span></div>
              <div class="tot-row"><span>Tax</span><span>Rs ${tax.toFixed(2)}</span></div>
              <div class="tot-row"><span>Delivery</span><span>Rs ${delivery.toFixed(2)}</span></div>
              <div class="tot-grand">
                <div class="tot-row"><span>Total due</span><span>Rs ${total.toFixed(2)}</span></div>
              </div>
            </div>

            <footer class="footer">
              <strong>Thank you for rolling with us</strong>
              This document is a customer copy. Retain for your records.
              <div class="ref-id">Reference: ${orderIdFull}</div>
            </footer>
          </div>
        </body>
      </html>
    `;

    /** Hidden iframe avoids popup blockers (no extra browser “permission” for new windows). */
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.title = 'Print bill';
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error('Could not prepare print view in this browser.');
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 2000);
      }
    }, 200);
  };

  const printOrderBill = async (orderId: string) => {
    const detail = await openSupportOrder(orderId);
    if (!detail) {
      toast.error('Unable to load order details for printing');
      return;
    }
    openBrowserPrintBill(detail);
  };

  const lookupCustomerByPhone = async () => {
    const normalized = normalizeCashierPhone(customerPhone);
    const digits = phoneDigits(normalized);
    if (digits.length < MIN_PHONE_DIGITS) {
      setCustomerLookupMeta(null);
      return;
    }
    setCustomerLookupLoading(true);
    try {
      const res = await fetchProtectedNest(
        `/api/nest/customer/intake-by-phone?phone=${encodeURIComponent(normalized || customerPhone)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setCustomerLookupMeta('Could not lookup customer profile now');
        return;
      }
      const data = (await res.json()) as IntakeLookupResponse;
      if (!data?.found) {
        const inferred = data?.inferredAddress ? String(data.inferredAddress) : '';
        if (!deliveryAddress.trim() && inferred) setDeliveryAddress(inferred);
        setCustomerLookupMeta(inferred ? 'Guest profile — using last known delivery address' : 'Guest profile');
        return;
      }
      if (!normalizeCashierPhone(customerName) && data.customer?.name) {
        setCustomerName(String(data.customer.name));
      }
      if (!deliveryAddress.trim() && data.suggestedAddress) {
        setDeliveryAddress(String(data.suggestedAddress));
      }
      setCustomerLookupMeta(
        data.customer?.type === 'client'
          ? 'Known client found — saved address suggested'
          : 'Known guest found — recent address suggested',
      );
    } catch {
      setCustomerLookupMeta('Could not lookup customer profile now');
    } finally {
      setCustomerLookupLoading(false);
    }
  };

  const handleCheckout = () => {
    if (submittingOrder) return;
    if (cart.length === 0) {
      toast.info('Add at least one item to place an order.');
      return;
    }
    if (fulfillmentType === 'dine_in' && !tableNumber.trim()) {
      alert('Please enter a table number for dine-in orders.');
      return;
    }
    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      alert('Please enter a delivery address.');
      return;
    }
    const digits = phoneDigits(customerPhone);
    if (!isPhoneIntakeValid(orderIntake, digits)) {
      toast.error(
        `Phone orders need a valid phone number (${MIN_PHONE_DIGITS}–${MAX_PHONE_DIGITS} digits).`,
      );
      return;
    }
    if (orderIntake === 'phone' && !normalizeCashierPhone(customerName)) {
      toast.warning('No customer name entered — continuing as guest.');
    }
    if (paymentMethod === 'CARD' && !cardPaymentsEnabled) {
      toast.error('Card payments are currently disabled in settings.');
      return;
    }
    const effectivePaymentMethod: CashierPaymentMethod = paymentMethod;
    const paymentCollection: CashierPaymentCollection =
      effectivePaymentMethod === 'CARD'
        ? 'immediate'
        : orderIntake === 'phone' && fulfillmentType === 'delivery'
          ? 'on_delivery'
          : orderIntake === 'phone' && (fulfillmentType === 'takeaway' || fulfillmentType === 'dine_in')
            ? 'on_pickup'
            : 'immediate';
    const phoneForPay = normalizeCashierPhone(customerPhone);
    setSubmittingOrder(true);
    pay(
      effectivePaymentMethod,
      { name: customerName, phone: phoneForPay || undefined },
      {
        fulfillmentType,
        paymentCollection,
        tableNumber,
        deliveryAddress,
        orderSource: orderIntake === 'phone' ? 'cashier_pos_offline' : 'cashier_pos',
      },
    );
    setCustomerName('');
    setCustomerPhone('');
    setTableNumber('');
    setDeliveryAddress('');
    setCustomerLookupMeta(null);
    setFulfillmentType('takeaway');
    setTimeout(() => setSubmittingOrder(false), 900);
    setTimeout(updatePendingCount, 500);
  };

  const clearPendingSync = async () => {
    const confirmed = window.confirm(
      'Clear all pending local sync orders? Use this only to discard stale/failed queued items.',
    );
    if (!confirmed) return;
    await clearQueuedOrders();
    setSyncFeedback({
      type: 'info',
      message: 'Pending sync queue cleared.',
    });
    await updatePendingCount();
  };

  const retryPendingSync = async () => {
    if (!navigator.onLine) {
      setSyncFeedback({
        type: 'error',
        message: 'Cannot retry while offline.',
      });
      return;
    }
    setSyncFeedback({
      type: 'info',
      message: 'Retrying pending sync...',
    });
    await syncOrders();
    await updatePendingCount();
  };
  const cashPaymentLabel =
    orderIntake === 'phone' && fulfillmentType === 'delivery'
      ? 'Pay on delivery'
      : orderIntake === 'phone' && (fulfillmentType === 'takeaway' || fulfillmentType === 'dine_in')
        ? 'Pay on pickup'
        : 'Cash';
  const isPhoneOrder = orderIntake === 'phone';
  const hasValidPhoneForPhoneOrder = !isPhoneOrder || isPhoneIntakeValid(orderIntake, phoneDigits(customerPhone));
  const hasRequiredAddressForDelivery = fulfillmentType !== 'delivery' || deliveryAddress.trim().length > 0;
  const hasRequiredTableForDineIn = fulfillmentType !== 'dine_in' || tableNumber.trim().length > 0;
  const canSubmitOrder =
    cart.length > 0 &&
    !submittingOrder &&
    hasValidPhoneForPhoneOrder &&
    hasRequiredAddressForDelivery &&
    hasRequiredTableForDineIn;

  const startCustomize = (product: ProductRow) => {
    setProductToCustomize(product);
    const defaults: Record<string, string[]> = {};
    (product.modifierGroups ?? []).forEach((g) => {
      defaults[g.groupId] = (g.options ?? [])
        .filter((o) => o.isDefault)
        .map((o) => o.optionId);
    });
    setSelectedByGroup(defaults);
    setItemNotes('');
    setCustomizeTab((product.modifierGroups ?? []).length > 0 ? 'options' : 'notes');
    setCustomizeOptionImpacts({});
    setCustomizeImpactLoading(true);
    void (async () => {
      try {
        const res = await fetchProtectedNest(`/api/nest/menu/${product.id}/info`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setCustomizeOptionImpacts({});
          return;
        }
        const info = (await res.json()) as ProductInfo;
        const impacts = (info.modifierIngredientImpacts ?? []).reduce<
          Record<string, string[]>
        >((acc, row) => {
          acc[row.optionLabel] = row.ingredients;
          return acc;
        }, {});
        setCustomizeOptionImpacts(impacts);
      } catch {
        setCustomizeOptionImpacts({});
      } finally {
        setCustomizeImpactLoading(false);
      }
    })();
    setCustomizeOpen(true);
  };

  const toggleOption = (
    groupId: string,
    optionId: string,
    type: 'single' | 'multi',
  ) => {
    setSelectedByGroup((prev) => {
      const current = prev[groupId] ?? [];
      if (type === 'single') return { ...prev, [groupId]: [optionId] };
      return {
        ...prev,
        [groupId]: current.includes(optionId)
          ? current.filter((x) => x !== optionId)
          : [...current, optionId],
      };
    });
  };

  const selectedCustomizeOptions = useMemo(() => {
    if (!productToCustomize) return [];
    const groups = productToCustomize.modifierGroups ?? [];
    return groups.flatMap((g) =>
      (g.options ?? [])
        .filter((o) => (selectedByGroup[g.groupId] ?? []).includes(o.optionId))
        .map((o) => ({
          groupName: g.name,
          label: o.label,
          priceAdjust: Number(o.priceAdjust ?? 0),
        })),
    );
  }, [productToCustomize, selectedByGroup]);

  const customizeExtras = useMemo(
    () => selectedCustomizeOptions.reduce((sum, option) => sum + option.priceAdjust, 0),
    [selectedCustomizeOptions],
  );

  const customizeTotal = useMemo(() => {
    const base = Number(productToCustomize?.price ?? 0);
    return base + customizeExtras;
  }, [productToCustomize?.price, customizeExtras]);

  const selectedModifierIngredientImpacts = useMemo(() => {
    return selectedCustomizeOptions
      .map((opt) => ({
        optionLabel: opt.label,
        ingredients: customizeOptionImpacts[opt.label] ?? [],
      }))
      .filter((entry) => entry.ingredients.length > 0);
  }, [selectedCustomizeOptions, customizeOptionImpacts]);

  const addCustomizedItem = () => {
    if (!productToCustomize) return;
    const groups = productToCustomize.modifierGroups ?? [];
    for (const g of groups) {
      if (g.required && !(selectedByGroup[g.groupId]?.length > 0)) {
        alert(`Please select an option for ${g.name}`);
        return;
      }
    }
    addItem({
      id: productToCustomize.id,
      name: productToCustomize.name,
      unitPrice: customizeTotal,
      quantity: 1,
      notes: itemNotes.trim() || undefined,
      selectedOptions: selectedCustomizeOptions,
    });
    setCustomizeOpen(false);
  };

  if (authChecking) {
    return (
      <OpsLayout className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking cashier access...</p>
      </OpsLayout>
    );
  }

  return (
    <OpsLayout className="flex min-h-screen flex-col">
      <OpsHeader
        title="Cashier POS"
        subtitle={
          cashierProfile?.email ? (
            <span className="text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{cashierProfile.email}</span>
              {cashierProfile.role ? (
                <span className="text-muted-foreground"> · {cashierProfile.role}</span>
              ) : null}
            </span>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-3 rounded-lg border bg-white p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-black ${activeTab === 'pos' ? 'bg-primary text-white' : 'text-slate-600'}`}
              onClick={() => startTransition(() => setActiveTab('pos'))}
            >
              POS
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-black ${activeTab === 'ops' ? 'bg-primary text-white' : 'text-slate-600'}`}
              onClick={() => startTransition(() => setActiveTab('ops'))}
            >
              Queue & Support
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-black ${activeTab === 'clients' ? 'bg-primary text-white' : 'text-slate-600'}`}
              onClick={() => startTransition(() => setActiveTab('clients'))}
            >
              Clients
            </button>
          </div>
          {pendingSyncCount > 0 ? (
            <>
              <StatusPill variant="warning" className="animate-pulse">
                <RefreshCw size={14} className="animate-spin-slow" />
                {pendingSyncCount} Pending Sync
              </StatusPill>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void retryPendingSync()}
              >
                Retry now
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void clearPendingSync()}
              >
                Clear pending
              </Button>
            </>
          ) : null}
          <StatusPill variant={isOnline ? 'online' : 'offline'}>
            {isOnline ? (
              <>
                <Wifi size={16} /> Online Mode
              </>
            ) : (
              <>
                <WifiOff size={16} /> Offline Mode
              </>
            )}
          </StatusPill>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${queueLiveStatusClass(queueLiveStatus)}`}
            title="Realtime queue stream status"
          >
            {queueLiveStatusLabel(queueLiveStatus)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 font-semibold"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            title="Sign out and return to login"
          >
            <LogOut size={16} aria-hidden />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </OpsHeader>

      <main className="flex flex-1 flex-col gap-6 p-6 md:flex-row">
        {activeTab === 'ops' ? (
          <section className="w-full overflow-y-auto">
            <div className="w-full rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-semibold text-foreground">Queue</span>
                  <span className="text-muted-foreground">
                    {queueStats.total} total · {queueStats.ongoing} active · {queueStats.completed} finished
                  </span>
                  {queueStats.scheduled > 0 ? (
                    <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                      {queueStats.scheduled} scheduled
                    </span>
                  ) : null}
                  {queueExceptions.pendingCash > 0 ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      {queueExceptions.pendingCash} cash to collect
                    </span>
                  ) : null}
                  {queueExceptions.failedPayment > 0 ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900">
                      {queueExceptions.failedPayment} pay failed
                    </span>
                  ) : null}
                  {queueExceptions.scheduledOverdue > 0 ? (
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-900">
                      {queueExceptions.scheduledOverdue} late
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className="h-8 rounded border bg-background px-2 text-xs"
                    value={reconDate ?? ''}
                    onChange={(e) => setReconDate(e.target.value)}
                    title="Orders placed on this date"
                  />
                  <button
                    type="button"
                    className="h-8 rounded border px-2 text-xs font-semibold"
                    onClick={() =>
                      setReconDate(businessToday ?? new Date().toISOString().slice(0, 10))
                    }
                    disabled={Boolean(reconDate && businessToday && reconDate === businessToday)}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded border px-2 text-xs font-semibold"
                    onClick={() => void refreshOpsQueueAfterAction({ withRecon: true })}
                  >
                    Refresh
                  </button>
                </div>
              </div>
              <div className="mb-4 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3">
                <p className="mb-2 text-xs font-semibold text-emerald-900">Find order</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    className="h-9 min-w-[180px] flex-1 rounded border border-emerald-200 bg-white px-2.5 text-sm"
                    placeholder="ID, name, or phone"
                    value={supportQuery}
                    onChange={(e) => setSupportQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    className="h-9 rounded bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800"
                    onClick={() => void runSupportSearch()}
                  >
                    Find
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      supportListFilter === 'all'
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-emerald-200 bg-white text-emerald-900'
                    }`}
                    onClick={() => setSupportListFilter('all')}
                  >
                    All results
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      supportListFilter === 'dine_in_needs_table'
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-emerald-200 bg-white text-emerald-900'
                    }`}
                    onClick={() => setSupportListFilter('dine_in_needs_table')}
                  >
                    Dine-in · needs table
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {supportResultsForList.map((o) => (
                    <div
                      key={`support-${o.id}`}
                      className="flex items-center justify-between rounded border border-emerald-100 bg-white px-2 py-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold">
                          {String(o.id).slice(0, 8).toUpperCase()} • {o.customerName || 'Guest'}
                        </p>
                        <p className="text-muted-foreground">{o.status}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded border border-emerald-200 px-2 py-1 font-bold"
                          onClick={() => viewSupportOrder(o.id)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="rounded border border-emerald-200 px-2 py-1 font-bold"
                          onClick={() => void editSupportOrder(o)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 ${
                      opsBoardView === 'attention' ? 'bg-primary text-white' : 'text-muted-foreground'
                    }`}
                    title={
                      cashierAttentionDisplay.hiddenDeliveryStatusCount > 0
                        ? `${cashierAttentionDisplay.items.length} listed; ${cashierAttentionDisplay.hiddenDeliveryStatusCount} more “out for delivery” checks hidden during rush — see the note below`
                        : `${cashierAttentionDisplay.items.length} item${cashierAttentionDisplay.items.length === 1 ? '' : 's'} on Next up`
                    }
                    onClick={() => startTransition(() => setOpsBoardView('attention'))}
                  >
                    <ListTodo className="h-3.5 w-3.5" aria-hidden />
                    Next up
                    <span
                      className={
                        opsBoardView === 'attention'
                          ? 'rounded-full bg-white/25 px-1.5 py-0 text-[10px] font-black tabular-nums'
                          : 'rounded-full bg-muted px-1.5 py-0 text-[10px] font-black tabular-nums text-foreground'
                      }
                    >
                      {cashierAttentionDisplay.items.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rounded px-3 py-1.5 ${opsBoardView === 'order' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                    onClick={() => startTransition(() => setOpsBoardView('order'))}
                  >
                    Order board
                  </button>
                  <button
                    type="button"
                    className={`rounded px-3 py-1.5 ${opsBoardView === 'payment' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                    onClick={() => startTransition(() => setOpsBoardView('payment'))}
                  >
                    Payments & totals
                  </button>
                </div>
              {opsBoardView === 'payment' ? (
                <div className="mb-4 rounded-lg border bg-white p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Daily reconciliation (placed date · same as queue date above)
                  </p>
                  {reconLoading ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <MetricCard
                        size="sm"
                        label="Total orders"
                        value={0}
                        icon={Hash}
                        accent="#3b82f6"
                        loading
                      />
                      <MetricCard
                        size="sm"
                        label="Paid / completed"
                        value={0}
                        icon={CheckCircle2}
                        accent="#22c55e"
                        loading
                      />
                      <MetricCard
                        size="sm"
                        label="Pending payment"
                        value={0}
                        icon={Hourglass}
                        accent="#eab308"
                        loading
                      />
                      <MetricCard
                        size="sm"
                        label="Failed"
                        value={0}
                        icon={XCircle}
                        accent="#ef4444"
                        loading
                      />
                    </div>
                  ) : reconSummary ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                          size="sm"
                          label="Total orders"
                          value={reconSummary.totalOrders}
                          icon={Hash}
                          accent="#3b82f6"
                        />
                        <MetricCard
                          size="sm"
                          label="Paid / completed"
                          value={reconSummary.completedPayments}
                          icon={CheckCircle2}
                          accent="#22c55e"
                        />
                        <MetricCard
                          size="sm"
                          label="Pending payment"
                          value={reconSummary.pendingPayments}
                          icon={Hourglass}
                          accent="#eab308"
                        />
                        <MetricCard
                          size="sm"
                          label="Failed"
                          value={reconSummary.failedPayments}
                          icon={XCircle}
                          accent="#ef4444"
                        />
                      </div>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="py-1 pr-2">Method</th>
                              <th className="py-1 pr-2">Orders</th>
                              <th className="py-1 pr-2">Completed</th>
                              <th className="py-1 pr-2">Pending</th>
                              <th className="py-1 pr-2">Failed</th>
                              <th className="py-1">Completed total (Rs)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reconSummary.byMethod.map((row) => (
                              <tr key={row.method} className="border-b border-neutral-100">
                                <td className="py-1 pr-2 font-semibold">{row.method}</td>
                                <td className="py-1 pr-2">{row.orderCount}</td>
                                <td className="py-1 pr-2">{row.completedCount}</td>
                                <td className="py-1 pr-2">{row.pendingCount}</td>
                                <td className="py-1 pr-2">{row.failedCount}</td>
                                <td className="py-1 tabular-nums">
                                  {Number(row.completedTotal).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No summary available.</p>
                  )}
                </div>
              ) : null}
              <div className="mt-1">
                {/* Boards + attention stay mounted; visibility toggles avoid unmount/remount cost on tab switch. */}
                <div
                  className={opsBoardView === 'attention' ? 'block' : 'hidden'}
                  aria-hidden={opsBoardView !== 'attention'}
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    Start at the top — only the most time-sensitive work is listed first.
                  </p>
                  {cashierAttentionDisplay.hiddenDeliveryStatusCount > 0 ? (
                    <div
                      className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950"
                      role="status"
                    >
                      <span className="font-medium">
                        +{cashierAttentionDisplay.hiddenDeliveryStatusCount} more &quot;on the way&quot; orders
                        not shown
                      </span>
                      <span className="text-sky-900/90">
                        {' '}
                        — use <strong>Find order</strong> or <strong>Order board</strong> → In transit.
                      </span>
                    </div>
                  ) : null}
                  {cashierAttentionDisplay.items.length === 0 ? (
                    <EmptyState
                      title="All clear on Next up"
                      description="Nothing needs you right this minute. Use Order board to scan the full line, or Find order when someone calls."
                    />
                  ) : (
                    <ul className="space-y-4">
                      {cashierAttentionDisplay.items.map(({ order, score, headline, detail }) => (
                        <li
                          key={order.id}
                          className={`rounded-xl border-2 p-3 shadow-sm ${attentionUrgencyFrameClass(score)}`}
                        >
                          <div className="mb-3 border-b border-black/5 pb-2">
                            <p className="text-sm font-black uppercase tracking-wide text-foreground">{headline}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
                          </div>
                          <QueueOrderCard
                            order={order}
                            showDeliveryAddress
                            onOpen={(id) => viewSupportOrder(id)}
                            onMove={(id, next) => void moveQueueOrderStatus(id, next)}
                            onCollectCash={(id) => void collectCashFromQueue(id)}
                            onCollectCard={(id) => void collectCardFromQueue(id)}
                            showPaymentActions
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div
                  className={opsBoardView === 'order' ? 'block' : 'hidden'}
                  aria-hidden={opsBoardView !== 'order'}
                >
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
                            showDeliveryAddress
                            onOpen={(id) => viewSupportOrder(id)}
                            onMove={(id, next) => void moveQueueOrderStatus(id, next)}
                          />
                        )),
                    }))}
                  />
                </div>
                <div
                  className={opsBoardView === 'payment' ? 'block' : 'hidden'}
                  aria-hidden={opsBoardView !== 'payment'}
                >
                  <OrderQueueBoard
                    columns={[
                      {
                        key: 'pay-pending',
                        title: 'Pending payment',
                        count: queueBoardOrders.filter((o) => o.paymentStatus === 'pending').length,
                        children: queueBoardOrders
                          .filter((o) => o.paymentStatus === 'pending')
                          .map((o) => (
                            <QueueOrderCard
                              key={o.id}
                              order={o}
                              showMoveAction={false}
                              onOpen={(id) => viewSupportOrder(id)}
                              onCollectCash={(id) => void collectCashFromQueue(id)}
                              onCollectCard={(id) => void collectCardFromQueue(id)}
                            />
                          )),
                      },
                      {
                        key: 'pay-completed',
                        title: 'Completed',
                        count: queueBoardOrders.filter((o) => o.paymentStatus === 'completed').length,
                        children: queueBoardOrders
                          .filter((o) => o.paymentStatus === 'completed')
                          .map((o) => (
                            <QueueOrderCard
                              key={o.id}
                              order={o}
                              showMoveAction={false}
                              showPaymentActions={false}
                              onOpen={(id) => viewSupportOrder(id)}
                            />
                          )),
                      },
                      {
                        key: 'pay-failed',
                        title: 'Failed',
                        count: queueBoardOrders.filter((o) => o.paymentStatus === 'failed').length,
                        children: queueBoardOrders
                          .filter((o) => o.paymentStatus === 'failed')
                          .map((o) => (
                            <QueueOrderCard
                              key={o.id}
                              order={o}
                              showMoveAction={false}
                              onOpen={(id) => viewSupportOrder(id)}
                              onCollectCash={(id) => void collectCashFromQueue(id)}
                              onCollectCard={(id) => void collectCardFromQueue(id)}
                            />
                          )),
                      },
                      {
                        key: 'pay-refunded',
                        title: 'Refunded',
                        count: queueBoardOrders.filter((o) => o.paymentStatus === 'refunded').length,
                        children: queueBoardOrders
                          .filter((o) => o.paymentStatus === 'refunded')
                          .map((o) => (
                            <QueueOrderCard
                              key={o.id}
                              order={o}
                              showMoveAction={false}
                              showPaymentActions={false}
                              onOpen={(id) => viewSupportOrder(id)}
                            />
                          )),
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}
        {activeTab === 'clients' ? (
          <section className="flex-1 overflow-y-auto pr-2">
            <ClientDirectory
              title="Client directory"
              query={customerDirectoryQuery}
              onQueryChange={setCustomerDirectoryQuery}
              onSearch={() => void runCustomerDirectorySearch()}
              loading={customerDirectoryLoading}
              messageText={customerDirectoryError}
              rows={filteredCustomerDirectoryRows as SharedClientDirectoryRow[]}
              recentRows={recentDirectoryRows as SharedClientDirectoryRow[]}
              catalogLetter={customerDirectoryLetter}
              onCatalogLetterChange={setCustomerDirectoryLetter}
              catalogType={customerDirectoryType}
              onCatalogTypeChange={setCustomerDirectoryType}
              pinnedRows={pinnedDirectoryRows as SharedClientDirectoryRow[]}
              onTogglePin={(r) => togglePinnedDirectoryRow(r as CustomerDirectoryRow)}
              isPinned={(r) => pinnedDirectoryIds.includes(r.id)}
              onClearPins={clearPinnedDirectoryRows}
              cardActions={[
                {
                  id: 'start-takeaway',
                  label: 'Use for takeaway',
                  variant: 'outline',
                  onAction: (r) => useDirectoryCustomerForOrder(r as CustomerDirectoryRow, 'takeaway'),
                },
                {
                  id: 'start-delivery',
                  label: 'Use for delivery',
                  variant: 'default',
                  onAction: (r) => useDirectoryCustomerForOrder(r as CustomerDirectoryRow, 'delivery'),
                },
              ]}
            />
          </section>
        ) : null}
        <section className={`${activeTab === 'pos' ? 'flex-1' : 'hidden'} overflow-y-auto pr-2`}>
          {productsLoading ? (
            <EmptyState
              className="py-12"
              icon={RefreshCw}
              title="Loading products..."
              description="Fetching live menu from the API."
            />
          ) : productsError ? (
            <EmptyState
              className="py-12"
              icon={AlertTriangle}
              title="Menu unavailable"
              description={productsError}
            />
          ) : products.length === 0 ? (
            <EmptyState
              className="py-12"
              icon={ShoppingCart}
              title="No active menu items"
              description="No items are currently available for sale."
            />
          ) : (
            <div className="space-y-6 pb-6">
              <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur-sm">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    className="h-11 rounded-xl border bg-white px-3 text-sm"
                    placeholder="Search menu item or category..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-2 text-xs font-black ${activeCategory === 'ALL' ? 'bg-primary text-white' : 'border text-slate-700'}`}
                      onClick={() => setActiveCategory('ALL')}
                    >
                      All ({products.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`rounded-lg px-3 py-2 text-xs font-black ${activeCategory === cat ? 'bg-primary text-white' : 'border text-slate-700'}`}
                        onClick={() => setActiveCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <EmptyState
                  className="py-12"
                  icon={ShoppingCart}
                  title="No matching items"
                  description="Try a different search keyword or category."
                />
              ) : (
                groupedProducts.map(([category, items]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-700">
                        {category}
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">
                        {items.length} items
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {items.map((product) => (
                        <div key={product.id} className="h-full">
                          <ProductPickTile
                            category={product.category}
                            name={product.name}
                            priceLabel={`Rs ${product.price}.00`}
                            className="h-full"
                            infoLabel={`Info for ${product.name}`}
                            infoIcon={<Info size={14} />}
                            onInfoClick={() => openInfo(product.id)}
                            onClick={() => startCustomize(product)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <aside
          className={`${activeTab === 'pos' ? 'flex' : 'hidden'} w-full flex-col rounded-3xl border border-border bg-card shadow-xl ring-4 ring-muted md:w-96`}
        >
          <div className="flex items-center justify-between rounded-t-3xl border-b border-border bg-muted/40 p-5">
            <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-foreground">
              <ShoppingCart size={22} className="text-primary" /> Cart Contents
            </h2>
            {cart.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="rounded-full p-2 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                aria-label="Clear cart"
              >
                <Trash2 size={20} />
              </button>
            ) : null}
          </div>

          <div className="space-y-4 p-5">
            {cart.length === 0 ? (
              <EmptyState
                className="min-h-[200px] py-8"
                icon={ShoppingCart}
                title="No items selected yet"
                description="Tap a product to add it to the cart."
              />
            ) : (
              cart.map((item) => (
                <div
                  key={item.cartId}
                  className="group flex items-start justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground transition-colors group-hover:text-primary">
                      {item.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex shrink-0 items-center rounded-md border bg-muted/40">
                        <button
                          type="button"
                          className="px-2 py-0.5 text-xs font-black text-muted-foreground hover:text-foreground"
                          onClick={() => decrementItem(item.cartId)}
                          aria-label={`Decrease quantity for ${item.name}`}
                        >
                          -
                        </button>
                        <span className="px-2 py-0.5 text-xs font-bold text-muted-foreground">
                          x{item.quantity}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-0.5 text-xs font-black text-muted-foreground hover:text-foreground"
                          onClick={() => incrementItem(item.cartId)}
                          aria-label={`Increase quantity for ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted/40 px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                        @ Rs {Number(item.unitPrice).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-primary"
                        aria-label={`Recipe info for ${item.name}`}
                        onClick={() => openInfo(item.id)}
                      >
                        <Info size={14} />
                      </button>
                    </div>
                    {item.selectedOptions?.length ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Includes:{' '}
                        {item.selectedOptions
                          .map((x) => `${x.groupName}: ${x.label}`)
                          .join(', ')}
                      </p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Note: {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <p className="ml-2 shrink-0 border-l border-border pl-3 text-right font-black tabular-nums text-foreground">
                    Rs {(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    className="ml-2 rounded-full p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeItem(item.cartId)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="px-5 pt-2">
            {!isOnline ? (
              <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-800 shadow-inner">
                <AlertTriangle size={24} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="mb-0.5 font-bold">Offline checkout active</p>
                  <p className="font-semibold leading-relaxed opacity-80">
                    Orders are saved locally and sync when you are back online.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto p-5">
            <div className="mb-6 flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span>Total amount due</span>
                {cart.length > 0 && fulfillmentType !== 'delivery' ? (
                  <span className="text-muted-foreground/60">Includes taxes</span>
                ) : cart.length > 0 && fulfillmentType === 'delivery' ? (
                  <span className="text-muted-foreground/60">VAT + delivery (estimate)</span>
                ) : null}
              </div>
              {fulfillmentType === 'delivery' && cart.length > 0 ? (
                !isOnline ? (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal (items)</span>
                      <span className="tabular-nums font-medium text-foreground">
                        Rs {subtotal.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/90">
                      Connect to the internet to estimate VAT and delivery for this address.
                    </p>
                    <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                      <span className="text-lg font-bold text-foreground">Due (items only)</span>
                      <span className="text-3xl font-black tabular-nums tracking-tighter text-foreground">
                        Rs {subtotal.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : posDeliveryQuoteLoading && !posDeliveryQuote ? (
                  <p className="text-sm text-muted-foreground">Estimating VAT and delivery…</p>
                ) : posDeliveryQuote ? (
                  <>
                    <div
                      className={`space-y-1.5 text-sm ${posDeliveryQuoteLoading ? 'opacity-70' : ''}`}
                    >
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tabular-nums font-medium text-foreground">
                          Rs {posDeliveryQuote.subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax (VAT)</span>
                        <span className="tabular-nums font-medium text-foreground">
                          Rs {posDeliveryQuote.tax.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          Delivery
                          {posDeliveryQuote.feeMode === 'distance' &&
                          posDeliveryQuote.distanceKm != null
                            ? ` · ${posDeliveryQuote.distanceKm} km`
                            : ''}
                        </span>
                        <span className="tabular-nums font-medium text-foreground">
                          Rs {posDeliveryQuote.deliveryFee.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {posDeliveryQuote.message ? (
                      <p className="text-xs leading-snug text-amber-900/90">{posDeliveryQuote.message}</p>
                    ) : null}
                    {posDeliveryQuoteLoading ? (
                      <p className="text-[11px] text-muted-foreground">Updating estimate…</p>
                    ) : null}
                    <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                      <span className="text-lg font-bold text-foreground">Grand total</span>
                      <span className="text-4xl font-black tabular-nums tracking-tighter text-foreground">
                        Rs {posDeliveryQuote.total.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Could not load delivery estimate. Subtotal shown; totals finalize when you place the order.
                    </p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-4xl font-black tracking-tighter text-foreground">
                        Rs {subtotal.toFixed(2)}
                      </span>
                    </div>
                  </>
                )
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-black tracking-tighter text-foreground">
                    Rs {subtotal}.00
                  </span>
                </div>
              )}
            </div>
            <div className="mb-4 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Order intake
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border p-1">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${orderIntake === 'counter' ? 'bg-primary text-white' : 'text-slate-600'}`}
                  onClick={() => setOrderIntake('counter')}
                >
                  Counter
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${orderIntake === 'phone' ? 'bg-primary text-white' : 'text-slate-600'}`}
                  onClick={() => setOrderIntake('phone')}
                >
                  Phone call
                </button>
              </div>
            </div>
            <div className="mb-4 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Fulfillment
              </label>
              <div className="grid grid-cols-3 gap-2 rounded-xl border p-1">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${fulfillmentType === 'takeaway' ? 'bg-primary text-white' : 'text-slate-600'}`}
                  onClick={() => setFulfillmentType('takeaway')}
                >
                  Takeaway
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${fulfillmentType === 'dine_in' ? 'bg-primary text-white' : 'text-slate-600'}`}
                  onClick={() => setFulfillmentType('dine_in')}
                >
                  Dine in
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${fulfillmentType === 'delivery' ? 'bg-primary text-white' : 'text-slate-600'}`}
                  onClick={() => setFulfillmentType('delivery')}
                >
                  Delivery
                </button>
              </div>
            </div>
            {fulfillmentType === 'dine_in' ? (
              <div className="mb-4 grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Table number
                </label>
                <input
                  type="text"
                  className="h-10 rounded-xl border bg-white px-3 text-sm"
                  placeholder="e.g. T12"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
              </div>
            ) : null}
            {fulfillmentType === 'delivery' ? (
              <div className="mb-4 grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Delivery address
                </label>
                <input
                  type="text"
                  className="h-10 rounded-xl border bg-white px-3 text-sm"
                  placeholder="House no, street, area"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>
            ) : null}
            <div className="mb-4 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Customer name (optional)
              </label>
              <input
                type="text"
                className="h-10 rounded-xl border bg-white px-3 text-sm"
                placeholder="Walk-in customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="mb-4 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Phone number
                {orderIntake === 'phone' ? (
                  <span className="normal-case text-amber-700">
                    {' '}
                    (required for phone orders, {MIN_PHONE_DIGITS}–{MAX_PHONE_DIGITS} digits)
                  </span>
                ) : (
                  <span className="font-normal normal-case text-muted-foreground"> (optional)</span>
                )}
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="tel"
                  className="h-10 rounded-xl border bg-white px-3 text-sm"
                  placeholder="07XXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={customerLookupLoading || phoneDigits(customerPhone).length < MIN_PHONE_DIGITS}
                  onClick={() => void lookupCustomerByPhone()}
                >
                  {customerLookupLoading ? 'Looking up...' : 'Lookup'}
                </Button>
              </div>
              {customerLookupMeta ? (
                <p className="text-xs text-muted-foreground">{customerLookupMeta}</p>
              ) : null}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border p-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-black ${paymentMethod === 'CASH' ? 'bg-primary text-white' : 'text-slate-600'}`}
                onClick={() => setPaymentMethod('CASH')}
              >
                {cashPaymentLabel}
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-xs font-black ${
                  paymentMethod === 'CARD'
                    ? 'bg-primary text-white'
                    : cardPaymentsEnabled
                      ? 'text-slate-600'
                      : 'cursor-not-allowed text-slate-300'
                }`}
                onClick={() => {
                  if (!cardPaymentsEnabled) {
                    toast.info('Card payments are disabled in admin settings.');
                    return;
                  }
                  setPaymentMethod('CARD');
                }}
                disabled={!paymentSettingsLoaded || !cardPaymentsEnabled}
              >
                {orderIntake === 'phone'
                  ? fulfillmentType === 'delivery'
                    ? 'Card on delivery'
                    : 'Card on pickup'
                  : 'Card'}
              </button>
            </div>
            {!paymentSettingsLoaded ? (
              <p className="mb-3 text-xs text-muted-foreground">Loading payment settings...</p>
            ) : null}
            {paymentSettingsLoaded && !cardPaymentsEnabled ? (
              <p className="mb-3 text-xs text-amber-700">
                Card payments are disabled by admin settings.
              </p>
            ) : null}
            {orderIntake === 'phone' && fulfillmentType === 'delivery' ? (
              <p className="mb-3 text-xs text-muted-foreground">
                Phone delivery is payment-on-delivery (cash or card captured at handoff).
              </p>
            ) : null}
            {orderIntake === 'phone' && (fulfillmentType === 'takeaway' || fulfillmentType === 'dine_in') ? (
              <p className="mb-3 text-xs text-muted-foreground">
                Phone order is payment-on-pickup (cash or card captured on collection).
              </p>
            ) : null}

            <Button
              type="button"
              onClick={handleCheckout}
              disabled={!canSubmitOrder}
              size="lg"
              className="h-auto w-full rounded-2xl py-5 text-xl font-black shadow-xl"
            >
              <CreditCard size={24} />
              {submittingOrder
                ? 'QUEUING...'
                : orderIntake === 'phone'
                  ? 'PLACE PHONE ORDER'
                  : `PROCESS ${paymentMethod}`}
            </Button>
            {cart.length === 0 ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Add items to enable order placement.
              </p>
            ) : null}
            {syncFeedback ? (
              <p
                className={`mt-2 text-center text-xs ${
                  syncFeedback.type === 'error'
                    ? 'text-red-600'
                    : syncFeedback.type === 'success'
                      ? 'text-emerald-700'
                      : 'text-muted-foreground'
                }`}
              >
                {syncFeedback.message}
              </p>
            ) : null}
          </div>
        </aside>
      </main>

      <footer className="border-t border-border bg-card p-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          © 2024 Wrap & Roll • Store 5012 • Cashier Terminal
        </p>
      </footer>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent
          showCloseButton
          className="overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-2xl sm:rounded-[28px]"
        >
          <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              Item Info
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Quick prep and ingredient guide
            </p>
          </DialogHeader>
          {infoLoading ? (
            <div className="px-8 py-10">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : !selectedInfo ? (
            <div className="px-8 py-10">
              <p className="text-sm text-muted-foreground">
                Info is unavailable for this item.
              </p>
            </div>
          ) : (
            <div className="space-y-5 bg-neutral-50/40 px-6 py-6 sm:px-8 sm:py-7">
              <div className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                    {selectedInfo.categoryName}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    Kitchen insight
                  </span>
                </div>
                <p className="font-display text-2xl font-black text-neutral-900">{selectedInfo.name}</p>
                <p className="mt-2 text-sm text-neutral-600">
                  Prep ~{selectedInfo.prepTimeMinutes} min (category avg ~{selectedInfo.categoryAveragePrepTimeMinutes} min)
                </p>
              </div>

              <div>
                {selectedInfo.nutritionTags.length ? (
                  <>
                    <p className="mb-2 text-sm font-semibold text-neutral-800">Nutrition Tags</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedInfo.nutritionTags.map((tag) => {
                        const Icon = tagIcon(tag.key);
                        return (
                          <span
                            key={`${tag.key}-${tag.label}`}
                            className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-neutral-700"
                          >
                            <Icon size={12} />
                            {tag.label}
                          </span>
                        );
                      })}
                    </div>
                  </>
                ) : null}
                <p className="mb-2 text-sm font-semibold text-neutral-800">Ingredient Highlights</p>
                {selectedInfo.ingredientHighlights.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedInfo.ingredientHighlights.map((ing) => (
                      <span
                        key={ing}
                        className="rounded-full border bg-white px-3 py-1 text-[11px] font-semibold text-neutral-700"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No highlights available.</p>
                )}
              </div>

              {selectedInfo.modifierIngredientImpacts?.length ? (
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <p className="mb-2 text-sm font-semibold text-neutral-800">
                    Modifier ingredient impact
                  </p>
                  <div className="space-y-2">
                    {selectedInfo.modifierIngredientImpacts.map((impact) => (
                      <p key={impact.optionLabel} className="text-sm text-neutral-700">
                        <span className="font-semibold">{impact.optionLabel}:</span>{' '}
                        {impact.ingredients.join(', ')}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="mb-2 text-sm font-semibold text-neutral-800">Tips</p>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-600">
                  {selectedInfo.healthTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[88vh] flex-col overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-2xl sm:rounded-[28px]"
        >
          <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              {productToCustomize?.name ?? 'Customize item'}
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Select options and notes
            </p>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col bg-neutral-50/40">
            <div className="border-b border-neutral-100 bg-white/90 px-6 py-3 sm:px-8">
              <div className="grid grid-cols-2 gap-2 rounded-xl border p-1">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${
                    customizeTab === 'options' ? 'bg-primary text-white' : 'text-slate-600'
                  }`}
                  onClick={() => setCustomizeTab('options')}
                >
                  Options
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-xs font-black ${
                    customizeTab === 'notes' ? 'bg-primary text-white' : 'text-slate-600'
                  }`}
                  onClick={() => setCustomizeTab('notes')}
                >
                  Notes
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 pb-4 sm:px-8 sm:py-7">
              {customizeTab === 'options' ? (
                (productToCustomize?.modifierGroups ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No optional add-ons for this item.
                  </p>
                ) : (
                  (productToCustomize?.modifierGroups ?? []).map((g) => (
                    <div key={g.groupId} className="rounded-2xl border bg-white p-5 shadow-sm">
                      <p className="mb-3 text-sm font-semibold text-neutral-800">
                        {g.name} {g.required ? '(required)' : '(optional)'}
                      </p>
                      <div className="grid gap-2">
                        {g.type === 'single' && !g.required ? (
                          <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                              type="radio"
                              name={g.groupId}
                              checked={(selectedByGroup[g.groupId] ?? []).length === 0}
                              onChange={() =>
                                setSelectedByGroup((prev) => ({ ...prev, [g.groupId]: [] }))
                              }
                            />
                            <span>No selection</span>
                          </label>
                        ) : null}
                        {g.options.map((o) => {
                          const checked = (selectedByGroup[g.groupId] ?? []).includes(
                            o.optionId,
                          );
                          return (
                            <label
                              key={o.optionId}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type={g.type === 'single' ? 'radio' : 'checkbox'}
                                name={g.groupId}
                                checked={checked}
                                onChange={() =>
                                  toggleOption(g.groupId, o.optionId, g.type)
                                }
                              />
                              <span>
                                {o.label}
                                {Number(o.priceAdjust ?? 0) > 0
                                  ? ` (+Rs ${Number(o.priceAdjust).toFixed(2)})`
                                  : ''}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className="grid gap-2 rounded-2xl border bg-white p-5 shadow-sm">
                  <label className="text-sm font-semibold text-neutral-800">
                    Item notes (optional)
                  </label>
                  <textarea
                    className="min-h-[140px] rounded-xl border p-2 text-sm"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="No onions, extra spicy, cut in half..."
                  />
                </div>
              )}
              {customizeTab === 'options' ? (
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <p className="mb-2 text-sm font-semibold text-neutral-800">
                    Selected option ingredient impact
                  </p>
                  {customizeImpactLoading ? (
                    <p className="text-sm text-muted-foreground">Loading impact data...</p>
                  ) : selectedModifierIngredientImpacts.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedModifierIngredientImpacts.map((impact) => (
                        <p key={impact.optionLabel} className="text-sm text-neutral-700">
                          <span className="font-semibold">{impact.optionLabel}:</span>{' '}
                          {impact.ingredients.join(', ')}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Choose options to see ingredient impact.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="border-t border-neutral-100 bg-white px-6 py-4 sm:px-8">
              <Button onClick={addCustomizedItem} className="h-11 w-full text-base font-black">
                Add to cart · Rs {customizeTotal.toFixed(2)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={supportViewOpen} onOpenChange={setSupportViewOpen}>
        <DialogContent
          showCloseButton
          className="max-h-[88vh] overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-2xl sm:rounded-[28px]"
        >
          <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              Order details
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Support desk order profile
            </p>
          </DialogHeader>
          {supportDetailsLoading ? (
            <div className="px-8 py-10">
              <p className="text-sm text-muted-foreground">Loading order details...</p>
            </div>
          ) : !selectedSupportOrder ? (
            <div className="px-8 py-10">
              <p className="text-sm text-muted-foreground">
                {supportError || 'Order details unavailable.'}
              </p>
            </div>
          ) : (
            <div className="flex max-h-[calc(88vh-98px)] flex-col bg-neutral-50/40">
              <div className="border-b border-neutral-100 bg-white/90 px-6 py-3 sm:px-8">
                {(() => {
                  const isDineIn = selectedSupportOrder.fulfillmentType === 'dine_in';
                  const savedTable = String(selectedSupportOrder.tableNumber ?? '');
                  const tableDirty = counterTableDraft !== savedTable;
                  const showCounterCollect = selectedSupportOrder.paymentStatus === 'pending';
                  const cashBusy = Boolean(cashCollectLoading[selectedSupportOrder.id]);
                  return (
                    <div className="mb-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                        At the counter
                      </p>
                      {isDineIn ? (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                          <div className="grid min-w-[140px] flex-1 gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Table number
                            </label>
                            <input
                              type="text"
                              className="h-10 rounded-xl border bg-white px-3 text-sm"
                              placeholder="e.g. T12"
                              value={counterTableDraft}
                              onChange={(e) => setCounterTableDraft(e.target.value)}
                              autoComplete="off"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="h-10 sm:shrink-0"
                            disabled={!tableDirty || counterTableSaving}
                            onClick={() => void saveCounterTableOnly()}
                          >
                            {counterTableSaving ? 'Saving…' : 'Save table'}
                          </Button>
                        </div>
                      ) : null}
                      <div
                        className={`mt-3 flex flex-wrap gap-2 ${isDineIn ? 'pt-1' : ''}`}
                      >
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 font-semibold"
                          onClick={() => {
                            openBrowserPrintBill(selectedSupportOrder);
                          }}
                        >
                          Print bill
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => void downloadThermalReceipt(selectedSupportOrder.id)}
                        >
                          Thermal receipt (.bin)
                        </Button>
                      </div>
                      {showCounterCollect ? (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-primary/10 pt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-9"
                            disabled={cashBusy}
                            onClick={() =>
                              void collectAtCounterAndRefreshSupport(selectedSupportOrder.id, 'cash')
                            }
                          >
                            {cashBusy ? 'Recording…' : 'Collect cash'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9"
                            disabled={cashBusy}
                            onClick={() =>
                              void collectAtCounterAndRefreshSupport(selectedSupportOrder.id, 'card')
                            }
                          >
                            Collect card
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-3 gap-2 rounded-xl border p-1">
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-black ${
                      supportViewTab === 'summary' ? 'bg-primary text-white' : 'text-slate-600'
                    }`}
                    onClick={() => setSupportViewTab('summary')}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-black ${
                      supportViewTab === 'items' ? 'bg-primary text-white' : 'text-slate-600'
                    }`}
                    onClick={() => setSupportViewTab('items')}
                  >
                    Items
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-black ${
                      supportViewTab === 'totals' ? 'bg-primary text-white' : 'text-slate-600'
                    }`}
                    onClick={() => setSupportViewTab('totals')}
                  >
                    Totals
                  </button>
                </div>
              </div>
              <div className="space-y-5 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
                <div className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                      {String(selectedSupportOrder.fulfillmentType ?? '-').replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      {selectedSupportOrder.status}
                    </span>
                  </div>
                  <p className="font-display text-xl font-black text-neutral-900">
                    #{String(selectedSupportOrder.id).slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">Source: {selectedSupportOrder.source}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                      Payment {selectedSupportOrder.paymentMethod}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 font-semibold ${
                        selectedSupportOrder.paymentStatus === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : selectedSupportOrder.paymentStatus === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedSupportOrder.paymentStatus}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                      {formatPaymentCollectionLabel(selectedSupportOrder.paymentCollection ?? 'immediate')}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                      {selectedSupportOrder.items.length} item
                      {selectedSupportOrder.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {supportViewTab === 'summary' ? (
                  <div className="grid gap-2 rounded-2xl border bg-white p-5 shadow-sm text-sm">
                    <p className="mb-1 text-sm font-semibold text-neutral-800">Customer & fulfillment</p>
                    <p>
                      <strong>Customer:</strong> {selectedSupportOrder.customer?.name || 'Guest'}{' '}
                      {selectedSupportOrder.customer?.phone
                        ? `(${selectedSupportOrder.customer.phone})`
                        : ''}
                    </p>
                    <p>
                      <strong>Address:</strong> {selectedSupportOrder.deliveryAddress || '-'}
                    </p>
                    <p>
                      <strong>Table:</strong> {selectedSupportOrder.tableNumber || '-'}
                    </p>
                    <p>
                      <strong>Scheduled:</strong>{' '}
                      {selectedSupportOrder.estimatedReadyTime
                        ? new Date(selectedSupportOrder.estimatedReadyTime).toLocaleString()
                        : 'ASAP'}
                    </p>
                    <p>
                      <strong>Placed:</strong>{' '}
                      {selectedSupportOrder.placedAt
                        ? new Date(selectedSupportOrder.placedAt).toLocaleString()
                        : '-'}
                    </p>
                    <p>
                      <strong>Updated:</strong>{' '}
                      {selectedSupportOrder.updatedAt
                        ? new Date(selectedSupportOrder.updatedAt).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                ) : null}

                {supportViewTab === 'items' ? (
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <p className="mb-2 text-sm font-semibold text-neutral-800">Items purchased</p>
                    <div className="space-y-3">
                      {selectedSupportOrder.items.map((it) => {
                        const modifierLines = getOrderItemModifierDisplayLines(it.modifiers);
                        return (
                          <div key={it.id}>
                            <p className="text-sm text-neutral-700">
                              {it.quantity}x {it.name} - Rs {Number(it.lineTotal).toFixed(2)}
                            </p>
                            {modifierLines.length > 0 ? (
                              <div className="mt-1.5 border-l-2 border-neutral-200 pl-3 text-xs text-neutral-600">
                                {modifierLines.map((line, idx) => (
                                  <p
                                    key={`${it.id}-m-${idx}`}
                                    className={
                                      isModifierLinePriority(line.label)
                                        ? 'font-semibold text-amber-800'
                                        : undefined
                                    }
                                  >
                                    {line.label}: {line.value}
                                  </p>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {supportViewTab === 'totals' ? (
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <p className="mb-2 text-sm font-semibold text-neutral-800">Totals</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p className="text-neutral-600">Subtotal</p>
                      <p className="text-right font-semibold">
                        Rs {Number((selectedSupportOrder as any).subtotal ?? 0).toFixed(2)}
                      </p>
                      <p className="text-neutral-600">Discount</p>
                      <p className="text-right font-semibold">
                        Rs {Number((selectedSupportOrder as any).discountAmount ?? 0).toFixed(2)}
                      </p>
                      <p className="text-neutral-600">Tax</p>
                      <p className="text-right font-semibold">
                        Rs {Number((selectedSupportOrder as any).tax ?? 0).toFixed(2)}
                      </p>
                      <p className="text-neutral-600">Delivery fee</p>
                      <p className="text-right font-semibold">
                        Rs {Number((selectedSupportOrder as any).deliveryFee ?? 0).toFixed(2)}
                      </p>
                      <p className="font-semibold text-neutral-900">Grand total</p>
                      <p className="text-right font-black text-neutral-900">
                        Rs {Number((selectedSupportOrder as any).total ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={supportEditOpen} onOpenChange={setSupportEditOpen}>
        <DialogContent
          showCloseButton
          className="overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-2xl sm:rounded-[28px]"
        >
          <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              Support order details
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Update customer and fulfillment details
            </p>
          </DialogHeader>
          <div className="space-y-5 bg-neutral-50/40 px-6 py-6 sm:px-8 sm:py-7">
            {selectedSupportOrder ? (
              <div className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm text-xs">
                <p className="font-semibold">
                  {String(selectedSupportOrder.id).slice(0, 8).toUpperCase()} •{' '}
                  {selectedSupportOrder.status} • {selectedSupportOrder.paymentMethod}/
                  {selectedSupportOrder.paymentStatus}
                </p>
                <p className="text-muted-foreground">
                  Placed:{' '}
                  {selectedSupportOrder.placedAt
                    ? new Date(selectedSupportOrder.placedAt).toLocaleString()
                    : '-'}
                </p>
                <p className="text-muted-foreground">
                  Scheduled:{' '}
                  {selectedSupportOrder.estimatedReadyTime
                    ? new Date(selectedSupportOrder.estimatedReadyTime).toLocaleString()
                    : 'ASAP'}
                </p>
                <div className="mt-2 space-y-2">
                  <p className="font-semibold text-foreground">Purchased items</p>
                  {selectedSupportOrder.items.map((it) => {
                    const modifierLines = getOrderItemModifierDisplayLines(it.modifiers);
                    return (
                      <div key={it.id}>
                        <p>
                          {it.quantity}x {it.name} - Rs {Number(it.lineTotal).toFixed(2)}
                        </p>
                        {modifierLines.length > 0 ? (
                          <div className="mt-1 border-l-2 border-neutral-200 pl-2 text-[11px] text-muted-foreground">
                            {modifierLines.map((line, idx) => (
                              <p
                                key={`${it.id}-m-${idx}`}
                                className={
                                  isModifierLinePriority(line.label)
                                    ? 'font-semibold text-amber-800'
                                    : undefined
                                }
                              >
                                {line.label}: {line.value}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm">
              <input
                className="h-10 w-full rounded-xl border px-3 text-sm"
                placeholder="Customer name"
                value={supportEditName}
                onChange={(e) => setSupportEditName(e.target.value)}
              />
              <input
                className="h-10 w-full rounded-xl border px-3 text-sm"
                placeholder="Customer phone"
                value={supportEditPhone}
                onChange={(e) => setSupportEditPhone(e.target.value)}
              />
              <input
                className="h-10 w-full rounded-xl border px-3 text-sm"
                placeholder="Delivery address (if delivery)"
                value={supportEditAddress}
                onChange={(e) => setSupportEditAddress(e.target.value)}
              />
              <input
                className="h-10 w-full rounded-xl border px-3 text-sm"
                placeholder="Table number (dine in)"
                value={supportEditTable}
                onChange={(e) => setSupportEditTable(e.target.value)}
              />
              <input
                type="datetime-local"
                className="h-10 w-full rounded-xl border px-3 text-sm"
                value={supportEditSchedule}
                onChange={(e) => setSupportEditSchedule(e.target.value)}
              />
            </div>
            <Button
              onClick={async () => {
                if (!supportEditOrder) return;
                setSupportSaving(true);
                const saveRes = await fetchProtectedNest(`/api/nest/orders/${supportEditOrder.id}/support`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    customerName: supportEditName,
                    customerPhone: supportEditPhone,
                    deliveryAddress: supportEditAddress,
                    tableNumber: supportEditTable,
                    estimatedReadyTime: supportEditSchedule
                      ? new Date(supportEditSchedule).toISOString()
                      : null,
                    note: 'Updated from cashier support desk',
                  }),
                });
                if (saveRes.ok) {
                  const body = await saveRes.json().catch(() => null);
                  if (body) patchQueueOrderRowsFromApi(supportEditOrder.id, body);
                }
                void refreshOpsQueueAfterAction({ withRecon: false });
                const refreshed = await openSupportOrder(supportEditOrder.id);
                if (refreshed) {
                  setSupportEditName(refreshed.customer?.name ?? '');
                  setSupportEditPhone(refreshed.customer?.phone ?? '');
                  setSupportEditAddress(refreshed.deliveryAddress ?? '');
                  setSupportEditTable(refreshed.tableNumber ?? '');
                  setSupportEditSchedule(
                    refreshed.estimatedReadyTime
                      ? new Date(refreshed.estimatedReadyTime).toISOString().slice(0, 16)
                      : '',
                  );
                }
                await runSupportSearch();
                setSupportSaving(false);
              }}
              className="w-full"
              disabled={supportSaving}
            >
              {supportSaving ? 'Saving...' : 'Save support update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </OpsLayout>
  );
}
