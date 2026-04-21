// libs/contracts/src/index.ts
// ⛔ LSA-ONLY — Public API of @wrap-roll/contracts
// All domains import ONLY from this file. Never import schema files directly.

// ── Order ──────────────────────────────────────────────────────────────────
export {
  WrapOrderSchema,
  WrapOrderLineModifiersSchema,
  OrderStatusSchema,
  AvailabilitySchema,
  ORDER_STATUSES,
  ORDER_SOURCES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  FULFILLMENT_TYPES,
  type WrapOrder,
  type WrapOrderItem,
  type WrapOrderLineModifiers,
  type OrderStatus,
  type Availability,
} from './order.schema';
export {
  type QueueOrder,
  type SupportOrderDetails,
  type PaymentEventRow,
  type OpsActivityEventRow,
  type OpsActivityFeedPage,
  type OpsActorRef,
  OPS_ACTIVITY_APP_FILTERS,
  OPS_ACTIVITY_ACTOR_ROLE_FILTERS,
  type NotificationDeliveryRow,
  type NotificationDeliveryFeedPage,
  type StaffNotificationRow,
  type StaffNotificationFeedPage,
  type CashierOrderLineInput,
  type CashierOrderLineOption,
  type CashierOrderSyncPayload,
  type CashierPaymentMethod,
  type CashierPaymentCollection,
  type CashierOrderSource,
  type DeliveryPaymentCollectionMethod,
  type MarkPaymentReceivedPayload,
  formatPaymentCollectionLabel,
  type QueueOrderStatus,
  type QueueMoveBlockedReason,
  type QueueOrderActions,
  ORDER_FLOW_BOARD_STATUSES,
  PAYMENT_FLOW_BOARD_STATUSES,
} from './order.api.contracts';
export {
  OPS_ACTIVITY_ENTITY_TYPE_FILTERS,
  type OpsActivityEntityTypeFilter,
  ACTIVITY_APP_LABELS,
  ACTIVITY_ENTITY_TYPE_LABELS,
  ACTIVITY_EVENT_TYPE_LABELS,
  formatActivityApp,
  formatActivityEntityType,
  formatActivityEventTypeLabel,
  formatActivityActorRole,
  activityEventLooksLikeFailure,
  getActivityEventVisualHints,
} from './activity.labels';
export {
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_DELIVERY_STATUS_LABELS,
  NOTIFICATION_TEMPLATE_KEY_LABELS,
  STAFF_NOTIFICATION_KIND_LABELS,
  NOTIFICATION_PAGE_COPY,
  notificationInboxSectionTitle,
  formatNotificationChannel,
  formatNotificationDeliveryStatus,
  formatNotificationTemplateKey,
  formatStaffNotificationKind,
  parseNestProxyErrorDetail,
  formatNotificationPageApiError,
  formatNotificationDeliveryMetaLine,
  notificationDeliveryLooksLikeError,
  getNotificationDeliveryVisualHints,
  shortNotificationOrderRef,
  staffNotificationSummaryLine,
} from './notification.labels';
export { mergeQueueOrderFromApiPatch } from './queue-order-optimistic-merge';

// ── Queue response projections (least-privilege JSON by staff role) ────────
export {
  type ResponsePersona,
  staffRoleToResponsePersona,
  isStaffRole,
} from './response/response-persona';
export {
  type OpsQueueOrder,
  type KitchenQueueOrder,
  type KitchenQueueOrderItem,
  type CourierQueueOrder,
  type CourierQueueOrderItem,
  projectQueueOrderForPersona,
  KITCHEN_QUEUE_FORBIDDEN_KEYS,
} from './response/order-queue-projection';
export { KitchenQueueOrderSchema, CourierQueueOrderSchema } from './response/order-queue-projection.schema';
export {
  COURIER_QUEUE_FORBIDDEN_KEYS,
  courierQueueForbiddenKeysPresent,
  describeQueueProjectionZodIssues,
  kitchenQueueForbiddenKeysPresent,
  listForbiddenKeysPresent,
} from './response/queue-projection-runtime';

// ── Menu ───────────────────────────────────────────────────────────────────
export {
  MenuItemSchema,
  MenuItemImageUrlSchema,
  ModifierGroupSchema,
  CreateMenuItemSchema,
  UpdateMenuItemSchema,
  ModifierGroupInputSchema,
  MenuRecipeLineInputSchema,
  UpsertMenuRecipeSchema,
  MENU_ITEM_IMAGE_URL_MAX_LEN,
  isMenuItemImageUrl,
  type MenuItem,
  type ModifierGroup,
  type CreateMenuItemInput,
  type UpdateMenuItemInput,
  type ModifierGroupInput,
  type ModifierDefaultsByGroup,
  type MenuRecipeLineInput,
  type UpsertMenuRecipeInput,
} from './menu.schema';

// ── Storefront pricing (client checkout ↔ API order mapping) ─────────────
export {
  CLIENT_WEB_CHECKOUT_VAT_RATE,
  normalizeCheckoutVatRate,
  computeClientWebCheckoutTotals,
  computeCheckoutBreakdown,
} from './storefront-pricing';
export {
  CASHIER_RESOLVE_ORDER_QUERY,
  buildCashierResolveOrderUrl,
} from './cashier-handoff';

// ── Delivery JSON (settings.deliveryJson) ─────────────────────────────────
export {
  parseDeliveryJson,
  haversineDistanceKm,
  computeDeliveryFeeLkr,
  type ParsedDeliveryJson,
  type DeliveryFeeMode,
  type DistanceBand,
  type ComputeDeliveryFeeResult,
  type DeliveryFeeErrorCode,
} from './delivery-json';

