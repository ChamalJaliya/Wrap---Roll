'use client';

import { useCallback, useEffect, useMemo, useRef, startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePosStore, type CartItem } from '../store/usePosStore';
import { useSupervisorStore } from '../store/useSupervisorStore';
import { ManagerToolsNav } from '../components/ManagerToolsNav';
import { PosSidebarClock } from '../components/PosSidebarClock';
import {
  CashTenderDialog,
  appendCashTenderAuditToNote,
  type CashTenderConfirmDetail,
} from '../components/pos/CashTenderDialog';
import { CardCollectConfirmDialog } from '../components/pos/CardCollectConfirmDialog';
import {
  PosCalculatorDialog,
  type PosCalculatorQuickAmounts,
} from '../components/pos/PosCalculatorDialog';
import { PrivilegedManualDiscount } from '../components/privileged/PrivilegedManualDiscount';
import { computeLiveManualDiscountRs } from '../lib/manual-discount-placement';
import { useSupervisorExpiryWatcher } from '../hooks/useSupervisorExpiryWatcher';
import { useCashierQueueAlerts } from '../hooks/useCashierQueueAlerts';
import {
  Wifi,
  WifiOff,
  ShoppingCart,
  Trash2,
  CreditCard,
  RefreshCw,
  Search,
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
  PanelLeftClose,
  ChevronsRight,
  Users,
  PencilLine,
  Calculator as CalculatorIcon,
  Bell,
  BellOff,
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
  SupportOrderItem,
} from '@wrap-roll/contracts';
import {
  CASHIER_RESOLVE_ORDER_QUERY,
  computeCheckoutBreakdown,
  formatPersistedDiscountCaption,
  formatPaymentCollectionDisplayLabel,
  formatPaymentStatusDisplayLabel,
  normalizeCheckoutVatRate,
  ORDER_FLOW_BOARD_STATUSES,
  mergeQueueOrderFromApiPatch,
  evaluateLineItemReplacementPolicy,
  type CashierOrderSyncPayload,
} from '@wrap-roll/contracts';
import {
  getOrderItemModifierDisplayLines,
  isModifierLinePriority,
  useQueueDirtyStream,
  cashierPayloadToWrapOrderItems,
  queueOrderLinesToCashierInputs,
} from '@wrap-roll/order-kit';
import { pendingPlacementQueueIds } from '../lib/checkout-placement';
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
  imageUrl?: string;
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

function reconSummaryMethodLabel(method: string): string {
  if (method === 'pay_at_collection') return 'Pay at collection';
  return method;
}

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

function nextUpHeadlineWhenNoSpecificRule(order: OpsQueueOrder): string {
  switch (order.status) {
    case 'placed':
      return 'Order placed — in progress';
    case 'paid':
      return 'Paid — in progress';
    case 'in_kitchen':
      return 'In kitchen';
    case 'ready':
      return 'Ready';
    case 'in_transit':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered — payment may still be open';
    default:
      return `Order · ${String(order.status)}`;
  }
}

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

  /** Until delivered + payment completed, always show on Next up — specific rules above win when they apply. */
  if (rules.length === 0) {
    rules.push({
      score: 55,
      headline: nextUpHeadlineWhenNoSpecificRule(order),
      detail:
        'Every active order stays here until it is delivered and payment is completed. Use Move to advance each stage.',
    });
  }
  rules.sort((a, b) => a.score - b.score);
  const best = rules[0];
  return { order, score: best.score, headline: best.headline, detail: best.detail };
}

/** Lane for filtering + card tint — one bucket per order */
function nextUpLane(order: OpsQueueOrder): 'payment' | 'prep' | 'ready' | 'en_route' {
  const st = order.status;
  if (st === 'ready') return 'ready';
  if (st === 'in_transit') return 'en_route';

  const pm = String(order.paymentMethod ?? '').toLowerCase();
  const paymentAttention =
    order.paymentStatus === 'failed' ||
    (order.paymentStatus === 'pending' && ['card', 'payhere', 'online'].includes(pm)) ||
    (pm === 'cash' &&
      order.paymentStatus === 'pending' &&
      ['placed', 'paid', 'in_kitchen'].includes(st)) ||
    (pm === 'cash' &&
      order.paymentStatus !== 'completed' &&
      ['ready', 'delivered', 'in_transit'].includes(st)) ||
    (st === 'delivered' && order.paymentStatus !== 'completed' && pm !== 'cash');

  if (paymentAttention) return 'payment';

  return 'prep';
}

function attentionCardFrameClass(
  score: number,
  lane: ReturnType<typeof nextUpLane>,
): string {
  if (score <= 22) {
    return 'border-2 border-red-400 bg-red-50 shadow-sm shadow-red-200/50';
  }
  if (score <= 40) {
    return 'border-2 border-amber-400 bg-amber-50 shadow-sm shadow-amber-200/40';
  }
  switch (lane) {
    case 'payment':
      return 'border-2 border-violet-400 bg-violet-50/95 shadow-sm shadow-violet-200/35';
    case 'prep':
      return 'border-2 border-orange-300 bg-orange-50/90 shadow-sm shadow-orange-200/30';
    case 'ready':
      return 'border-2 border-lime-400 bg-lime-50/90 shadow-sm shadow-lime-200/35';
    case 'en_route':
      return 'border-2 border-sky-400 bg-sky-50/95 shadow-sm shadow-sky-200/35';
    default:
      return 'border-2 border-zinc-200 bg-zinc-50 shadow-sm';
  }
}

function nextUpLaneBadgeClass(lane: ReturnType<typeof nextUpLane>): string {
  switch (lane) {
    case 'payment':
      return 'bg-violet-600 text-white';
    case 'prep':
      return 'bg-orange-600 text-white';
    case 'ready':
      return 'bg-lime-700 text-white';
    case 'en_route':
      return 'bg-sky-600 text-white';
    default:
      return 'bg-zinc-600 text-white';
  }
}

const NEXT_UP_LANE_LABEL: Record<'payment' | 'prep' | 'ready' | 'en_route', string> = {
  payment: 'Payment',
  prep: 'Prep',
  ready: 'Ready',
  en_route: 'En route',
};

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

const PRINT_LETTERHEAD_FALLBACK_LINES = ['Gourmet street food'] as const;