// ── Inventory (Sprint S5, apps/admin only) ─────────────────────────────────
export {
  IngredientSchema,
  CreateIngredientInputSchema,
  UpdateIngredientInputSchema,
  CreateRestockEntryInputSchema,
  CreateWasteEntryInputSchema,
  CreateStockAdjustmentInputSchema,
  CreateOverheadCostEntryInputSchema,
  InventoryMovementSchema,
  IngredientValuationSnapshotSchema,
  OrderCogsLineSchema,
  DatedMarginReportSchema,
  RecipeIngredientSchema,
  RestockLogSchema,
  LowStockAlertSchema,
  IngredientUnitSchema,
  InventoryMovementTypeSchema,
  InventoryReferenceTypeSchema,
  OverheadCostTypeSchema,
  OverheadAllocationScopeSchema,
  type Ingredient,
  type CreateIngredientInput,
  type UpdateIngredientInput,
  type CreateRestockEntryInput,
  type CreateWasteEntryInput,
  type CreateStockAdjustmentInput,
  type CreateOverheadCostEntryInput,
  type InventoryMovement,
  type IngredientValuationSnapshot,
  type OrderCogsLine,
  type DatedMarginReport,
  type RecipeIngredient,
  type RestockLog,
  type LowStockAlert,
  type IngredientUnit,
  type InventoryMovementType,
  type InventoryReferenceType,
  type OverheadCostType,
  type OverheadAllocationScope,
} from './inventory.schema';


// ── Customer ──────────────────────────────────────────────────────────────
export {
  CustomerAddressSchema,
  SavedPaymentTokenSchema,
  CustomerSchema,
  CustomerHistoryOrderSchema,
  type CustomerAddress,
  type SavedPaymentToken,
  type Customer,
  type CustomerHistoryOrder,
} from './customer.schema';

// ── Settings ────────────────────────────────────────────────────────────────
export {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_CONFIG,
  DEFAULT_OPERATIONS_CALENDAR,
  type PaymentMethodsConfig,
  type NormalizedPaymentConfig,
  type PublicBusinessSettings,
  type OperationsCalendar,
  type SpecialHoursEntry,
} from './settings.contracts';

// ── Staff ───────────────────────────────────────────────────────────────────
export {
  STAFF_ROLES,
  SHOPPER_ROLE,
  type StaffRole,
  type ShopperRole,
  type StaffAuthUserView,
} from './staff.contracts';

// ── Payments ─────────────────────────────────────────────────────────────────
export {
  PayHereWebhookSchema,
  type PayHereWebhookPayload,
} from './payment.contracts';

// ── Async / Queue / Outbox ───────────────────────────────────────────────────
export {
  BULLMQ_QUEUE,
  BULLMQ_QUEUE_NAMES,
  OUTBOX_STATUS,
  NOTIFICATION_JOB,
  PRINT_JOB,
  ACTIVITY_JOB,
  INVENTORY_JOB,
  PAYMENT_JOB,
  OUTBOX_EVENT_PREFIX,
  outboxEventStartsWith,
  NotificationJobPayloadSchema,
  PrintJobPayloadSchema,
  ActivityJobPayloadSchema,
  InventoryJobPayloadSchema,
  PaymentJobPayloadSchema,
  OutboxEnvelopeSchema,
  OutboxRelayJobPayloadSchema,
  type BullMqQueueName,
  type OutboxStatus,
  type NotificationJobName,
  type PrintJobName,
  type ActivityJobName,
  type InventoryJobName,
  type PaymentJobName,
  type OutboxEventPrefix,
  type NotificationJobPayload,
  type PrintJobPayload,
  type ActivityJobPayload,
  type InventoryJobPayload,
  type PaymentJobPayload,
  type OutboxRelayJobPayload,
  type OutboxEnvelope,
} from './async.contracts';

// ── Analytics (Sprint S20) ───────────────────────────────────────────────────
export {
  // Constants
  ANALYTICS_GROUPINGS,
  PIPELINE_STATUSES,
  ACTIVE_PIPELINE_STATUSES,
  // Schemas
  DailySalesReportSchema,
  SalesStatPointSchema,
  SalesStatsResponseSchema,
  ItemMarginSchema,
  ItemMarginsResponseSchema,
  PaymentReconciliationSchema,
  PipelineStageSchema,
  PipelineTotalsSchema,
  OrderPipelineResponseSchema,
  TopSellerItemSchema,
  TopSellersResponseSchema,
  DailyIngredientConsumptionRowSchema,
  IngredientConsumptionTotalSchema,
  DailyIngredientConsumptionReportSchema,
  // Types (inferred)
  type AnalyticsGrouping,
  type PipelineStatus,
  type DailySalesReport,
  type SalesStatPoint,
  type SalesStatsResponse,
  type ItemMargin,
  type ItemMarginsResponse,
  type PaymentReconciliation,
  type PipelineStage,
  type PipelineTotals,
  type OrderPipelineResponse,
  type TopSellerItem,
  type TopSellersResponse,
  type DailyIngredientConsumptionRow,
  type IngredientConsumptionTotal,
  type DailyIngredientConsumptionReport,
  // Query param helpers
  type SalesStatsQuery,
  type GrossMarginQuery,
  type TopSellersQuery,
  type DailyConsumptionQuery,
} from './analytics.contracts';