/** Matches API receipt letterhead: address lines + phone + email from public settings */
function parseLetterheadFromPublicSettings(data: PublicBusinessSettings): {
  businessName: string;
  lines: string[];
} {
  const bn = String(data.businessName ?? '').trim();
  const lhLines: string[] = [];
  const al1 = String(data.addressLine1 ?? '').trim();
  const al2 = String(data.addressLine2 ?? '').trim();
  if (al1) lhLines.push(al1);
  if (al2) lhLines.push(al2);
  const cp = String(data.contactPhone ?? '').trim();
  if (cp) lhLines.push(cp);
  const ce = String(data.contactEmail ?? '').trim();
  if (ce) lhLines.push(ce);
  return {
    businessName: bn || 'Wrap & Roll',
    lines:
      lhLines.length > 0 ? lhLines : [...PRINT_LETTERHEAD_FALLBACK_LINES],
  };
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
  /** When set, "Add to cart" becomes "Update line" for this cart row. */
  const [customizingCartId, setCustomizingCartId] = useState<string | null>(null);
  const [productToCustomize, setProductToCustomize] = useState<ProductRow | null>(null);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [itemNotes, setItemNotes] = useState('');
  const [customizeTab, setCustomizeTab] = useState<'options' | 'notes'>('options');
  const [customizeImpactLoading, setCustomizeImpactLoading] = useState(false);
  const [customizeOptionImpacts, setCustomizeOptionImpacts] = useState<
    Record<string, string[]>
  >({});
  const [paymentMethod, setPaymentMethod] = useState<CashierPaymentMethod>('CASH');
  /** Counter walk-in: pay at submit vs pay when collecting (kitchen can run first). Phone orders use phone-specific payment timing. */
  const [counterPaymentTiming, setCounterPaymentTiming] = useState<'now' | 'later'>('now');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false);
  const [paymentSettingsLoaded, setPaymentSettingsLoaded] = useState(false);
  const [cashTenderOpen, setCashTenderOpen] = useState(false);
  const [posCalculatorOpen, setPosCalculatorOpen] = useState(false);
  const [requireSupervisorForCardCollection, setRequireSupervisorForCardCollection] =
    useState(false);
  const [pendingCardCollect, setPendingCardCollect] = useState<{
    orderId: string;
    total: number;
  } | null>(null);
  const cardCollectAfterRef = useRef<(() => void | Promise<unknown>) | undefined>(undefined);
  const [pendingCashCollect, setPendingCashCollect] = useState<{
    orderId: string;
    total: number;
  } | null>(null);
  const cashCollectAfterRef = useRef<(() => void | Promise<unknown>) | undefined>(undefined);
  /** Counter Pay now — confirm cash/card before `pay()` (same discipline as collect-on-order). */
  const [checkoutPayNowConfirm, setCheckoutPayNowConfirm] = useState<
    null | 'cash' | 'card'
  >(null);
  /** Checkout VAT from admin public settings (`/settings`); matches order placement. */
  const [checkoutVatRate, setCheckoutVatRate] = useState(() =>
    normalizeCheckoutVatRate(undefined),
  );
  /** Matches API `resolveReceiptLetterhead` — from GET /settings for Print bill HTML */
  const [printLetterhead, setPrintLetterhead] = useState<{
    businessName: string;
    lines: string[];
  } | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponApplyLoading, setCouponApplyLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const supervisorElevation = useSupervisorStore((s) => s.elevation);
  const supervisorEmailInput = useSupervisorStore((s) => s.supervisorEmailInput);
  const manualDiscountInput = useSupervisorStore((s) => s.manualDiscountInput);
  const setManualDiscountInput = useSupervisorStore((s) => s.setManualDiscountInput);
  const resetSupervisorAfterCartCleared = useSupervisorStore((s) => s.resetAfterCartCleared);
  const resetSupervisorAll = useSupervisorStore((s) => s.resetAll);
  useSupervisorExpiryWatcher();
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
  const [lineAmendOrderId, setLineAmendOrderId] = useState<string | null>(null);
  const [lineAmendSource, setLineAmendSource] = useState<OpsQueueOrder | null>(null);
  const [lineAmendOverrideReason, setLineAmendOverrideReason] = useState('');
  const [lineAmendSaving, setLineAmendSaving] = useState(false);
  const [selectedSupportOrder, setSelectedSupportOrder] = useState<SupportOrderDetails | null>(null);
  const [supportDetailsLoading, setSupportDetailsLoading] = useState(false);
  const [supportViewOpen, setSupportViewOpen] = useState(false);
  const [supportViewTab, setSupportViewTab] = useState<'summary' | 'items' | 'totals'>('summary');
  const [counterTableDraft, setCounterTableDraft] = useState('');
  const [counterTableSaving, setCounterTableSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'pos' | 'orders' | 'ops' | 'clients'>('pos');
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [queueAlertSound, setQueueAlertSound] = useState(true);
  const [ordersSettlementTab, setOrdersSettlementTab] = useState<'on_process' | 'completed'>(
    'on_process',
  );
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [reconDate, setReconDate] = useState<string | null>(null);
  const [businessToday, setBusinessToday] = useState<string | null>(null);
  const [reconSummary, setReconSummary] = useState<ReconciliationSummary | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [opsBoardView, setOpsBoardView] = useState<'attention' | 'order' | 'payment'>('attention');
  const [nextUpLaneFilter, setNextUpLaneFilter] = useState<
    'all' | 'payment' | 'prep' | 'ready' | 'en_route'
  >('all');
  const [cashCollectLoading, setCashCollectLoading] = useState<Record<string, boolean>>({});
  const [posDeliveryQuote, setPosDeliveryQuote] = useState<PosDeliveryQuote | null>(null);
  const [posDeliveryQuoteLoading, setPosDeliveryQuoteLoading] = useState(false);
  const queueRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const queueRefreshPendingRef = useRef(false);
  const cashierResolveConsumedRef = useRef(false);
  /** Latest-wins for `openSupportOrder` (rapid clicks / effect races). */
  const supportDetailRequestSeq = useRef(0);
  const {
    cart,
    addItem,
    updateCartLine,
    incrementItem,
    decrementItem,
    removeItem,
    pay,
    clearCart,
    loadCartForAmend,
  } = usePosStore();

  const selectedSupportDiscountCaption = useMemo(
    () =>
      selectedSupportOrder
        ? formatPersistedDiscountCaption({
            discountCode: selectedSupportOrder.discountCode ?? null,
            discountAmount: selectedSupportOrder.discountAmount ?? 0,
          })
        : '',
    [selectedSupportOrder],
  );

  const beginAmendOrderLines = (order: OpsQueueOrder) => {
    const gate = evaluateLineItemReplacementPolicy(
      {
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentType: order.fulfillmentType ?? 'takeaway',
      },
      String(cashierProfile?.role ?? 'CASHIER'),
    );
    if (!gate.allowed) {
      toast.error(
        order.actions?.lineReplaceBlockedMessage ??
          ('message' in gate ? gate.message : 'Line items cannot be edited now.'),
      );
      return;
    }
    if (!order.items || order.items.length === 0) {
      toast.error('No line items on this order.');
      return;
    }
    try {
      loadCartForAmend(
        queueOrderLinesToCashierInputs(order.items as NonNullable<QueueOrder['items']>),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load lines into cart.');
      return;
    }
    setLineAmendOrderId(order.id);
    setLineAmendSource(order);
    setLineAmendOverrideReason('');
    setActiveTab('pos');
    toast.message('Lines loaded — adjust the cart, then tap Save line changes.');
  };

  const lineAmendNeedsAdminReason =
    Boolean(lineAmendSource && cashierProfile?.role === 'ADMIN') &&
    !evaluateLineItemReplacementPolicy(
      {
        status: lineAmendSource?.status ?? 'placed',
        paymentStatus: lineAmendSource?.paymentStatus ?? 'pending',
        fulfillmentType: lineAmendSource?.fulfillmentType ?? 'takeaway',
      },
      'CASHIER',
    ).allowed;

  /** Clear cart + checkout fields after the order is accepted (server 201 or offline queue write). */
  const finalizePlacementAfterAccept = useCallback(() => {
    clearCart();
    setCustomerName('');
    setCustomerPhone('');
    setTableNumber('');
    setDeliveryAddress('');
    setCustomerLookupMeta(null);
    setFulfillmentType('takeaway');
  }, [clearCart]);

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
      resetSupervisorAll();
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
              id: String(item?.id ?? ''),
              menuItemId: item?.menuItemId != null ? String(item.menuItemId) : undefined,
              name: String(item?.name ?? ''),
              quantity: Number(item?.quantity ?? 0),
              unitPrice: Number(item?.unitPrice ?? 0),
              lineTotal: Number(item?.lineTotal ?? 0),
              modifiersJson: item?.modifiersJson,
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
                canReplaceLineItems: Boolean(o.actions.canReplaceLineItems),
                lineReplaceBlockedMessage:
                  o.actions.lineReplaceBlockedMessage != null
                    ? String(o.actions.lineReplaceBlockedMessage)
                    : null,
                canEditSupportDetails:
                  o.actions.canEditSupportDetails !== undefined
                    ? Boolean(o.actions.canEditSupportDetails)
                    : true,
                supportEditBlockedMessage:
                  o.actions.supportEditBlockedMessage != null
                    ? String(o.actions.supportEditBlockedMessage)
                    : null,
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
      (activeTab === 'ops' || activeTab === 'orders') &&
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
      if (window.localStorage.getItem('cashier-queue-alert-sound') === '0') {
        setQueueAlertSound(false);
      }
    } catch {
      /* ignore */
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
      const ce = e as CustomEvent<{ duplicateOf?: string; localId?: string }>;
      if (ce.detail?.localId != null) {
        pendingPlacementQueueIds.delete(String(ce.detail.localId));
      }
      const id = ce.detail?.duplicateOf;
      toast.error(
        id
          ? `Similar order already exists (${String(id).slice(0, 8).toUpperCase()}). Removed from sync queue.`
          : 'Similar order may already exist. Removed from sync queue.',
      );
      setSubmittingOrder(false);
    };
    window.addEventListener('cashier-order-duplicate', onDup);
    return () => window.removeEventListener('cashier-order-duplicate', onDup);
  }, []);

  useEffect(() => {
    const onQueued = (e: Event) => {
      const ce = e as CustomEvent<{ offline?: boolean; localId?: string }>;
      const offline = Boolean(ce.detail?.offline);
      const lid = String(ce.detail?.localId ?? '');
      if (offline && lid && pendingPlacementQueueIds.delete(lid)) {
        finalizePlacementAfterAccept();
        toast.success('Order saved on this device — will sync when you are online.');
        setSyncFeedback({
          type: 'success',
          message: 'Saved offline — pending sync.',
        });
        setSubmittingOrder(false);
      } else if (!offline) {
        setSyncFeedback({
          type: 'info',
          message: 'Posting order…',
        });
      }
      void updatePendingCount();
    };
    const onSynced = (e: Event) => {
      const ce = e as CustomEvent<{ order?: unknown; localId?: string }>;
      const lid = String(ce.detail?.localId ?? '');
      const isCurrentCheckout = Boolean(lid && pendingPlacementQueueIds.delete(lid));

      void updatePendingCount();
      if (activeTab === 'ops' || activeTab === 'orders') {
        void refreshOpsQueueAfterAction({ withRecon: true });
      }

      if (!isCurrentCheckout) {
        return;
      }

      finalizePlacementAfterAccept();
      const raw = ce.detail?.order;
      let totalSuffix = '';
      if (raw && typeof raw === 'object') {
        const t = (raw as Record<string, unknown>).total;
        const n =
          typeof t === 'number'
            ? t
            : typeof t === 'string'
              ? parseFloat(t)
              : Number(t);
        if (Number.isFinite(n)) {
          totalSuffix = ` Total Rs ${n.toFixed(2)} (confirmed).`;
        }
      }
      toast.success(`Order placed.${totalSuffix}`);
      setSyncFeedback({
        type: 'success',
        message: 'Order saved on server.',
      });
      setSubmittingOrder(false);
      setTimeout(() => {
        setSyncFeedback((current) => (current?.type === 'success' ? null : current));
      }, 3000);
    };
    const onSyncFailed = (e: Event) => {
      const ce = e as CustomEvent<{ status?: number; reason?: string; localId?: string }>;
      if (ce.detail?.localId != null) {
        pendingPlacementQueueIds.delete(String(ce.detail.localId));
      }
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
      setSubmittingOrder(false);
      void updatePendingCount();
    };
    const onSyncDropped = (e: Event) => {
      const ce = e as CustomEvent<{ status?: number; reason?: string; localId?: string }>;
      if (ce.detail?.localId != null) {
        pendingPlacementQueueIds.delete(String(ce.detail.localId));
      }
      const reason = String(ce.detail?.reason ?? 'Order could not be posted');
      toast.error(
        `Pending order removed from sync queue: ${reason} Re-enter the order if the guest still needs it.`,
        { duration: 12_000 },
      );
      setSyncFeedback({
        type: 'error',
        message: `Dropped unsyncable order — ${reason}`,
      });
      setSubmittingOrder(false);
      void updatePendingCount();
    };
    window.addEventListener('cashier-order-queued', onQueued);
    window.addEventListener('cashier-order-synced', onSynced);
    window.addEventListener('cashier-order-sync-failed', onSyncFailed);
    window.addEventListener('cashier-order-sync-dropped', onSyncDropped);
    return () => {
      window.removeEventListener('cashier-order-queued', onQueued);
      window.removeEventListener('cashier-order-synced', onSynced);
      window.removeEventListener('cashier-order-sync-failed', onSyncFailed);
      window.removeEventListener('cashier-order-sync-dropped', onSyncDropped);
    };
  }, [activeTab, finalizePlacementAfterAccept]);

  useEffect(() => {
    if ((activeTab !== 'ops' && activeTab !== 'orders') || !reconDate) return;
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
    if ((activeTab !== 'ops' && activeTab !== 'orders') || !reconDate) return;
    if (queueLiveStatus === 'connected') return;
    // Fallback polling keeps ops board updating when SSE is reconnecting.
    const interval = setInterval(() => {
      void refreshQueueOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, reconDate, queueLiveStatus]);

  useEffect(() => {
    if (activeTab === 'ops') setOpsBoardView('attention');
  }, [activeTab]);

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
              imageUrl:
                typeof item.imageUrl === 'string'
                  ? item.imageUrl
                  : typeof item.image === 'string'
                    ? item.image
                    : typeof item.thumbnailUrl === 'string'
                      ? item.thumbnailUrl
                      : undefined,
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
          setRequireSupervisorForCardCollection(false);
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
        setRequireSupervisorForCardCollection(
          data?.paymentConfig?.pos?.requireSupervisorForCardCollection === true,
        );
        setCheckoutVatRate(normalizeCheckoutVatRate(data?.checkoutVatRate ?? undefined));
        setPrintLetterhead(parseLetterheadFromPublicSettings(data));
      } catch {
        const fallback = new Date().toISOString().slice(0, 10);
        setBusinessToday(fallback);
        setReconDate(fallback);
        setRequireSupervisorForCardCollection(false);
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

  /** Sum of line quantities (pieces) for cart badge + summaries. */
  const cartTotalPieces = cart.reduce(
    (n, item) => n + Math.max(0, Number(item.quantity) || 0),
    0,
  );

  const couponDiscountAmount = appliedCoupon?.discountAmount ?? 0;

  const manualDiscountPreview = useMemo(
    () =>
      computeLiveManualDiscountRs({
        manualDiscountInput,
        cartSubtotal: subtotal,
        couponDiscountAmount,
        elevation: supervisorElevation,
      }),
    [manualDiscountInput, subtotal, couponDiscountAmount, supervisorElevation],
  );

  const orderTotalsPreview = useMemo(
    () =>
      computeCheckoutBreakdown({
        subtotal,
        vatRate: checkoutVatRate,
        deliveryFee:
          fulfillmentType === 'delivery' && posDeliveryQuote
            ? posDeliveryQuote.deliveryFee
            : 0,
        discountAmount: couponDiscountAmount + manualDiscountPreview,
      }),
    [
      subtotal,
      checkoutVatRate,
      fulfillmentType,
      posDeliveryQuote,
      couponDiscountAmount,
      manualDiscountPreview,
    ],
  );

  /** Calculator: load POS line items into the tape from the selected support order. */
  const posCalculatorQuickAmounts = useMemo((): PosCalculatorQuickAmounts | null => {
    if (!selectedSupportOrder) return null;
    return {
      subtotal: Number(selectedSupportOrder.subtotal ?? 0),
      tax: Number(selectedSupportOrder.tax ?? 0),
      total: Number(selectedSupportOrder.total ?? 0),
      discount: Number(selectedSupportOrder.discountAmount ?? 0),
      deliveryFee: Number(selectedSupportOrder.deliveryFee ?? 0),
    };
  }, [selectedSupportOrder]);

  /** Line amendment: preview from cart lines + checkout VAT only (order-level discounts finalized on save). */
  const lineAmendTotalsPreview = useMemo(
    () =>
      computeCheckoutBreakdown({
        subtotal,
        vatRate: checkoutVatRate,
        deliveryFee: 0,
        discountAmount: 0,
      }),
    [subtotal, checkoutVatRate],
  );

  useEffect(() => {
    if (cart.length === 0) {
      setAppliedCoupon(null);
      setCouponCodeInput('');
      resetSupervisorAfterCartCleared();
    }
  }, [cart.length, resetSupervisorAfterCartCleared]);

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

  const handleApplyCoupon = async () => {
    const raw = couponCodeInput.trim();
    if (!raw || cart.length === 0) return;
    if (!isOnline) {
      toast.error('Connect to the internet to validate a coupon.');
      return;
    }
    setCouponApplyLoading(true);
    try {
      const res = await fetchProtectedNest('/api/nest/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: raw,
          subtotal,
          customerPhone: normalizeCashierPhone(customerPhone) || undefined,
        }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        discountAmount?: number;
        message?: string;
      };
      if (!res.ok || !data.valid) {
        toast.error(
          typeof data.message === 'string' ? data.message : 'Coupon could not be applied',
        );
        setAppliedCoupon(null);
        return;
      }
      const amt = Number(data.discountAmount ?? 0);
      setAppliedCoupon({ code: raw.toUpperCase(), discountAmount: amt });
      toast.success('Coupon applied');
    } catch {
      toast.error('Could not validate coupon');
      setAppliedCoupon(null);
    } finally {
      setCouponApplyLoading(false);
    }
  };

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
  const productImageByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const key = String(p.name ?? '').trim().toLowerCase();
      if (!key || !p.imageUrl) continue;
      if (!map.has(key)) map.set(key, p.imageUrl);
    }
    return map;
  }, [products]);
  const productImageById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const key = String(p.id ?? '').trim();
      if (!key || !p.imageUrl) continue;
      if (!map.has(key)) map.set(key, p.imageUrl);
    }
    return map;
  }, [products]);
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

  useCashierQueueAlerts({
    orders: queueBoardOrders,
    enabled: Boolean(cashierProfile && !authChecking && reconDate),
    scopeKey: reconDate ?? '',
    alertSoundEnabled: queueAlertSound,
  });

  const supportResultsForList = useMemo(() => {
    if (supportListFilter !== 'dine_in_needs_table') return supportResults;
    return supportResults.filter(
      (o) => o.fulfillmentType === 'dine_in' && !(o.tableNumber?.trim()),
    );
  }, [supportResults, supportListFilter]);
  /** Next up = every order not finished (delivered + payment completed). Sorted by urgency score. */
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

    return { items: rows };
  }, [queueBoardOrders]);

  const nextUpLaneCounts = useMemo(() => {
    const counts = {
      all: cashierAttentionDisplay.items.length,
      payment: 0,
      prep: 0,
      ready: 0,
      en_route: 0,
    };
    for (const item of cashierAttentionDisplay.items) {
      counts[nextUpLane(item.order)]++;
    }
    return counts;
  }, [cashierAttentionDisplay.items]);

  const nextUpFilteredItems = useMemo(() => {
    if (nextUpLaneFilter === 'all') return cashierAttentionDisplay.items;
    return cashierAttentionDisplay.items.filter(
      (item) => nextUpLane(item.order) === nextUpLaneFilter,
    );
  }, [cashierAttentionDisplay.items, nextUpLaneFilter]);

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
  const payLaterRows = useMemo(() => queueBoardOrders, [queueBoardOrders]);
  const ordersOnProcessRows = useMemo(
    () =>
      [...payLaterRows]
        .filter((o) => o.paymentStatus === 'pending' || o.paymentStatus === 'failed')
        .sort((a, b) => {
          const aPlaced = a.placedAt ? new Date(String(a.placedAt)).getTime() : 0;
          const bPlaced = b.placedAt ? new Date(String(b.placedAt)).getTime() : 0;
          return bPlaced - aPlaced;
        }),
    [payLaterRows],
  );
  const ordersCompletedRows = useMemo(
    () =>
      [...payLaterRows]
        .filter((o) => o.paymentStatus === 'completed' || o.paymentStatus === 'refunded')
        .sort((a, b) => {
          const aPlaced = a.placedAt ? new Date(String(a.placedAt)).getTime() : 0;
          const bPlaced = b.placedAt ? new Date(String(b.placedAt)).getTime() : 0;
          return bPlaced - aPlaced;
        }),
    [payLaterRows],
  );
  const ordersSettlementRows = useMemo(
    () => (ordersSettlementTab === 'on_process' ? ordersOnProcessRows : ordersCompletedRows),
    [ordersSettlementTab, ordersOnProcessRows, ordersCompletedRows],
  );
  const ordersSettlementRowsFiltered = useMemo(() => {
    const q = ordersSearchQuery.trim().toLowerCase();
    if (!q) return ordersSettlementRows;
    const queryDigits = q.replace(/\D+/g, '');
    const normalizePhoneDigits = (raw: string): string[] => {
      const digits = raw.replace(/\D+/g, '');
      if (!digits) return [];
      const variants = new Set<string>([digits]);
      // Sri Lanka-friendly variants: +94xxxxxxxxx, 94xxxxxxxxx, 0xxxxxxxxx
      if (digits.startsWith('94') && digits.length >= 11) variants.add(`0${digits.slice(2)}`);
      if (digits.startsWith('0') && digits.length >= 10) variants.add(`94${digits.slice(1)}`);
      return Array.from(variants);
    };
    return ordersSettlementRows.filter((o) => {
      const orderId = String(o.id ?? '').toLowerCase();
      const shortId = String(o.id ?? '').slice(0, 8).toLowerCase();
      const phone = String(o.customer?.phone ?? '').toLowerCase();
      if (orderId.includes(q) || shortId.includes(q) || phone.includes(q)) return true;
      if (!queryDigits) return false;
      const phoneVariants = normalizePhoneDigits(phone);
      return phoneVariants.some((candidate) => candidate.includes(queryDigits));
    });
  }, [ordersSettlementRows, ordersSearchQuery]);
  useEffect(() => {
    if (activeTab !== 'orders') return;
    if (ordersSettlementRows.length === 0) return;
    /** Clearing selection during fetch made `selectedId` empty and wrongly triggered opening row [0]. */
    if (supportDetailsLoading) return;
    const selectedId = selectedSupportOrder?.id ?? null;
    const stillVisible = selectedId ? ordersSettlementRows.some((row) => row.id === selectedId) : false;
    if (!stillVisible) {
      void openSupportOrder(ordersSettlementRows[0].id);
    }
  }, [activeTab, ordersSettlementRows, selectedSupportOrder?.id, supportDetailsLoading]);
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

  /** Orders tab: prefer queue snapshot; otherwise build from support details so amend still works. */
  const supportDetailsToAmendQueueOrder = (s: SupportOrderDetails): OpsQueueOrder => {
    const itemsFromSupport = (s.items ?? []).map((it: SupportOrderItem) => ({
      id: String(it.id),
      menuItemId: it.menuItemId != null ? String(it.menuItemId) : undefined,
      name: String(it.name ?? ''),
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unitPrice ?? 0),
      lineTotal: Number(it.lineTotal ?? 0),
      modifiersJson: it.modifiers ?? null,
    }));
    return {
      id: s.id,
      status: s.status,
      paymentStatus: s.paymentStatus,
      fulfillmentType: s.fulfillmentType,
      total: Number(s.total ?? 0),
      items: itemsFromSupport,
      actions: {
        canMove: false,
        canAssignCourier: false,
        canCollectPayment: false,
        canMarkDelivered: false,
        canVoid: false,
        canRefund: false,
      },
    } as OpsQueueOrder;
  };

  const ordersTabAmendRow = useMemo((): OpsQueueOrder | null => {
    if (!selectedSupportOrder) return null;
    const row = queueBoardOrders.find((o) => o.id === selectedSupportOrder.id);
    return row ?? supportDetailsToAmendQueueOrder(selectedSupportOrder);
  }, [selectedSupportOrder, queueBoardOrders]);

  const ordersTabAmendPolicy = useMemo(() => {
    if (!ordersTabAmendRow) return { allowed: false as const, message: null as string | null };
    return evaluateLineItemReplacementPolicy(
      {
        status: ordersTabAmendRow.status,
        paymentStatus: ordersTabAmendRow.paymentStatus,
        fulfillmentType: ordersTabAmendRow.fulfillmentType ?? 'takeaway',
      },
      String(cashierProfile?.role ?? 'CASHIER'),
    );
  }, [ordersTabAmendRow, cashierProfile?.role]);

  const resolveOrderTotalForCollect = useCallback(
    (orderId: string): number => {
      const q = queueBoardOrders.find((o) => o.id === orderId);
      if (q) return Number(q.total ?? 0);
      if (selectedSupportOrder?.id === orderId) return Number(selectedSupportOrder.total ?? 0);
      return 0;
    },
    [queueBoardOrders, selectedSupportOrder],
  );

  const beginCollectCard = useCallback(
    (orderId: string, after?: () => void | Promise<unknown>) => {
      cardCollectAfterRef.current = after;
      setPendingCardCollect({
        orderId,
        total: resolveOrderTotalForCollect(orderId),
      });
    },
    [resolveOrderTotalForCollect],
  );

  const handleCardCollectRecorded = useCallback(
    async (orderId: string, body: unknown) => {
      patchQueueOrderRowsFromApi(orderId, body);
      void refreshOpsQueueAfterAction({ withRecon: true });
      const runAfter = cardCollectAfterRef.current;
      cardCollectAfterRef.current = undefined;
      setPendingCardCollect(null);
      if (runAfter) await runAfter();
    },
    [patchQueueOrderRowsFromApi, refreshOpsQueueAfterAction],
  );

  const beginCollectCash = useCallback(
    (orderId: string, after?: () => void | Promise<unknown>) => {
      cashCollectAfterRef.current = after;
      setPendingCashCollect({
        orderId,
        total: resolveOrderTotalForCollect(orderId),
      });
    },
    [resolveOrderTotalForCollect],
  );

  const handleCashCollectRecorded = useCallback(
    async (orderId: string, body: unknown) => {
      const data = body as { collectionApplied?: boolean } | null;
      if (data?.collectionApplied !== false) {
        patchQueueOrderRowsFromApi(orderId, body);
      }
      void refreshOpsQueueAfterAction({ withRecon: true });
      const runAfter = cashCollectAfterRef.current;
      cashCollectAfterRef.current = undefined;
      setPendingCashCollect(null);
      if (runAfter) await runAfter();
    },
    [patchQueueOrderRowsFromApi, refreshOpsQueueAfterAction],
  );

  /** Shared PATCH for cash — callers apply queue hooks / follow-ups. */
  const patchMarkCashReceived = useCallback(
    async (orderId: string, note: string): Promise<{ ok: boolean; body: unknown }> => {
      const res = await fetchProtectedNest(`/api/nest/orders/${orderId}/mark-payment-received`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'cash', note }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const err = body as { message?: string; detail?: string };
        toast.error(
          String(
            err?.message ??
              (typeof err?.detail === 'string' ? err.detail : null) ??
              'Could not record cash collection',
          ),
        );
        return { ok: false, body };
      }
      return { ok: true, body };
    },
    [fetchProtectedNest],
  );

  const collectCashFromQueue = async (
    orderId: string,
    note = 'Collected at cashier handoff',
    tenderDetail?: CashTenderConfirmDetail,
  ) => {
    if (cashCollectLoading[orderId]) return;
    setCashCollectLoading((p) => ({ ...p, [orderId]: true }));
    try {
      const finalNote = tenderDetail ? appendCashTenderAuditToNote(note, tenderDetail) : note;
      const { ok, body } = await patchMarkCashReceived(orderId, finalNote);
      if (!ok) return;
      const data = body as { collectionApplied?: boolean };
      if (data?.collectionApplied === false) {
        toast.info('Cash was already marked collected for this order.');
        void refreshOpsQueueAfterAction({ withRecon: true });
      } else {
        toast.success('Cash collected.');
        patchQueueOrderRowsFromApi(orderId, body);
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

  /** Refresh support modal after counter payment collection */
  const collectAtCounterAndRefreshSupport = async (orderId: string, method: 'cash' | 'card') => {
    if (method === 'cash') {
      beginCollectCash(orderId, async () => {
        await openSupportOrder(orderId);
      });
      return;
    }
    beginCollectCard(orderId, async () => {
      await openSupportOrder(orderId);
    });
  };

  const moveQueueOrderStatus = async (orderId: string, nextStatus: QueueOrderStatus) => {
    if (nextStatus === 'delivered') {
      const row = queueBoardOrders.find((o) => o.id === orderId);
      if (row && row.paymentStatus !== 'completed') {
        toast.error(
          'Collect payment before completing handoff — open the order (Support / Orders) and record cash or card there.',
        );
        return;
      }
    }
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
    if (nextStatus !== 'ready') {
      toast.success(`Order moved to ${nextStatus.replaceAll('_', ' ')}`);
    }
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
    const seq = ++supportDetailRequestSeq.current;
    setSupportDetailsLoading(true);
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
        if (seq === supportDetailRequestSeq.current) {
          setSupportError(String(err?.detail ?? err?.error ?? 'Order details unavailable'));
        }
        return null;
      }
      const data = await res.json();
      const normalized = data as SupportOrderDetails;
      if (seq !== supportDetailRequestSeq.current) {
        return normalized;
      }
      setSupportError(null);
      setSelectedSupportOrder(normalized);
      return normalized;
    } finally {
      if (seq === supportDetailRequestSeq.current) {
        setSupportDetailsLoading(false);
      }
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

  const openBrowserPrintBill = async (order: SupportOrderDetails) => {
    const esc = (v: string | null | undefined) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    /** Fresh fetch — initial page load may have failed or completed before API was up */
    let lh =
      printLetterhead ?? {
        businessName: 'Wrap & Roll',
        lines: [...PRINT_LETTERHEAD_FALLBACK_LINES],
      };
    try {
      const res = await fetch('/api/nest/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as PublicBusinessSettings;
        lh = parseLetterheadFromPublicSettings(data);
        setPrintLetterhead(lh);
      }
    } catch {
      /* use lh from state / fallback */
    }
    const initialsFromBusinessName = (name: string): string => {
      const s = name.trim();
      if (!s) return 'WR';
      const parts = s.split(/\s+/).filter((w) => /^[A-Za-zÀ-ž]/.test(w));
      if (parts.length >= 2) {
        const a = parts[0]?.[0];
        const b = parts[1]?.[0];
        if (a && b) return `${a}${b}`.toUpperCase();
      }
      const letters = s.replace(/[^A-Za-z0-9]/g, '');
      return letters.length >= 2
        ? letters.slice(0, 2).toUpperCase()
        : letters.toUpperCase() || 'WR';
    };
    const markInitials = initialsFromBusinessName(lh.businessName);
    const letterheadLinesHtml = lh.lines
      .map((line) => `<p class="letterhead-line">${esc(line)}</p>`)
      .join('');

    const ftRaw = String(order.fulfillmentType ?? '').toLowerCase();
    const fulfillmentPretty =
      ftRaw === 'takeaway'
        ? 'Takeaway'
        : ftRaw === 'dine_in'
          ? 'Dine in'
          : ftRaw === 'delivery'
            ? 'Delivery'
            : esc(String(order.fulfillmentType ?? '').replaceAll('_', ' ') || '—');

    const methodRaw = String(order.paymentMethod ?? '').toLowerCase();
    const methodPretty =
      methodRaw === 'cash'
        ? 'Cash'
        : methodRaw === 'card'
          ? 'Card'
          : esc(String(order.paymentMethod ?? '').replaceAll('_', ' ') || '—');

    const paymentLinePretty = `${methodPretty} · ${formatPaymentStatusDisplayLabel(order.paymentStatus)}`;

    const serviceParts: string[] = [fulfillmentPretty];
    if (ftRaw === 'dine_in' && order.tableNumber?.trim()) {
      serviceParts.push(`Table ${esc(order.tableNumber.trim())}`);
    }
    const serviceLine = serviceParts.join(' · ');

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
            <span class="line-qty"><span class="line-qty-inner">${esc(String(item.quantity))}×</span></span>
            <span class="line-name">${esc(item.name)}</span>
            <span class="line-price mono">Rs ${Number(item.lineTotal).toFixed(2)}</span>
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
    const parseSupportMoney = (v: unknown): number | null => {
      if (v == null) return null;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    const cashRecv = parseSupportMoney(order.cashReceivedLkr);
    const changeOut = parseSupportMoney(order.changeReturnedLkr);
    const tenderTotalsHtml =
      cashRecv !== null && changeOut !== null
        ? `<div class="tender-block">
              <div class="tender-title">Tender</div>
              <div class="tot-row"><span>Cash received</span><span class="mono">Rs ${cashRecv.toFixed(2)}</span></div>
              <div class="tot-row"><span>Change</span><span class="mono">Rs ${changeOut.toFixed(2)}</span></div>
            </div>`
        : '';

    const discountRow =
      discount > 0.005
        ? `<div class="tot-row"><span>Discount</span><span class="neg mono">−Rs ${discount.toFixed(2)}</span></div>`
        : '';
    const deliveryRow =
      delivery > 0.005
        ? `<div class="tot-row"><span>Delivery</span><span class="mono">Rs ${delivery.toFixed(2)}</span></div>`
        : '';
    const taxRow =
      tax > 0.005
        ? `<div class="tot-row"><span>Tax</span><span class="mono">Rs ${tax.toFixed(2)}</span></div>`
        : '';

    const totalLabel =
      String(order.paymentStatus ?? '').toLowerCase() === 'completed' ? 'Total paid' : 'Amount due';

    const placedDate = order.placedAt ? new Date(String(order.placedAt)) : null;
    const placedDisplay = placedDate
      ? placedDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    const deliveryAddressSection =
      ftRaw === 'delivery' && order.deliveryAddress?.trim()
        ? `<div class="field-block">
              <span class="field-label">Deliver to</span>
              <p class="field-multiline">${esc(order.deliveryAddress.trim())}</p>
            </div>`
        : '';

    const phoneLine = order.customer?.phone ? esc(order.customer.phone) : '';
    const orderIdShort = String(order.id).slice(0, 8).toUpperCase();
    const orderIdFull = esc(String(order.id));

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Receipt · ${esc(orderIdShort)} · ${esc(lh.businessName)}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,500&amp;display=swap" rel="stylesheet" />
          <style>
            :root {
              --ink: #09090b;
              --muted: #71717a;
              --muted2: #a1a1aa;
              --border: #e4e4e7;
              --surface: #ffffff;
              --surface-muted: #fafafa;
              --accent: #ea580c;
              --accent-ring: rgba(234, 88, 12, 0.25);
              --radius: 20px;
              --font: "DM Sans", system-ui, -apple-system, sans-serif;
            }
            * { box-sizing: border-box; }
            @page { margin: 10mm; size: auto; }
            @media print {
              body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .canvas { background: #fff !important; padding: 0 !important; }
              .sheet { box-shadow: none !important; border: 1px solid var(--border) !important; }
            }
            body {
              margin: 0;
              min-height: 100vh;
              font-family: var(--font);
              font-size: 13px;
              line-height: 1.5;
              color: var(--ink);
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            .canvas {
              padding: 32px 16px 48px;
              background: var(--surface-muted);
            }
            .sheet {
              max-width: 400px;
              margin: 0 auto;
              background: var(--surface);
              border-radius: var(--radius);
              border: 1px solid var(--border);
              box-shadow:
                0 1px 2px rgba(0, 0, 0, 0.04),
                0 24px 48px -32px rgba(0, 0, 0, 0.18);
              overflow: hidden;
            }
            .strip {
              height: 4px;
              background: var(--accent);
            }
            .pad { padding: 0 22px 12px; }
            .rx-header {
              padding: 24px 0 4px;
            }
            .rx-header-row {
              display: flex;
              align-items: flex-start;
              gap: 16px;
            }
            .rx-logo {
              flex-shrink: 0;
              width: 52px;
              height: 52px;
              border-radius: 14px;
              background: var(--ink);
              color: #fafafa;
              font-weight: 700;
              font-size: 0.95rem;
              letter-spacing: -0.04em;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .rx-title-block {
              flex: 1;
              min-width: 0;
              padding-top: 2px;
            }
            .rx-eyebrow {
              display: block;
              font-size: 0.625rem;
              font-weight: 600;
              letter-spacing: 0.22em;
              text-transform: uppercase;
              color: var(--muted2);
              margin-bottom: 6px;
            }
            .rx-title {
              margin: 0;
              font-size: 1.375rem;
              font-weight: 700;
              letter-spacing: -0.045em;
              line-height: 1.15;
              color: var(--ink);
            }
            .letterhead-stack {
              margin-top: 18px;
              padding-top: 18px;
              border-top: 1px solid var(--border);
              text-align: center;
            }
            .letterhead-line {
              margin: 0;
              padding: 7px 0;
              font-size: 0.75rem;
              font-weight: 500;
              color: var(--muted);
              letter-spacing: 0.01em;
              line-height: 1.45;
              border-bottom: 1px solid #f4f4f5;
            }
            .letterhead-line:last-child {
              border-bottom: none;
              padding-bottom: 0;
            }
            .pill-row {
              margin-top: 18px;
              text-align: center;
            }
            .pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 12px;
              font-size: 0.625rem;
              font-weight: 700;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: var(--muted);
              border-radius: 999px;
              border: 1px solid var(--border);
              background: var(--surface-muted);
            }
            .pill-dot {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: var(--accent);
              box-shadow: 0 0 0 3px var(--accent-ring);
            }
            .doc-row {
              display: flex;
              align-items: stretch;
              justify-content: space-between;
              gap: 16px;
              padding: 16px 16px;
              border-radius: 12px;
              background: var(--surface-muted);
              border: 1px solid var(--border);
            }
            .doc-row .label {
              font-size: 0.625rem;
              font-weight: 600;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: var(--muted2);
            }
            .doc-row .value {
              font-weight: 700;
              font-size: 1rem;
              letter-spacing: -0.03em;
              margin-top: 5px;
              font-variant-numeric: tabular-nums;
              color: var(--ink);
            }
            .doc-row .hint {
              font-size: 0.75rem;
              color: var(--muted);
              margin-top: 6px;
              font-weight: 500;
              line-height: 1.35;
            }
            .doc-row > div:last-child .value { font-size: 0.8125rem; font-weight: 600; color: var(--muted); }
            .section-h {
              margin: 26px 0 10px;
              font-size: 0.625rem;
              font-weight: 600;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: var(--muted2);
            }
            .section-h:first-of-type { margin-top: 8px; }
            .stack-gap { display: flex; flex-direction: column; gap: 12px; }
            .field-label {
              font-size: 0.62rem;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: var(--muted);
            }
            .field-value { font-weight: 600; font-size: 0.95rem; margin-top: 3px; letter-spacing: -0.01em; }
            .field-multiline {
              margin: 6px 0 0;
              font-size: 0.86rem;
              line-height: 1.5;
              color: var(--ink);
              white-space: pre-wrap;
              word-break: break-word;
              font-weight: 500;
            }
            .field-block { margin-top: 4px; }
            .payment-pill {
              display: inline-flex;
              align-items: center;
              padding: 10px 14px;
              border-radius: 10px;
              font-size: 0.875rem;
              font-weight: 600;
              letter-spacing: -0.02em;
              background: var(--surface);
              border: 1px solid var(--border);
              border-left: 3px solid var(--accent);
            }
            .rule {
              height: 0;
              margin: 20px 0;
              border: 0;
              border-top: 1px solid var(--border);
            }
            .line-item {
              margin: 0;
              padding: 14px 0;
              border-bottom: 1px solid #f4f4f5;
              background: transparent;
              border-radius: 0;
            }
            .line-item:last-of-type { border-bottom: none; }
            .line-item-top {
              display: grid;
              grid-template-columns: 2.25rem 1fr auto;
              gap: 12px;
              align-items: start;
            }
            .line-qty-inner {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-width: 1.75rem;
              padding: 4px 7px;
              border-radius: 8px;
              font-weight: 700;
              font-size: 0.75rem;
              color: var(--ink);
              background: var(--surface-muted);
              border: 1px solid var(--border);
              font-variant-numeric: tabular-nums;
            }
            .line-name { font-weight: 700; font-size: 0.9rem; letter-spacing: -0.02em; line-height: 1.35; }
            .line-price {
              font-weight: 800;
              font-variant-numeric: tabular-nums;
              white-space: nowrap;
              font-size: 0.9rem;
              color: var(--ink);
            }
            .item-mods { margin: 10px 0 0 0; padding: 8px 0 0 12px; border-left: 2px solid var(--border); }
            .mod-line { font-size: 0.78rem; color: var(--muted); line-height: 1.45; font-weight: 500; }
            .totals { margin-top: 6px; }
            .tot-row {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              padding: 7px 2px;
              font-size: 0.88rem;
              font-variant-numeric: tabular-nums;
            }
            .tot-row span:first-child { color: var(--muted); font-weight: 600; }
            .tot-row span:last-child { font-weight: 700; }
            .tot-row .neg { color: #c2410c; font-weight: 700; }
            .mono { font-variant-numeric: tabular-nums; font-weight: 700; }
            .tot-grand {
              margin-top: 16px;
              padding: 18px 18px;
              border-radius: 14px;
              background: var(--ink);
              border: none;
              box-shadow: 0 12px 24px -16px rgba(0, 0, 0, 0.35);
            }
            .tot-grand .tot-row {
              padding: 0;
              align-items: center;
            }
            .tot-grand span:first-child {
              color: #a1a1aa !important;
              font-weight: 600;
              font-size: 0.6875rem;
              letter-spacing: 0.14em;
              text-transform: uppercase;
            }
            .tot-grand .grand-amt {
              font-size: 1.375rem;
              font-weight: 700;
              letter-spacing: -0.05em;
              color: #fafafa !important;
              font-variant-numeric: tabular-nums;
            }
            .tender-block {
              margin-top: 14px;
              padding: 14px 16px;
              border-radius: 12px;
              background: #fafafa;
              border: 1px solid var(--border);
            }
            .tender-title {
              font-size: 0.625rem;
              font-weight: 600;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: var(--muted2);
              margin-bottom: 8px;
            }
            .tender-block .tot-row { padding: 4px 0; font-size: 0.85rem; }
            .tender-block .tot-row span:first-child { color: var(--muted); font-weight: 500; }
            .footer {
              padding: 28px 22px 32px;
              text-align: center;
              background: var(--surface-muted);
              border-top: 1px solid var(--border);
              color: var(--muted);
            }
            .footer .ornament {
              font-size: 0.875rem;
              letter-spacing: 0.4em;
              color: var(--border);
              margin-bottom: 12px;
            }
            .footer .thanks {
              font-weight: 700;
              font-size: 1.125rem;
              letter-spacing: -0.03em;
              margin: 0 0 8px;
              color: var(--ink);
            }
            .footer .fine {
              margin: 0 auto;
              max-width: 280px;
              font-size: 0.8125rem;
              color: var(--muted);
              line-height: 1.6;
              font-weight: 500;
            }
            .ref-id {
              margin-top: 16px;
              font-size: 0.625rem;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              color: var(--muted2);
              word-break: break-all;
              line-height: 1.45;
            }
          </style>
        </head>
        <body>
          <div class="canvas">
          <div class="sheet">
            <div class="strip" aria-hidden="true"></div>
            <div class="pad">
              <header class="rx-header">
                <div class="rx-header-row">
                  <div class="rx-logo" aria-hidden="true">${esc(markInitials)}</div>
                  <div class="rx-title-block">
                    <span class="rx-eyebrow">Sales receipt</span>
                    <h1 class="rx-title">${esc(lh.businessName)}</h1>
                  </div>
                </div>
                <div class="letterhead-stack">${letterheadLinesHtml}</div>
                <div class="pill-row">
                  <span class="pill"><span class="pill-dot" aria-hidden="true"></span> Verified</span>
                </div>
              </header>

              <div class="doc-row">
                <div>
                  <div class="label">Receipt no.</div>
                  <div class="value">#${esc(orderIdShort)}</div>
                  <div class="hint">${esc(serviceLine)}</div>
                </div>
                <div style="text-align:right;min-width:42%">
                  <div class="label">Date</div>
                  <div class="value">${esc(placedDisplay)}</div>
                </div>
              </div>

              <h2 class="section-h">Customer</h2>
              <div class="stack-gap">
                <div>
                  <span class="field-label">Name</span>
                  <div class="field-value">${esc(order.customer?.name?.trim() || 'Guest')}</div>
                </div>
                ${
                  phoneLine
                    ? `<div>
                    <span class="field-label">Phone</span>
                    <div class="field-value">${phoneLine}</div>
                  </div>`
                    : ''
                }
                ${deliveryAddressSection}
              </div>

              <h2 class="section-h">Payment</h2>
              <div class="payment-pill">${esc(paymentLinePretty)}</div>

              <hr class="rule" />

              <h2 class="section-h">Items</h2>
              ${itemsHtml}

              <hr class="rule" />

              <h2 class="section-h">Summary</h2>
              <div class="totals">
                <div class="tot-row"><span>Subtotal</span><span class="mono">Rs ${subtotal.toFixed(2)}</span></div>
                ${discountRow}
                ${taxRow}
                ${deliveryRow}
                <div class="tot-grand">
                  <div class="tot-row"><span>${esc(totalLabel)}</span><span class="grand-amt">Rs ${total.toFixed(2)}</span></div>
                </div>
                ${tenderTotalsHtml}
              </div>
            </div>

            <footer class="footer">
              <div class="ornament">···</div>
              <p class="thanks">Thank you</p>
              <p class="fine">We appreciate your visit — see you next time.</p>
              <div class="ref-id">${orderIdFull}</div>
            </footer>
          </div>
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
    await openBrowserPrintBill(detail);
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

  const runPlaceOrderPayment = useCallback(
    (opts?: { skipPayNowGate?: boolean; cashTenderDetail?: CashTenderConfirmDetail }) => {
      const skipGate = opts?.skipPayNowGate === true;
      const isCounterPayLater =
        orderIntake === 'counter' && counterPaymentTiming === 'later';
      if (!isCounterPayLater && paymentMethod === 'CARD' && !cardPaymentsEnabled) {
        toast.error('Card payments are currently disabled in settings.');
        return;
      }
      /** Pay-later counter: method is chosen at collection (`mark-payment-received`). Cash placeholder satisfies POS kitchen policy; final method overwrites on collect. */
      const effectivePaymentMethod: CashierPaymentMethod = isCounterPayLater
        ? 'CASH'
        : paymentMethod;
      let paymentCollection: CashierPaymentCollection;
      if (orderIntake === 'phone') {
        paymentCollection =
          effectivePaymentMethod === 'CARD'
            ? 'immediate'
            : fulfillmentType === 'delivery'
              ? 'on_delivery'
              : 'on_pickup';
      } else if (counterPaymentTiming === 'now') {
        paymentCollection = 'immediate';
      } else {
        paymentCollection =
          fulfillmentType === 'delivery'
            ? 'on_delivery'
            : fulfillmentType === 'takeaway'
              ? 'on_pickup'
              : 'at_collection';
      }
      const phoneForPay = normalizeCashierPhone(customerPhone);
      const posNow = usePosStore.getState();
      const subtotalAtPlace = posNow.cart.reduce(
        (acc, item) => acc + item.unitPrice * item.quantity,
        0,
      );
      const supNow = useSupervisorStore.getState();
      const manualToSend = computeLiveManualDiscountRs({
        manualDiscountInput: supNow.manualDiscountInput,
        cartSubtotal: subtotalAtPlace,
        couponDiscountAmount,
        elevation: supNow.elevation,
      });
      const validElevation = supNow.getValidElevation();
      if (manualToSend > 0 && !validElevation?.token) {
        toast.error('Unlock supervisor before applying a manual discount.');
        setSubmittingOrder(false);
        return;
      }

      const gatePayNowCash =
        !skipGate &&
        orderIntake === 'counter' &&
        counterPaymentTiming === 'now' &&
        paymentMethod === 'CASH';
      const gatePayNowCard =
        !skipGate &&
        orderIntake === 'counter' &&
        counterPaymentTiming === 'now' &&
        paymentMethod === 'CARD';

      if (gatePayNowCash) {
        setCheckoutPayNowConfirm('cash');
        return;
      }
      if (gatePayNowCard) {
        setCheckoutPayNowConfirm('card');
        return;
      }

      const cashTenderAuditNote =
        skipGate &&
        opts?.cashTenderDetail &&
        effectivePaymentMethod === 'CASH' &&
        paymentCollection === 'immediate'
          ? appendCashTenderAuditToNote('POS Pay now cash', opts.cashTenderDetail).slice(0, 400)
          : undefined;

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
          ...(appliedCoupon?.code ? { discountCode: appliedCoupon.code } : {}),
          ...(manualToSend > 0 && validElevation?.token
            ? {
                manualDiscountAmount: manualToSend,
                supervisorElevationToken: validElevation.token,
              }
            : {}),
          ...(cashTenderAuditNote ? { cashTenderAuditNote } : {}),
        },
      );
      setTimeout(updatePendingCount, 500);
    },
    [
      orderIntake,
      counterPaymentTiming,
      paymentMethod,
      cardPaymentsEnabled,
      fulfillmentType,
      customerPhone,
      customerName,
      tableNumber,
      deliveryAddress,
      appliedCoupon,
      couponDiscountAmount,
      pay,
      updatePendingCount,
      setCheckoutPayNowConfirm,
    ],
  );

  const handleCheckout = () => {
    if (submittingOrder || lineAmendSaving) return;

    if (lineAmendOrderId && lineAmendSource) {
      if (cart.length === 0) {
        toast.info('Add at least one line to save.');
        return;
      }
      const needsAdminOverride =
        cashierProfile?.role === 'ADMIN' &&
        !evaluateLineItemReplacementPolicy(
          {
            status: lineAmendSource.status,
            paymentStatus: lineAmendSource.paymentStatus,
            fulfillmentType: lineAmendSource.fulfillmentType ?? 'takeaway',
          },
          'CASHIER',
        ).allowed;
      if (needsAdminOverride && lineAmendOverrideReason.trim().length < 3) {
        toast.error('Admin override: enter a reason (at least 3 characters).');
        return;
      }
      void (async () => {
        setLineAmendSaving(true);
        try {
          const syncPayload: CashierOrderSyncPayload = {
            items: cart.map(({ cartId, ...rest }) => rest),
            total: cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0),
            paymentMethod: 'CASH',
            createdAt: new Date().toISOString(),
          };
          const wrapItems = cashierPayloadToWrapOrderItems(syncPayload, () => crypto.randomUUID());
          const res = await fetchProtectedNest(
            `/api/orders/${lineAmendOrderId}/line-items`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: wrapItems,
                note: 'POS line amendment',
                ...(needsAdminOverride
                  ? { adminOverrideReason: lineAmendOverrideReason.trim() }
                  : {}),
              }),
            },
          );
          const oid = lineAmendOrderId;
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const rawMsg = String((err as { message?: unknown })?.message ?? '');
            if (res.status === 404 && rawMsg.includes('Cannot PATCH')) {
              toast.error(
                'Your API returned 404 for PATCH …/line-items — the Nest process on NEST_API_URL is missing that route. Restart the API from this repo (nx serve api or rebuild the API image), then save again.',
              );
              return;
            }
            toast.error(rawMsg || 'Could not update order lines');
            return;
          }
          const body = await res.json();
          toast.success('Order lines updated');
          clearCart();
          setLineAmendOrderId(null);
          setLineAmendSource(null);
          setLineAmendOverrideReason('');
          patchQueueOrderRowsFromApi(oid, body);
          await refreshOpsQueueAfterAction({ withRecon: true });
        } finally {
          setLineAmendSaving(false);
        }
      })();
      return;
    }

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
    runPlaceOrderPayment();
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
  const showCounterPaymentMethodPick =
    orderIntake !== 'counter' || counterPaymentTiming !== 'later';
  const isPhoneOrder = orderIntake === 'phone';
  const hasValidPhoneForPhoneOrder = !isPhoneOrder || isPhoneIntakeValid(orderIntake, phoneDigits(customerPhone));
  const hasRequiredAddressForDelivery = fulfillmentType !== 'delivery' || deliveryAddress.trim().length > 0;
  const hasRequiredTableForDineIn = fulfillmentType !== 'dine_in' || tableNumber.trim().length > 0;
  const canSubmitOrder =
    cart.length > 0 &&
    !submittingOrder &&
    !lineAmendSaving &&
    (lineAmendOrderId
      ? lineAmendNeedsAdminReason
        ? lineAmendOverrideReason.trim().length >= 3
        : true
      : hasValidPhoneForPhoneOrder &&
        hasRequiredAddressForDelivery &&
        hasRequiredTableForDineIn);

  const startCustomize = (product: ProductRow) => {
    setCustomizingCartId(null);
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

  const startCustomizeFromCart = (item: CartItem) => {
    const product = products.find((p) => String(p.id) === String(item.id));
    if (!product) {
      toast.error('This item is not on the current menu. Refresh the menu and try again.');
      return;
    }
    setCustomizingCartId(item.cartId);
    setProductToCustomize(product);
    const restored: Record<string, string[]> = {};
    for (const g of product.modifierGroups ?? []) {
      const ids: string[] = [];
      for (const o of g.options ?? []) {
        const picked = (item.selectedOptions ?? []).some(
          (s) => s.groupName === g.name && s.label === o.label,
        );
        if (picked) ids.push(o.optionId);
      }
      restored[g.groupId] = ids;
    }
    setSelectedByGroup(restored);
    setItemNotes((item.notes ?? '').trim());
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
        const impacts = (info.modifierIngredientImpacts ?? []).reduce<Record<string, string[]>>(
          (acc, row) => {
            acc[row.optionLabel] = row.ingredients;
            return acc;
          },
          {},
        );
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
    const notesTrim = itemNotes.trim();
    if (customizingCartId) {
        updateCartLine(customizingCartId, {
        unitPrice: customizeTotal,
        selectedOptions: selectedCustomizeOptions,
        notes: notesTrim ? notesTrim : undefined,
      });
      setCustomizingCartId(null);
      setCustomizeOpen(false);
      toast.success('Options updated');
      return;
    }
    addItem({
      id: productToCustomize.id,
      name: productToCustomize.name,
      unitPrice: customizeTotal,
      quantity: 1,
      notes: notesTrim || undefined,
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
    <OpsLayout className="flex min-h-screen">
      <aside
        className={`sticky top-0 z-40 flex h-screen max-h-screen shrink-0 touch-manipulation flex-col self-start overflow-x-hidden overflow-y-hidden border-r border-border/80 bg-white shadow-sm transition-[width] duration-200 ease-out ${
          drawerCollapsed ? 'w-[88px] px-2 py-4' : 'w-[320px] px-3 py-4'
        }`}
      >
        {!drawerCollapsed ? (
          <div className="mb-4 rounded-2xl border border-border/70 bg-gradient-to-b from-slate-50/90 to-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-base font-black leading-tight tracking-tight text-foreground">
                  Cashier POS
                </p>
                <p
                  className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground"
                  title={cashierProfile?.email ?? 'Cashier session'}
                >
                  {cashierProfile?.email ?? 'Cashier session'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 touch-manipulation rounded-xl border-slate-200 bg-white"
                onClick={() => setDrawerCollapsed((p) => !p)}
                title="Collapse navigation"
              >
                <PanelLeftClose size={20} aria-hidden />
              </Button>
            </div>
            <div className="mt-3 border-t border-border/50 pt-3">
              <PosSidebarClock />
            </div>
          </div>
        ) : (
          <div className="mb-4 flex flex-col items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 select-none flex-col items-center justify-center rounded-2xl border-2 border-primary/30 bg-gradient-to-b from-primary/[0.12] to-white text-primary shadow-sm"
              aria-label="Wrap & Roll"
              title="Wrap & Roll"
            >
              <span className="font-display text-[13px] font-black leading-none tracking-[0.06em]" aria-hidden>
                WR
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="group flex h-auto min-h-[52px] w-[52px] shrink-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl border-primary/35 bg-primary/[0.05] px-1 py-2 text-primary shadow-sm hover:bg-primary/10"
              onClick={() => setDrawerCollapsed((p) => !p)}
              title="Show menu labels"
              aria-label="Expand sidebar — show full navigation labels"
            >
              <ChevronsRight className="h-6 w-6 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="text-center text-[9px] font-bold uppercase leading-none tracking-wide text-primary/85">
                Menu
              </span>
            </Button>
            <PosSidebarClock compact />
          </div>
        )}
        <div className="pos-touch-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-0 pb-1 [-webkit-overflow-scrolling:touch]">
          <nav
            className={`flex shrink-0 flex-col ${drawerCollapsed ? 'items-center space-y-3 px-0' : 'space-y-2 rounded-2xl border border-border/50 bg-white p-2 shadow-sm'}`}
            aria-label="Primary navigation"
          >
            {[
              { key: 'pos' as const, label: 'POS', icon: ShoppingCart },
              { key: 'orders' as const, label: 'Orders', icon: Hash },
              { key: 'ops' as const, label: 'Queue & Support', icon: ListTodo },
              { key: 'clients' as const, label: 'Clients', icon: Users },
            ].map((item) => {
              const active = activeTab === item.key;
              const Icon = item.icon;
              const activeCls = active
                ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-inset ring-white/25'
                : 'text-slate-800 hover:bg-slate-100 active:bg-slate-200/80';
              return (
                <button
                  key={item.key}
                  type="button"
                  className={
                    drawerCollapsed
                      ? `flex h-[52px] w-[52px] shrink-0 touch-manipulation items-center justify-center rounded-2xl text-base font-semibold transition active:scale-[0.97] ${activeCls}`
                      : `flex min-h-[52px] w-full max-w-full touch-manipulation items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-base font-semibold transition active:scale-[0.99] ${activeCls}`
                  }
                  onClick={() => startTransition(() => setActiveTab(item.key))}
                  title={drawerCollapsed ? item.label : undefined}
                >
                  <span className={`flex shrink-0 items-center justify-center ${drawerCollapsed ? '' : 'w-9'}`}>
                    <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />
                  </span>
                  {drawerCollapsed ? null : (
                    <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <ManagerToolsNav
            drawerCollapsed={drawerCollapsed}
            isOnline={isOnline}
            fetchProtectedNest={fetchProtectedNest}
          />
        </div>
        <div className="shrink-0 border-t border-border/80 bg-white pt-4">
          <div className={`mb-3 space-y-2.5 ${drawerCollapsed ? 'px-0' : 'px-0.5'}`}>
            <StatusPill
              variant={isOnline ? 'online' : 'offline'}
              className={`w-full touch-manipulation justify-center py-2.5 text-sm ${drawerCollapsed ? 'min-h-11 px-0' : 'min-h-11'}`}
            >
              {isOnline ? (
                <>
                  <Wifi size={18} strokeWidth={2} aria-hidden /> {drawerCollapsed ? '' : 'Online'}
                </>
              ) : (
                <>
                  <WifiOff size={18} strokeWidth={2} aria-hidden /> {drawerCollapsed ? '' : 'Offline'}
                </>
              )}
            </StatusPill>
            <span
              className={`inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-full border px-2.5 py-2 text-xs font-semibold ${queueLiveStatusClass(queueLiveStatus)} ${drawerCollapsed ? 'px-0 text-[10px]' : 'text-sm'}`}
              title="Realtime queue stream status"
            >
              {drawerCollapsed
                ? queueLiveStatus === 'connected'
                  ? 'Live'
                  : queueLiveStatus === 'reconnecting'
                    ? 'Retry'
                    : queueLiveStatus === 'connecting'
                      ? 'Conn'
                      : 'Live'
                : queueLiveStatusLabel(queueLiveStatus)}
            </span>
            <Button
              type="button"
              variant={queueAlertSound ? 'outline' : 'secondary'}
              className={`w-full touch-manipulation rounded-2xl border-2 font-semibold ${
                drawerCollapsed
                  ? 'min-h-11 justify-center px-0 py-2.5'
                  : 'min-h-[52px] justify-start gap-3 px-3 py-2.5 text-left'
              } ${queueAlertSound ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100' : 'border-border text-muted-foreground'}`}
              aria-pressed={queueAlertSound}
              title={
                queueAlertSound
                  ? 'Mute notification sounds for queue updates (toasts stay on)'
                  : 'Turn on notification sounds for queue updates'
              }
              aria-label={
                queueAlertSound ? 'Mute queue notification sounds' : 'Unmute queue notification sounds'
              }
              onClick={() => {
                setQueueAlertSound((prev) => {
                  const next = !prev;
                  try {
                    window.localStorage.setItem('cashier-queue-alert-sound', next ? '1' : '0');
                  } catch {
                    /* ignore */
                  }
                  return next;
                });
              }}
            >
              {queueAlertSound ? (
                <Bell size={22} className="shrink-0 text-emerald-700" strokeWidth={2.25} aria-hidden />
              ) : (
                <BellOff size={22} className="shrink-0 text-muted-foreground" strokeWidth={2.25} aria-hidden />
              )}
              {drawerCollapsed ? null : (
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-sm font-bold text-foreground">Notifications</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {queueAlertSound ? 'Sounds on' : 'Muted'}
                  </span>
                </span>
              )}
            </Button>
            {pendingSyncCount > 0 ? (
              <>
                <StatusPill
                  variant="warning"
                  className={`w-full touch-manipulation justify-center py-2.5 text-sm animate-pulse ${drawerCollapsed ? 'min-h-11 px-0' : 'min-h-11'}`}
                >
                  <RefreshCw size={16} className="animate-spin-slow" aria-hidden />
                  {drawerCollapsed ? pendingSyncCount : `${pendingSyncCount} pending`}
                </StatusPill>
                <div className={`grid gap-2.5 ${drawerCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`min-h-11 touch-manipulation text-sm font-semibold ${drawerCollapsed ? 'px-0' : ''}`}
                    onClick={() => void retryPendingSync()}
                    title="Retry pending sync"
                  >
                    {drawerCollapsed ? <RefreshCw size={18} /> : 'Retry'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`min-h-11 touch-manipulation text-sm font-semibold ${drawerCollapsed ? 'px-0' : ''}`}
                    onClick={() => void clearPendingSync()}
                    title="Clear pending sync queue"
                  >
                    {drawerCollapsed ? <Trash2 size={18} /> : 'Clear'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
          {!drawerCollapsed ? (
            <p className="mb-3 px-0.5 text-xs text-muted-foreground">
              {cashierProfile?.role ? `${cashierProfile.role} session` : 'Cashier session'}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={`min-h-[52px] w-full touch-manipulation gap-2 rounded-2xl text-base font-semibold ${drawerCollapsed ? 'justify-center px-0' : ''}`}
            disabled={signingOut}
            onClick={() => void handleSignOut()}
            title="Sign out and return to login"
          >
            <LogOut size={20} aria-hidden />
            {drawerCollapsed ? null : signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <main
        className={`flex min-h-0 flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-6 min-w-0 ${
          activeTab === 'pos' ? 'xl:flex-row xl:items-start xl:gap-6' : ''
        }`}
      >
        {activeTab === 'ops' ? (
          <section className="pos-touch-scroll w-full overflow-y-auto">
            <div className="w-full rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
                  <span className="font-display text-xl font-black tracking-tight text-foreground sm:text-2xl">
                    Queue
                  </span>
                  <span className="text-base font-semibold tabular-nums text-foreground/90 sm:text-lg">
                    {queueStats.total} total · {queueStats.ongoing} active · {queueStats.completed} finished
                  </span>
                  <span className="flex flex-wrap items-center gap-2 pt-0.5 sm:pt-0">
                  {queueStats.scheduled > 0 ? (
                    <span className="rounded-md bg-slate-200/90 px-2 py-0.5 text-xs font-semibold text-foreground">
                      {queueStats.scheduled} scheduled
                    </span>
                  ) : null}
                  {queueExceptions.pendingCash > 0 ? (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {queueExceptions.pendingCash} cash to collect
                    </span>
                  ) : null}
                  {queueExceptions.failedPayment > 0 ? (
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
                      {queueExceptions.failedPayment} pay failed
                    </span>
                  ) : null}
                  {queueExceptions.scheduledOverdue > 0 ? (
                    <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900">
                      {queueExceptions.scheduledOverdue} late
                    </span>
                  ) : null}
                  </span>
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
                    title={`${cashierAttentionDisplay.items.length} item${cashierAttentionDisplay.items.length === 1 ? '' : 's'} on Next up`}
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
                                <td className="py-1 pr-2 font-semibold">
                                  {reconSummaryMethodLabel(row.method)}
                                </td>
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
                        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                          <strong>Pay at collection</strong> is pay-later orders (cash or card not chosen yet). After
                          you collect, they move to the cash or card row.
                        </p>
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
                    <strong>Next up</strong> lists every order that is not finished yet — finished means{' '}
                    <strong>delivered</strong> and <strong>payment completed</strong>. More urgent items
                    sort higher. Filter by lane or use <strong>Order board</strong> for columns by status.
                  </p>
                  {cashierAttentionDisplay.items.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {(
                        [
                          ['all', 'All'],
                          ['payment', NEXT_UP_LANE_LABEL.payment],
                          ['prep', NEXT_UP_LANE_LABEL.prep],
                          ['ready', NEXT_UP_LANE_LABEL.ready],
                          ['en_route', NEXT_UP_LANE_LABEL.en_route],
                        ] as const
                      ).map(([lane, label]) => (
                        <button
                          key={lane}
                          type="button"
                          aria-pressed={nextUpLaneFilter === lane}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            nextUpLaneFilter === lane
                              ? 'border-primary bg-primary text-white'
                              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/70'
                          }`}
                          onClick={() => startTransition(() => setNextUpLaneFilter(lane))}
                        >
                          {label}
                          <span
                            className={
                              nextUpLaneFilter === lane
                                ? 'rounded-full bg-white/25 px-1.5 py-0 text-[10px] font-black tabular-nums'
                                : 'rounded-full bg-background px-1.5 py-0 text-[10px] font-black tabular-nums text-foreground'
                            }
                          >
                            {nextUpLaneCounts[lane]}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {cashierAttentionDisplay.items.length === 0 ? (
                    <EmptyState
                      title="All clear on Next up"
                      description="Nothing in today’s queue needs finishing — or nothing loaded yet. Finished means delivered and paid. Open Order board to browse by stage, or Find order."
                    />
                  ) : nextUpFilteredItems.length === 0 ? (
                    <EmptyState
                      title="Nothing in this lane"
                      description={`No orders match “${nextUpLaneFilter === 'all' ? 'All' : NEXT_UP_LANE_LABEL[nextUpLaneFilter]}” right now — pick another filter.`}
                    />
                  ) : (
                    <ul className="space-y-4">
                      {nextUpFilteredItems.map(({ order, score, headline, detail }) => {
                        const lane = nextUpLane(order);
                        return (
                          <li
                            key={order.id}
                            className={`rounded-xl p-3 ${attentionCardFrameClass(score, lane)}`}
                          >
                            <div className="mb-3 border-b border-black/5 pb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${nextUpLaneBadgeClass(lane)}`}
                                >
                                  {NEXT_UP_LANE_LABEL[lane]}
                                </span>
                                <p className="text-sm font-black uppercase tracking-wide text-foreground">
                                  {headline}
                                </p>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
                            </div>
                            <QueueOrderCard
                              order={order}
                              showDeliveryAddress
                              onOpen={(id) => viewSupportOrder(id)}
                              onMove={(id, next) => void moveQueueOrderStatus(id, next)}
                              showPaymentActions={false}
                              onAmendLines={(o) => beginAmendOrderLines(o as OpsQueueOrder)}
                              staffRoleForAmend={cashierProfile?.role ?? 'CASHIER'}
                            />
                          </li>
                        );
                      })}
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
                            onAmendLines={(ord) => beginAmendOrderLines(ord as OpsQueueOrder)}
                            staffRoleForAmend={cashierProfile?.role ?? 'CASHIER'}
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
                              showPaymentActions={false}
                              onOpen={(id) => viewSupportOrder(id)}
                              onAmendLines={(ord) => beginAmendOrderLines(ord as OpsQueueOrder)}
                              staffRoleForAmend={cashierProfile?.role ?? 'CASHIER'}
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
                              onAmendLines={(ord) => beginAmendOrderLines(ord as OpsQueueOrder)}
                              staffRoleForAmend={cashierProfile?.role ?? 'CASHIER'}
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
                              showPaymentActions={false}
                              onOpen={(id) => viewSupportOrder(id)}
                              onAmendLines={(ord) => beginAmendOrderLines(ord as OpsQueueOrder)}
                              staffRoleForAmend={cashierProfile?.role ?? 'CASHIER'}
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
                              onAmendLines={(ord) => beginAmendOrderLines(ord as OpsQueueOrder)}
                              staffRoleForAmend={cashierProfile?.role ?? 'CASHIER'}
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
        {activeTab === 'orders' ? (
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <div className="flex h-[calc(100vh-130px)] min-h-0 w-full flex-col rounded-2xl border bg-card p-4 shadow-sm">
              <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
                <div className="orders-scroll-column min-h-0 overflow-y-auto rounded-2xl border bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="inline-flex rounded-full border border-orange-100 bg-orange-50 p-1 text-sm font-bold">
                      <button
                        type="button"
                        className={`min-h-10 rounded-full px-4 py-2 ${
                          ordersSettlementTab === 'on_process' ? 'bg-orange-500 text-white' : 'text-orange-800'
                        }`}
                        onClick={() => setOrdersSettlementTab('on_process')}
                      >
                        Awaiting payment
                      </button>
                      <button
                        type="button"
                        className={`min-h-10 rounded-full px-4 py-2 ${
                          ordersSettlementTab === 'completed' ? 'bg-orange-500 text-white' : 'text-orange-800'
                        }`}
                        onClick={() => setOrdersSettlementTab('completed')}
                      >
                        Paid
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{ordersSettlementRowsFiltered.length} orders</p>
                  </div>
                  <div className="mb-3">
                    <input
                      type="text"
                      className="h-12 w-full rounded-xl border bg-white px-3 text-base"
                      placeholder="Search by phone number or order ID"
                      value={ordersSearchQuery}
                      onChange={(e) => setOrdersSearchQuery(e.target.value)}
                    />
                  </div>
                  {ordersSettlementRowsFiltered.length === 0 ? (
                    <EmptyState
                      title="No matching orders"
                      description="Try another phone number or order ID."
                    />
                  ) : (
                    <div className="space-y-2">
                      {ordersSettlementRowsFiltered.map((o) => {
                        const isSelected = selectedSupportOrder?.id === o.id;
                        const pendingPayment = o.paymentStatus !== 'completed';
                        return (
                          <button
                            key={`orders-page-${o.id}`}
                            type="button"
                            onClick={() => void openSupportOrder(o.id)}
                            className={`block min-h-[96px] w-full rounded-xl border p-4 text-left shadow-sm transition ${
                              isSelected
                                ? 'border-orange-300 bg-orange-50/50'
                                : 'border-border/70 bg-white hover:border-orange-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-black text-foreground">
                                  Order: #{String(o.id).slice(0, 8).toUpperCase()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {o.tableNumber?.trim() ? `Table ${o.tableNumber}` : 'Table -'} · Qty{' '}
                                  {Number(o.itemCount ?? 0)}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {o.placedAt ? new Date(String(o.placedAt)).toLocaleTimeString() : '--:--'}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-xl font-black tabular-nums text-foreground">
                                Rs {Number(o.total ?? 0).toFixed(2)}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  pendingPayment ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {pendingPayment ? 'Pending' : 'Paid'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <aside
                  className="orders-scroll-column relative flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-3 pb-5 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.55)]"
                  aria-busy={supportDetailsLoading}
                >
                  {selectedSupportOrder && supportDetailsLoading ? (
                    <div
                      className="pointer-events-none absolute inset-x-3 top-2 z-10 h-0.5 overflow-hidden rounded-full bg-primary/20"
                      aria-hidden
                    >
                      <div className="h-full w-full origin-left animate-pulse bg-primary/50" />
                    </div>
                  ) : null}
                  {!selectedSupportOrder ? (
                    <p className="text-sm text-muted-foreground">
                      {supportDetailsLoading
                        ? 'Loading order…'
                        : 'Select an order to view items and collect payment.'}
                    </p>
                  ) : (
                    <div
                      className={`flex flex-col ${supportDetailsLoading ? 'opacity-80 transition-opacity' : ''}`}
                    >
                      <div className="shrink-0 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.03] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                              Order summary
                            </p>
                            <p className="text-2xl font-black tracking-tight text-foreground">
                              #{String(selectedSupportOrder.id).slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Table</p>
                            <p className="text-sm font-bold">{selectedSupportOrder.tableNumber?.trim() || '-'}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <span
                            className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700"
                            title="Kitchen / fulfillment step — separate from whether money is collected."
                          >
                            {orderBoardTitle[
                              selectedSupportOrder.status as QueueOrderStatus
                            ] ?? selectedSupportOrder.status}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 font-semibold ${
                              selectedSupportOrder.paymentStatus === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : selectedSupportOrder.paymentStatus === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                            title="Money collected — not the same as food served or delivered."
                          >
                            {formatPaymentStatusDisplayLabel(selectedSupportOrder.paymentStatus)}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                            {formatPaymentCollectionDisplayLabel(
                              selectedSupportOrder.paymentCollection ?? 'immediate',
                              selectedSupportOrder.fulfillmentType,
                            )}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <p>
                            Customer: {selectedSupportOrder.customer?.name || 'Guest'}
                            {selectedSupportOrder.customer?.phone
                              ? ` (${selectedSupportOrder.customer.phone})`
                              : ''}
                          </p>
                          <p>
                            Fulfillment: {String(selectedSupportOrder.fulfillmentType ?? '-').replaceAll('_', ' ')}
                          </p>
                        </div>
                      </div>
                      {/* Items grow naturally; the column aside handles scrolling (single scrollbar). */}
                      <div className="mt-3 flex flex-col rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
                        <p className="shrink-0 border-b border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                          Ordered items ({selectedSupportOrder.items.length})
                        </p>
                        <div className="space-y-2 px-2.5 py-2.5">
                        {selectedSupportOrder.items.length === 0 ? (
                          <p className="py-6 text-center text-xs text-muted-foreground">No lines on this order.</p>
                        ) : null}
                        {selectedSupportOrder.items.map((it) => {
                          const imageUrl = productImageByName.get(String(it.name ?? '').trim().toLowerCase());
                          const modifierLines = getOrderItemModifierDisplayLines(it.modifiers);
                          return (
                            <div key={`item-${it.id}`} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={it.name}
                                      className="h-12 w-12 shrink-0 rounded-xl border object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted text-sm font-bold text-muted-foreground">
                                      {String(it.name ?? '?').slice(0, 1).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{it.name}</p>
                                    <p className="text-xs text-muted-foreground">x{it.quantity}</p>
                                  </div>
                                </div>
                                <p className="text-sm font-semibold tabular-nums">
                                  Rs {Number(it.lineTotal).toFixed(2)}
                                </p>
                              </div>
                              {modifierLines.length > 0 ? (
                                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-neutral-600">
                                  {modifierLines.map((line, idx) => (
                                    <p
                                      key={`${it.id}-summary-m-${idx}`}
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
                      <div className="mt-3 shrink-0 space-y-2 border-t border-slate-200/80 pt-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm shadow-sm">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="tabular-nums">
                              Rs {Number((selectedSupportOrder as any).subtotal ?? 0).toFixed(2)}
                            </span>
                          </div>
                          {Number((selectedSupportOrder as any).discountAmount ?? 0) > 0 ? (
                            <div className="mt-0.5 flex items-center justify-between text-[13px] font-medium text-foreground">
                              <span className="max-w-[62%] leading-snug">
                                Discount
                                {selectedSupportDiscountCaption ? (
                                  <span className="font-normal text-muted-foreground">
                                    {' '}
                                    ({selectedSupportDiscountCaption})
                                  </span>
                                ) : null}
                              </span>
                              <span className="tabular-nums">
                                −Rs{' '}
                                {Number((selectedSupportOrder as any).discountAmount ?? 0).toFixed(2)}
                              </span>
                            </div>
                          ) : null}
                          {Number((selectedSupportOrder as any).deliveryFee ?? 0) > 0 ? (
                            <div className="mt-0.5 flex items-center justify-between text-[13px]">
                              <span className="text-muted-foreground">Delivery</span>
                              <span className="tabular-nums">
                                Rs {Number((selectedSupportOrder as any).deliveryFee ?? 0).toFixed(2)}
                              </span>
                            </div>
                          ) : null}
                          <div className="mt-0.5 flex items-center justify-between text-[13px]">
                            <span className="text-muted-foreground">Tax (VAT)</span>
                            <span className="tabular-nums">
                              Rs {Number((selectedSupportOrder as any).tax ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-base font-black">
                            <span>Total</span>
                            <span className="tabular-nums">
                              Rs {Number((selectedSupportOrder as any).total ?? 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <details className="rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-[11px] text-slate-700">
                          <summary className="cursor-pointer select-none font-medium text-slate-600 outline-none">
                            How line edits work (optional)
                          </summary>
                          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[10px] leading-snug text-slate-600">
                            <li>
                              <strong>Amend lines in POS</strong> → POS tab → <strong>Save line changes</strong>.
                            </li>
                            <li>Once payment shows Paid, line edits lock on the POS (admin can override with a reason).</li>
                            <li>
                              Customer / phone / table: <strong>Queue &amp; Support</strong> support desk.
                            </li>
                          </ol>
                        </details>

                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                          {ordersTabAmendRow ? (
                            ordersTabAmendPolicy.allowed ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-primary/35 bg-primary/[0.04] text-sm font-semibold text-foreground shadow-sm transition hover:bg-primary/10 active:scale-[0.99]"
                                onClick={() => beginAmendOrderLines(ordersTabAmendRow)}
                              >
                                <PencilLine className="h-4 w-4 shrink-0" aria-hidden />
                                Amend lines in POS
                              </Button>
                            ) : (
                              <p className="rounded-lg border border-muted bg-muted/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                                {ordersTabAmendRow.actions?.lineReplaceBlockedMessage ??
                                  ('message' in ordersTabAmendPolicy
                                    ? ordersTabAmendPolicy.message
                                    : 'Line items cannot be edited for this order right now.')}
                              </p>
                            )
                          ) : (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
                              Select an order to enable amendments.
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Payment methods
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] touch-manipulation"
                              disabled={selectedSupportOrder.paymentStatus === 'completed'}
                              onClick={() => void collectAtCounterAndRefreshSupport(selectedSupportOrder.id, 'cash')}
                            >
                              Collect cash
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] touch-manipulation"
                              disabled={selectedSupportOrder.paymentStatus === 'completed'}
                              onClick={() => void collectAtCounterAndRefreshSupport(selectedSupportOrder.id, 'card')}
                            >
                              Collect card
                            </Button>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold shadow-sm transition active:scale-[0.99] touch-manipulation"
                              disabled={
                                selectedSupportOrder.paymentStatus === 'completed' ||
                                Number(selectedSupportOrder.total ?? 0) <= 0
                              }
                              onClick={() => setCashTenderOpen(true)}
                            >
                              Cash &amp; change
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold shadow-sm transition active:scale-[0.99] touch-manipulation"
                              onClick={() => setPosCalculatorOpen(true)}
                            >
                              <CalculatorIcon className="h-5 w-5 shrink-0" aria-hidden />
                              Calculator
                            </Button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] touch-manipulation"
                              onClick={() => void printOrderBill(selectedSupportOrder.id)}
                            >
                              Print bill
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] touch-manipulation"
                              onClick={() => void downloadThermalReceipt(selectedSupportOrder.id)}
                            >
                              Receipt .bin
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </div>
          </section>
        ) : null}
        {activeTab === 'clients' ? (
          <section className="pos-touch-scroll flex-1 overflow-y-auto pr-2">
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
        <section
          className={`${activeTab === 'pos' ? 'min-w-0 flex-1' : 'hidden'} pos-touch-scroll overflow-y-auto pr-1 sm:pr-2`}
        >
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
              <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur-sm md:p-5">
                <div className="flex flex-col gap-4">
                  <div className="relative min-w-0">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      type="search"
                      enterKeyHint="search"
                      autoComplete="off"
                      className="h-14 w-full touch-manipulation rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
                      placeholder="Search menu or category…"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                    />
                  </div>
                  <div
                    className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] lg:flex-wrap lg:overflow-visible"
                    role="tablist"
                    aria-label="Menu categories"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === 'ALL'}
                      className={`min-h-12 shrink-0 touch-manipulation rounded-full px-5 py-2.5 text-sm font-black transition active:scale-[0.98] ${activeCategory === 'ALL' ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-slate-200 bg-white text-slate-700 shadow-sm'}`}
                      onClick={() => setActiveCategory('ALL')}
                    >
                      All ({products.length})
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={activeCategory === cat}
                        className={`min-h-12 shrink-0 touch-manipulation rounded-full px-5 py-2.5 text-sm font-black transition active:scale-[0.98] ${activeCategory === cat ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-slate-200 bg-white text-slate-700 shadow-sm'}`}
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
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-black uppercase tracking-wide text-slate-800">
                        {category}
                      </h3>
                      <span className="shrink-0 text-sm font-semibold text-slate-500">
                        {items.length} items
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {items.map((product) => (
                        <div key={product.id} className="h-full">
                          <ProductPickTile
                            category={product.category}
                            name={product.name}
                            priceLabel={`Rs ${product.price}.00`}
                            thumbnailUrl={product.imageUrl}
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
          className={`${activeTab === 'pos' ? 'flex' : 'hidden'} w-full shrink-0 touch-manipulation flex-col rounded-3xl border border-border bg-card shadow-xl ring-4 ring-muted xl:w-[420px]`}
        >
          <div className="flex items-center justify-between rounded-t-3xl border-b border-border bg-muted/40 p-4 sm:p-5">
            <h2 className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-lg font-black uppercase tracking-tight text-foreground sm:text-xl">
              <span className="inline-flex shrink-0 items-center gap-2">
                <ShoppingCart size={22} className="text-primary" aria-hidden />
                <span className="truncate">Current order</span>
              </span>
              <span
                className={`inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-black tabular-nums ${
                  cartTotalPieces > 0
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                    : 'border border-border/80 bg-background text-muted-foreground'
                }`}
                aria-label={`${cartTotalPieces} pieces in cart`}
              >
                {cartTotalPieces}
              </span>
            </h2>
            {cart.length > 0 && !lineAmendOrderId ? (
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                aria-label="Clear cart"
              >
                <Trash2 size={22} />
              </button>
            ) : null}
          </div>

          {lineAmendOrderId ? (
            <div className="border-b border-violet-200 bg-violet-50 px-5 py-3 text-sm text-violet-950">
              <p className="font-semibold">
                Amending order {lineAmendOrderId.slice(0, 8).toUpperCase()}
              </p>
              <p className="mt-1 text-xs opacity-90">
                Edit the cart, then tap the primary button below to save. Subtotal and tax may change.
              </p>
              {lineAmendNeedsAdminReason ? (
                <label className="mt-3 block text-xs">
                  <span className="font-medium text-violet-900">Admin override reason</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-sm text-foreground"
                    rows={2}
                    value={lineAmendOverrideReason}
                    onChange={(e) => setLineAmendOverrideReason(e.target.value)}
                    placeholder="e.g. Wrong item rung — customer confirmed swap"
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950"
                onClick={() => {
                  clearCart();
                  setLineAmendOrderId(null);
                  setLineAmendSource(null);
                  setLineAmendOverrideReason('');
                }}
              >
                Cancel amendment
              </button>
            </div>
          ) : null}

          <div className="space-y-3 p-4">
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
                  className="group rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex gap-2.5">
                    {(() => {
                      const imageUrl =
                        productImageById.get(String(item.id ?? '').trim()) ??
                        productImageByName.get(String(item.name ?? '').trim().toLowerCase());
                      if (imageUrl) {
                        return (
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                            loading="lazy"
                          />
                        );
                      }
                      return (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-sm font-bold text-muted-foreground">
                          {String(item.name ?? '?').slice(0, 1).toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        Rs {Number(item.unitPrice).toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-black tabular-nums leading-none text-foreground">
                      Rs {(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}
                    </p>
                  </div>

                  {item.selectedOptions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.selectedOptions.map((x, i) => (
                        <span
                          key={`${item.cartId}-opt-${i}`}
                          className="inline-flex max-w-full rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-snug text-slate-600"
                        >
                          <span className="text-slate-400">{x.groupName}</span>
                          <span className="mx-0.5 text-slate-300">·</span>
                          <span className="truncate">{x.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {item.notes ? (
                    <p className="mt-1.5 border-l-2 border-primary/25 pl-2 text-[11px] italic leading-snug text-slate-500">
                      {item.notes}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
                      <button
                        type="button"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg font-bold text-muted-foreground transition hover:bg-white hover:text-foreground active:scale-95"
                        onClick={() => decrementItem(item.cartId)}
                        aria-label={`Decrease quantity for ${item.name}`}
                      >
                        −
                      </button>
                      <span className="min-w-[44px] text-center text-base font-black tabular-nums text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg font-bold text-muted-foreground transition hover:bg-white hover:text-foreground active:scale-95"
                        onClick={() => incrementItem(item.cartId)}
                        aria-label={`Increase quantity for ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm">
                      <button
                        type="button"
                        className="flex min-h-11 min-w-11 items-center justify-center border-r border-slate-200/90 text-muted-foreground transition hover:bg-white hover:text-primary active:scale-95"
                        aria-label={`Edit options and notes for ${item.name}`}
                        onClick={() => startCustomizeFromCart(item)}
                      >
                        <PencilLine size={18} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="flex min-h-11 min-w-11 items-center justify-center border-r border-slate-200/90 text-muted-foreground transition hover:bg-white hover:text-foreground active:scale-95"
                        aria-label={`Kitchen info for ${item.name}`}
                        onClick={() => openInfo(item.id)}
                      >
                        <Info size={18} />
                      </button>
                      <button
                        type="button"
                        className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive active:scale-95"
                        onClick={() => removeItem(item.cartId)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
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
            {cart.length > 0 && !lineAmendOrderId ? (
              <>
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Coupon / promo
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                    placeholder="Code"
                    value={couponCodeInput}
                    onChange={(e) => {
                      setCouponCodeInput(e.target.value);
                      setAppliedCoupon(null);
                    }}
                    disabled={couponApplyLoading}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    disabled={
                      couponApplyLoading || !couponCodeInput.trim() || !isOnline
                    }
                    onClick={() => void handleApplyCoupon()}
                  >
                    {couponApplyLoading ? '…' : 'Apply'}
                  </Button>
                  {appliedCoupon ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCodeInput('');
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                {appliedCoupon ? (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-800">
                    {appliedCoupon.code} · −Rs {appliedCoupon.discountAmount.toFixed(2)} on subtotal
                  </p>
                ) : null}
                {!isOnline ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Go online to validate a coupon.
                  </p>
                ) : null}
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                  Discount is checked again when the order is placed (same rules as online checkout).
                </p>
                </div>
                <PrivilegedManualDiscount isOnline={isOnline} />
              </>
            ) : null}
            <div className="mb-6 flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span>{lineAmendOrderId ? 'Estimated total' : 'Total amount due'}</span>
                {lineAmendOrderId ? (
                  <span className="text-muted-foreground/60">Lines + VAT · save to apply</span>
                ) : cart.length > 0 && fulfillmentType !== 'delivery' ? (
                  <span className="text-muted-foreground/60">Subtotal + VAT</span>
                ) : cart.length > 0 && fulfillmentType === 'delivery' ? (
                  <span className="text-muted-foreground/60">VAT + delivery (estimate)</span>
                ) : null}
              </div>
              {fulfillmentType === 'delivery' && cart.length > 0 && !lineAmendOrderId ? (
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
                          Rs {orderTotalsPreview.subtotal.toFixed(2)}
                        </span>
                      </div>
                      {couponDiscountAmount > 0 ? (
                        <div className="flex justify-between font-medium text-emerald-800">
                          <span>Discount ({appliedCoupon?.code})</span>
                          <span className="tabular-nums">
                            −Rs {couponDiscountAmount.toFixed(2)}
                          </span>
                        </div>
                      ) : null}
                      {manualDiscountPreview > 0 ? (
                        <div className="flex justify-between font-medium text-violet-900">
                          <span>Manual discount</span>
                          <span className="tabular-nums">
                            −Rs {manualDiscountPreview.toFixed(2)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax (VAT)</span>
                        <span className="tabular-nums font-medium text-foreground">
                          Rs {orderTotalsPreview.tax.toFixed(2)}
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
                        Rs {orderTotalsPreview.total.toFixed(2)}
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
              ) : lineAmendOrderId ? (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal (lines)</span>
                    <span className="tabular-nums font-medium text-foreground">
                      Rs {lineAmendTotalsPreview.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      VAT (
                      {(checkoutVatRate * 100).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                      %)
                    </span>
                    <span className="tabular-nums font-medium text-foreground">
                      Rs {lineAmendTotalsPreview.tax.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Line prices exclude VAT. Final totals may differ if the order has discounts or delivery fees.
                  </p>
                  <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                    <span className="text-lg font-bold text-foreground">Estimated total</span>
                    <span className="text-4xl font-black tabular-nums tracking-tighter text-foreground">
                      Rs {lineAmendTotalsPreview.total.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : cart.length > 0 ? (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium text-foreground">
                      Rs {orderTotalsPreview.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {couponDiscountAmount > 0 ? (
                    <div className="flex justify-between text-sm font-medium text-emerald-800">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span className="tabular-nums">
                        −Rs {couponDiscountAmount.toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  {manualDiscountPreview > 0 ? (
                    <div className="flex justify-between text-sm font-medium text-violet-900">
                      <span>Manual discount</span>
                      <span className="tabular-nums">−Rs {manualDiscountPreview.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      VAT (
                      {(checkoutVatRate * 100).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                      %)
                    </span>
                    <span className="tabular-nums font-medium text-foreground">
                      Rs {orderTotalsPreview.tax.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Line prices are before VAT. VAT rate comes from admin checkout settings.
                  </p>
                  <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                    <span className="text-lg font-bold text-foreground">Total due</span>
                    <span className="text-4xl font-black tabular-nums tracking-tighter text-foreground">
                      Rs {orderTotalsPreview.total.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-black tracking-tighter text-foreground">
                    Rs {subtotal.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            {lineAmendOrderId ? (
              <p className="mb-4 px-1 text-[11px] leading-snug text-muted-foreground">
                Fulfillment, customer, and payment settings stay on the order — only lines change here.
              </p>
            ) : null}
            {!lineAmendOrderId ? (
              <>
            <div className="mb-4 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Order intake
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border p-1.5">
                <button
                  type="button"
                  className={`min-h-12 touch-manipulation rounded-lg px-3 py-2.5 text-sm font-black transition active:scale-[0.99] ${orderIntake === 'counter' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                  onClick={() => setOrderIntake('counter')}
                >
                  Counter
                </button>
                <button
                  type="button"
                  className={`min-h-12 touch-manipulation rounded-lg px-3 py-2.5 text-sm font-black transition active:scale-[0.99] ${orderIntake === 'phone' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                  onClick={() => setOrderIntake('phone')}
                >
                  Phone call
                </button>
              </div>
            </div>
            {orderIntake === 'counter' ? (
              <div className="mb-4 grid gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Payment timing
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border p-1.5">
                  <button
                    type="button"
                    className={`min-h-12 touch-manipulation rounded-lg px-3 py-2.5 text-sm font-black transition active:scale-[0.99] ${counterPaymentTiming === 'now' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                    onClick={() => setCounterPaymentTiming('now')}
                  >
                    Pay now
                  </button>
                  <button
                    type="button"
                    className={`min-h-12 touch-manipulation rounded-lg px-3 py-2.5 text-sm font-black transition active:scale-[0.99] ${counterPaymentTiming === 'later' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                    onClick={() => setCounterPaymentTiming('later')}
                  >
                    Pay later
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {counterPaymentTiming === 'now'
                    ? 'Payment is recorded when you place the order (cash/card now).'
                    : 'Kitchen can proceed. You will choose cash or card when you collect payment on the order (before completing handoff).'}
                </p>
              </div>
            ) : (
              <p className="mb-4 text-[11px] leading-snug text-muted-foreground">
                Phone orders collect payment on pickup or delivery (timing follows fulfillment).
              </p>
            )}
            <div className="mb-4 grid gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Fulfillment
              </label>
              <div className="grid grid-cols-3 gap-2 rounded-xl border p-1.5">
                <button
                  type="button"
                  className={`min-h-12 touch-manipulation rounded-lg px-2 py-2.5 text-sm font-black leading-tight transition active:scale-[0.99] sm:px-3 ${fulfillmentType === 'takeaway' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                  onClick={() => setFulfillmentType('takeaway')}
                >
                  Takeaway
                </button>
                <button
                  type="button"
                  className={`min-h-12 touch-manipulation rounded-lg px-2 py-2.5 text-sm font-black leading-tight transition active:scale-[0.99] sm:px-3 ${fulfillmentType === 'dine_in' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                  onClick={() => setFulfillmentType('dine_in')}
                >
                  Dine in
                </button>
                <button
                  type="button"
                  className={`min-h-12 touch-manipulation rounded-lg px-2 py-2.5 text-sm font-black leading-tight transition active:scale-[0.99] sm:px-3 ${fulfillmentType === 'delivery' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
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
                  className="h-12 touch-manipulation rounded-xl border bg-white px-3 text-base"
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
                  className="h-12 touch-manipulation rounded-xl border bg-white px-3 text-base"
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
                className="h-12 touch-manipulation rounded-xl border bg-white px-3 text-base"
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
                  className="h-12 touch-manipulation rounded-xl border bg-white px-3 text-base"
                  placeholder="07XXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 min-w-[88px] shrink-0 px-4 text-sm font-semibold"
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
            {showCounterPaymentMethodPick ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border p-1.5">
                  <button
                    type="button"
                    className={`min-h-12 touch-manipulation rounded-lg px-3 py-2.5 text-sm font-black transition active:scale-[0.99] ${paymentMethod === 'CASH' ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                    onClick={() => setPaymentMethod('CASH')}
                  >
                    {cashPaymentLabel}
                  </button>
                  <button
                    type="button"
                    className={`min-h-12 touch-manipulation rounded-lg px-3 py-2.5 text-sm font-black transition active:scale-[0.99] ${
                      paymentMethod === 'CARD'
                        ? 'bg-primary text-primary-foreground'
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
              </>
            ) : (
              <div className="mb-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">Payment method at collection</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Cash or card is recorded when you tap <strong>Collect cash</strong> or{' '}
                  <strong>Collect card</strong> on the order — nothing to choose here.
                </p>
              </div>
            )}
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
              </>
            ) : null}
            <Button
              type="button"
              onClick={handleCheckout}
              disabled={!canSubmitOrder}
              size="lg"
              className="h-auto min-h-[56px] w-full touch-manipulation rounded-2xl py-5 text-xl font-black shadow-xl active:scale-[0.99] disabled:active:scale-100"
            >
              <CreditCard size={24} />
              {lineAmendSaving
                ? 'SAVING…'
                : lineAmendOrderId
                  ? 'SAVE LINE CHANGES'
                  : submittingOrder
                    ? 'QUEUING...'
                    : orderIntake === 'phone'
                      ? 'PLACE PHONE ORDER'
                      : counterPaymentTiming === 'later'
                        ? 'PLACE ORDER — PAY LATER'
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
      </div>

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
      <Dialog
        open={customizeOpen}
        onOpenChange={(open) => {
          setCustomizeOpen(open);
          if (!open) setCustomizingCartId(null);
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[88vh] flex-col overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.45)] sm:max-w-2xl sm:rounded-[28px]"
        >
          <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-6 py-5 text-left sm:px-8">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              {productToCustomize?.name ?? 'Customize item'}
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              {customizingCartId
                ? 'Change options or notes — quantity stays the same'
                : 'Select options and notes'}
            </p>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col bg-neutral-50/40">
            <div className="border-b border-neutral-100 bg-white/90 px-6 py-3 sm:px-8">
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                <button
                  type="button"
                  className={`min-h-11 rounded-xl px-3 py-2 text-sm font-black transition ${
                    customizeTab === 'options' ? 'bg-primary text-white' : 'text-slate-600'
                  }`}
                  onClick={() => setCustomizeTab('options')}
                >
                  Options
                </button>
                <button
                  type="button"
                  className={`min-h-11 rounded-xl px-3 py-2 text-sm font-black transition ${
                    customizeTab === 'notes' ? 'bg-primary text-white' : 'text-slate-600'
                  }`}
                  onClick={() => setCustomizeTab('notes')}
                >
                  Notes
                </button>
              </div>
            </div>
            <div className="pos-touch-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 pb-4 sm:px-8 sm:py-7">
              {customizeTab === 'options' ? (
                (productToCustomize?.modifierGroups ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No optional add-ons for this item.
                  </p>
                ) : (
                  (productToCustomize?.modifierGroups ?? []).map((g) => (
                    <div key={g.groupId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="mb-3 text-sm font-semibold text-neutral-800">
                        {g.name} {g.required ? '(required)' : '(optional)'}
                      </p>
                      <div className="grid gap-2">
                        {g.type === 'single' && !g.required ? (
                          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-muted-foreground">
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
                          const priceAdjust = Number(o.priceAdjust ?? 0);
                          return (
                            <label
                              key={o.optionId}
                              className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                                checked
                                  ? 'border-primary/40 bg-primary/[0.06]'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type={g.type === 'single' ? 'radio' : 'checkbox'}
                                  name={g.groupId}
                                  checked={checked}
                                  onChange={() =>
                                    toggleOption(g.groupId, o.optionId, g.type)
                                  }
                                />
                                <span className="font-medium text-slate-800">{o.label}</span>
                              </div>
                              {priceAdjust > 0 ? (
                                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  +Rs {priceAdjust.toFixed(2)}
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )
              ) : (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <label className="text-sm font-semibold text-neutral-800">
                    Item notes (optional)
                  </label>
                  <textarea
                    className="min-h-[180px] rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm leading-relaxed"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="No onions, extra spicy, cut in half..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: add allergy alerts, packing instructions, and spice level notes.
                  </p>
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
              <Button onClick={addCustomizedItem} className="h-12 w-full rounded-xl text-base font-black shadow-sm">
                {customizingCartId ? 'Update line' : 'Add to cart'} · Rs {customizeTotal.toFixed(2)}
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
                            void openBrowserPrintBill(selectedSupportOrder);
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
                        <div className="mt-3 space-y-3 border-t border-primary/10 pt-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="min-h-11 touch-manipulation rounded-xl px-4 text-sm font-bold active:scale-[0.99]"
                              disabled={cashBusy}
                              onClick={() =>
                                void collectAtCounterAndRefreshSupport(selectedSupportOrder.id, 'cash')
                              }
                            >
                              {cashBusy ? 'Recording…' : 'Collect cash'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 touch-manipulation rounded-xl px-4 text-sm font-bold active:scale-[0.99]"
                              disabled={cashBusy}
                              onClick={() =>
                                void collectAtCounterAndRefreshSupport(selectedSupportOrder.id, 'card')
                              }
                            >
                              Collect card
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-[52px] touch-manipulation rounded-xl text-sm font-bold active:scale-[0.99]"
                              disabled={cashBusy}
                              onClick={() => setCashTenderOpen(true)}
                            >
                              Cash &amp; change
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex min-h-[52px] touch-manipulation items-center justify-center gap-2 rounded-xl text-sm font-bold active:scale-[0.99]"
                              onClick={() => setPosCalculatorOpen(true)}
                            >
                              <CalculatorIcon className="h-5 w-5 shrink-0" aria-hidden />
                              Calc
                            </Button>
                          </div>
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
              <div className="pos-touch-scroll space-y-5 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
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
                      title="Money collected — not the same as food served or delivered."
                    >
                      {formatPaymentStatusDisplayLabel(selectedSupportOrder.paymentStatus)}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                      {formatPaymentCollectionDisplayLabel(
                        selectedSupportOrder.paymentCollection ?? 'immediate',
                        selectedSupportOrder.fulfillmentType,
                      )}
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
                        const imageUrl = productImageByName.get(String(it.name ?? '').trim().toLowerCase());
                        const modifierLines = getOrderItemModifierDisplayLines(it.modifiers);
                        return (
                          <div key={it.id}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-2">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={it.name}
                                    className="h-10 w-10 shrink-0 rounded-lg border object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs font-bold text-muted-foreground">
                                    {String(it.name ?? '?').slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <p className="text-sm text-neutral-700">
                                  {it.quantity}x {it.name}
                                </p>
                              </div>
                              <p className="text-sm font-semibold tabular-nums text-neutral-800">
                                Rs {Number(it.lineTotal).toFixed(2)}
                              </p>
                            </div>
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
                      <p className="text-neutral-600">
                        Discount
                        {selectedSupportDiscountCaption ? (
                          <span className="block text-[11px] font-normal text-neutral-500">
                            {selectedSupportDiscountCaption}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-right font-semibold text-emerald-800">
                        −Rs {Number((selectedSupportOrder as any).discountAmount ?? 0).toFixed(2)}
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
                    const imageUrl = productImageByName.get(String(it.name ?? '').trim().toLowerCase());
                    const modifierLines = getOrderItemModifierDisplayLines(it.modifiers);
                    return (
                      <div key={it.id}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={it.name}
                                className="h-9 w-9 shrink-0 rounded-lg border object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-[10px] font-bold text-muted-foreground">
                                {String(it.name ?? '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <p>
                              {it.quantity}x {it.name}
                            </p>
                          </div>
                          <p className="tabular-nums">Rs {Number(it.lineTotal).toFixed(2)}</p>
                        </div>
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
                const gateRow = queueOrders.find((q) => q.id === supportEditOrder.id);
                const supportBlocked = gateRow?.actions?.canEditSupportDetails === false;
                if (supportBlocked) {
                  toast.error(
                    gateRow?.actions?.supportEditBlockedMessage ??
                      'Support details cannot be edited for this order right now.',
                  );
                  return;
                }
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

      <CashTenderDialog
        open={cashTenderOpen}
        onOpenChange={setCashTenderOpen}
        amountDue={
          selectedSupportOrder ? Number(selectedSupportOrder.total ?? 0) : 0
        }
        onConfirmCollection={
          selectedSupportOrder
            ? async (detail) => {
                await collectCashFromQueue(
                  selectedSupportOrder.id,
                  'Collected via Cash & change',
                  detail,
                );
                await openSupportOrder(selectedSupportOrder.id);
              }
            : undefined
        }
      />
      <CashTenderDialog
        open={Boolean(pendingCashCollect)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCashCollect(null);
            cashCollectAfterRef.current = undefined;
          }
        }}
        amountDue={pendingCashCollect?.total ?? 0}
        purpose="record_collection"
        onConfirmCollection={async (detail) => {
          const pc = pendingCashCollect;
          if (!pc) return;
          const note = appendCashTenderAuditToNote('Collected at cashier handoff', detail);
          const { ok, body } = await patchMarkCashReceived(pc.orderId, note);
          if (!ok) return;
          const data = body as { collectionApplied?: boolean };
          if (data?.collectionApplied === false) {
            toast.info('Cash was already marked collected for this order.');
          } else {
            toast.success('Cash collected.');
          }
          await handleCashCollectRecorded(pc.orderId, body);
        }}
      />
      <CardCollectConfirmDialog
        open={Boolean(pendingCardCollect)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCardCollect(null);
            cardCollectAfterRef.current = undefined;
          }
        }}
        orderId={pendingCardCollect?.orderId ?? ''}
        amountDueLkr={pendingCardCollect?.total ?? 0}
        requireSupervisorElevation={requireSupervisorForCardCollection}
        bypassSupervisorAsAdmin={cashierProfile?.role === 'ADMIN'}
        isOnline={isOnline}
        fetchProtectedNest={fetchProtectedNest}
        supervisorEmailDefault={
          supervisorEmailInput.trim() || cashierProfile?.email || ''
        }
        onRecorded={handleCardCollectRecorded}
      />
      <CashTenderDialog
        open={checkoutPayNowConfirm === 'cash'}
        onOpenChange={(open) => {
          if (!open) setCheckoutPayNowConfirm(null);
        }}
        amountDue={orderTotalsPreview.total}
        purpose="place_order"
        onConfirmCollection={(detail) => {
          void runPlaceOrderPayment({ skipPayNowGate: true, cashTenderDetail: detail });
        }}
      />
      <CardCollectConfirmDialog
        open={checkoutPayNowConfirm === 'card'}
        onOpenChange={(open) => {
          if (!open) setCheckoutPayNowConfirm(null);
        }}
        amountDueLkr={orderTotalsPreview.total}
        onCheckoutConfirmed={() => {
          void runPlaceOrderPayment({ skipPayNowGate: true });
        }}
      />
      <PosCalculatorDialog
        open={posCalculatorOpen}
        onOpenChange={setPosCalculatorOpen}
        quickAmounts={posCalculatorQuickAmounts}
        orderHint={
          selectedSupportOrder
            ? `#${String(selectedSupportOrder.id).slice(0, 8).toUpperCase()}`
            : undefined
        }
        vatRate={checkoutVatRate}
      />
    </OpsLayout>
  );
}
