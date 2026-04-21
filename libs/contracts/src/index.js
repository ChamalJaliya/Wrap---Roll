"use strict";
// libs/contracts/src/index.ts
// ⛔ LSA-ONLY — Public API of @wrap-roll/contracts
// All domains import ONLY from this file. Never import schema files directly.
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeQueueProjectionZodIssues = exports.courierQueueForbiddenKeysPresent = exports.COURIER_QUEUE_FORBIDDEN_KEYS = exports.CourierQueueOrderSchema = exports.KitchenQueueOrderSchema = exports.KITCHEN_QUEUE_FORBIDDEN_KEYS = exports.projectQueueOrderForPersona = exports.isStaffRole = exports.staffRoleToResponsePersona = exports.mergeQueueOrderFromApiPatch = exports.staffNotificationSummaryLine = exports.shortNotificationOrderRef = exports.getNotificationDeliveryVisualHints = exports.notificationDeliveryLooksLikeError = exports.formatNotificationDeliveryMetaLine = exports.formatNotificationPageApiError = exports.parseNestProxyErrorDetail = exports.formatStaffNotificationKind = exports.formatNotificationTemplateKey = exports.formatNotificationDeliveryStatus = exports.formatNotificationChannel = exports.notificationInboxSectionTitle = exports.NOTIFICATION_PAGE_COPY = exports.STAFF_NOTIFICATION_KIND_LABELS = exports.NOTIFICATION_TEMPLATE_KEY_LABELS = exports.NOTIFICATION_DELIVERY_STATUS_LABELS = exports.NOTIFICATION_CHANNEL_LABELS = exports.getActivityEventVisualHints = exports.activityEventLooksLikeFailure = exports.formatActivityActorRole = exports.formatActivityEventTypeLabel = exports.formatActivityEntityType = exports.formatActivityApp = exports.ACTIVITY_EVENT_TYPE_LABELS = exports.ACTIVITY_ENTITY_TYPE_LABELS = exports.ACTIVITY_APP_LABELS = exports.OPS_ACTIVITY_ENTITY_TYPE_FILTERS = exports.PAYMENT_FLOW_BOARD_STATUSES = exports.ORDER_FLOW_BOARD_STATUSES = exports.formatPaymentCollectionLabel = exports.OPS_ACTIVITY_ACTOR_ROLE_FILTERS = exports.OPS_ACTIVITY_APP_FILTERS = exports.FULFILLMENT_TYPES = exports.PAYMENT_STATUSES = exports.PAYMENT_METHODS = exports.ORDER_SOURCES = exports.ORDER_STATUSES = exports.AvailabilitySchema = exports.OrderStatusSchema = exports.WrapOrderSchema = void 0;
exports.PIPELINE_STATUSES = exports.ANALYTICS_GROUPINGS = exports.PayHereWebhookSchema = exports.SHOPPER_ROLE = exports.STAFF_ROLES = exports.DEFAULT_OPERATIONS_CALENDAR = exports.DEFAULT_PAYMENT_CONFIG = exports.DEFAULT_PAYMENT_METHODS = exports.CustomerHistoryOrderSchema = exports.CustomerSchema = exports.SavedPaymentTokenSchema = exports.CustomerAddressSchema = exports.OverheadAllocationScopeSchema = exports.OverheadCostTypeSchema = exports.InventoryReferenceTypeSchema = exports.InventoryMovementTypeSchema = exports.IngredientUnitSchema = exports.LowStockAlertSchema = exports.RestockLogSchema = exports.RecipeIngredientSchema = exports.DatedMarginReportSchema = exports.OrderCogsLineSchema = exports.IngredientValuationSnapshotSchema = exports.InventoryMovementSchema = exports.CreateOverheadCostEntryInputSchema = exports.CreateStockAdjustmentInputSchema = exports.CreateWasteEntryInputSchema = exports.CreateRestockEntryInputSchema = exports.UpdateIngredientInputSchema = exports.CreateIngredientInputSchema = exports.IngredientSchema = exports.computeDeliveryFeeLkr = exports.haversineDistanceKm = exports.parseDeliveryJson = exports.computeCheckoutBreakdown = exports.computeClientWebCheckoutTotals = exports.normalizeCheckoutVatRate = exports.CLIENT_WEB_CHECKOUT_VAT_RATE = exports.isMenuItemImageUrl = exports.MENU_ITEM_IMAGE_URL_MAX_LEN = exports.UpsertMenuRecipeSchema = exports.MenuRecipeLineInputSchema = exports.ModifierGroupInputSchema = exports.UpdateMenuItemSchema = exports.CreateMenuItemSchema = exports.ModifierGroupSchema = exports.MenuItemImageUrlSchema = exports.MenuItemSchema = exports.listForbiddenKeysPresent = exports.kitchenQueueForbiddenKeysPresent = void 0;
exports.DailyIngredientConsumptionReportSchema = exports.IngredientConsumptionTotalSchema = exports.DailyIngredientConsumptionRowSchema = exports.TopSellersResponseSchema = exports.TopSellerItemSchema = exports.OrderPipelineResponseSchema = exports.PipelineTotalsSchema = exports.PipelineStageSchema = exports.PaymentReconciliationSchema = exports.ItemMarginsResponseSchema = exports.ItemMarginSchema = exports.SalesStatsResponseSchema = exports.SalesStatPointSchema = exports.DailySalesReportSchema = exports.ACTIVE_PIPELINE_STATUSES = void 0;
// ── Order ──────────────────────────────────────────────────────────────────
var order_schema_1 = require("./order.schema");
Object.defineProperty(exports, "WrapOrderSchema", { enumerable: true, get: function () { return order_schema_1.WrapOrderSchema; } });
Object.defineProperty(exports, "OrderStatusSchema", { enumerable: true, get: function () { return order_schema_1.OrderStatusSchema; } });
Object.defineProperty(exports, "AvailabilitySchema", { enumerable: true, get: function () { return order_schema_1.AvailabilitySchema; } });
Object.defineProperty(exports, "ORDER_STATUSES", { enumerable: true, get: function () { return order_schema_1.ORDER_STATUSES; } });
Object.defineProperty(exports, "ORDER_SOURCES", { enumerable: true, get: function () { return order_schema_1.ORDER_SOURCES; } });
Object.defineProperty(exports, "PAYMENT_METHODS", { enumerable: true, get: function () { return order_schema_1.PAYMENT_METHODS; } });
Object.defineProperty(exports, "PAYMENT_STATUSES", { enumerable: true, get: function () { return order_schema_1.PAYMENT_STATUSES; } });
Object.defineProperty(exports, "FULFILLMENT_TYPES", { enumerable: true, get: function () { return order_schema_1.FULFILLMENT_TYPES; } });
var order_api_contracts_1 = require("./order.api.contracts");
Object.defineProperty(exports, "OPS_ACTIVITY_APP_FILTERS", { enumerable: true, get: function () { return order_api_contracts_1.OPS_ACTIVITY_APP_FILTERS; } });
Object.defineProperty(exports, "OPS_ACTIVITY_ACTOR_ROLE_FILTERS", { enumerable: true, get: function () { return order_api_contracts_1.OPS_ACTIVITY_ACTOR_ROLE_FILTERS; } });
Object.defineProperty(exports, "formatPaymentCollectionLabel", { enumerable: true, get: function () { return order_api_contracts_1.formatPaymentCollectionLabel; } });
Object.defineProperty(exports, "ORDER_FLOW_BOARD_STATUSES", { enumerable: true, get: function () { return order_api_contracts_1.ORDER_FLOW_BOARD_STATUSES; } });
Object.defineProperty(exports, "PAYMENT_FLOW_BOARD_STATUSES", { enumerable: true, get: function () { return order_api_contracts_1.PAYMENT_FLOW_BOARD_STATUSES; } });
var activity_labels_1 = require("./activity.labels");
Object.defineProperty(exports, "OPS_ACTIVITY_ENTITY_TYPE_FILTERS", { enumerable: true, get: function () { return activity_labels_1.OPS_ACTIVITY_ENTITY_TYPE_FILTERS; } });
Object.defineProperty(exports, "ACTIVITY_APP_LABELS", { enumerable: true, get: function () { return activity_labels_1.ACTIVITY_APP_LABELS; } });
Object.defineProperty(exports, "ACTIVITY_ENTITY_TYPE_LABELS", { enumerable: true, get: function () { return activity_labels_1.ACTIVITY_ENTITY_TYPE_LABELS; } });
Object.defineProperty(exports, "ACTIVITY_EVENT_TYPE_LABELS", { enumerable: true, get: function () { return activity_labels_1.ACTIVITY_EVENT_TYPE_LABELS; } });
Object.defineProperty(exports, "formatActivityApp", { enumerable: true, get: function () { return activity_labels_1.formatActivityApp; } });
Object.defineProperty(exports, "formatActivityEntityType", { enumerable: true, get: function () { return activity_labels_1.formatActivityEntityType; } });
Object.defineProperty(exports, "formatActivityEventTypeLabel", { enumerable: true, get: function () { return activity_labels_1.formatActivityEventTypeLabel; } });
Object.defineProperty(exports, "formatActivityActorRole", { enumerable: true, get: function () { return activity_labels_1.formatActivityActorRole; } });
Object.defineProperty(exports, "activityEventLooksLikeFailure", { enumerable: true, get: function () { return activity_labels_1.activityEventLooksLikeFailure; } });
Object.defineProperty(exports, "getActivityEventVisualHints", { enumerable: true, get: function () { return activity_labels_1.getActivityEventVisualHints; } });
var notification_labels_1 = require("./notification.labels");
Object.defineProperty(exports, "NOTIFICATION_CHANNEL_LABELS", { enumerable: true, get: function () { return notification_labels_1.NOTIFICATION_CHANNEL_LABELS; } });
Object.defineProperty(exports, "NOTIFICATION_DELIVERY_STATUS_LABELS", { enumerable: true, get: function () { return notification_labels_1.NOTIFICATION_DELIVERY_STATUS_LABELS; } });
Object.defineProperty(exports, "NOTIFICATION_TEMPLATE_KEY_LABELS", { enumerable: true, get: function () { return notification_labels_1.NOTIFICATION_TEMPLATE_KEY_LABELS; } });
Object.defineProperty(exports, "STAFF_NOTIFICATION_KIND_LABELS", { enumerable: true, get: function () { return notification_labels_1.STAFF_NOTIFICATION_KIND_LABELS; } });
Object.defineProperty(exports, "NOTIFICATION_PAGE_COPY", { enumerable: true, get: function () { return notification_labels_1.NOTIFICATION_PAGE_COPY; } });
Object.defineProperty(exports, "notificationInboxSectionTitle", { enumerable: true, get: function () { return notification_labels_1.notificationInboxSectionTitle; } });
Object.defineProperty(exports, "formatNotificationChannel", { enumerable: true, get: function () { return notification_labels_1.formatNotificationChannel; } });
Object.defineProperty(exports, "formatNotificationDeliveryStatus", { enumerable: true, get: function () { return notification_labels_1.formatNotificationDeliveryStatus; } });
Object.defineProperty(exports, "formatNotificationTemplateKey", { enumerable: true, get: function () { return notification_labels_1.formatNotificationTemplateKey; } });
Object.defineProperty(exports, "formatStaffNotificationKind", { enumerable: true, get: function () { return notification_labels_1.formatStaffNotificationKind; } });
Object.defineProperty(exports, "parseNestProxyErrorDetail", { enumerable: true, get: function () { return notification_labels_1.parseNestProxyErrorDetail; } });
Object.defineProperty(exports, "formatNotificationPageApiError", { enumerable: true, get: function () { return notification_labels_1.formatNotificationPageApiError; } });
Object.defineProperty(exports, "formatNotificationDeliveryMetaLine", { enumerable: true, get: function () { return notification_labels_1.formatNotificationDeliveryMetaLine; } });
Object.defineProperty(exports, "notificationDeliveryLooksLikeError", { enumerable: true, get: function () { return notification_labels_1.notificationDeliveryLooksLikeError; } });
Object.defineProperty(exports, "getNotificationDeliveryVisualHints", { enumerable: true, get: function () { return notification_labels_1.getNotificationDeliveryVisualHints; } });
Object.defineProperty(exports, "shortNotificationOrderRef", { enumerable: true, get: function () { return notification_labels_1.shortNotificationOrderRef; } });
Object.defineProperty(exports, "staffNotificationSummaryLine", { enumerable: true, get: function () { return notification_labels_1.staffNotificationSummaryLine; } });
var queue_order_optimistic_merge_1 = require("./queue-order-optimistic-merge");
Object.defineProperty(exports, "mergeQueueOrderFromApiPatch", { enumerable: true, get: function () { return queue_order_optimistic_merge_1.mergeQueueOrderFromApiPatch; } });
// ── Queue response projections (least-privilege JSON by staff role) ────────
var response_persona_1 = require("./response/response-persona");
Object.defineProperty(exports, "staffRoleToResponsePersona", { enumerable: true, get: function () { return response_persona_1.staffRoleToResponsePersona; } });
Object.defineProperty(exports, "isStaffRole", { enumerable: true, get: function () { return response_persona_1.isStaffRole; } });
var order_queue_projection_1 = require("./response/order-queue-projection");
Object.defineProperty(exports, "projectQueueOrderForPersona", { enumerable: true, get: function () { return order_queue_projection_1.projectQueueOrderForPersona; } });
Object.defineProperty(exports, "KITCHEN_QUEUE_FORBIDDEN_KEYS", { enumerable: true, get: function () { return order_queue_projection_1.KITCHEN_QUEUE_FORBIDDEN_KEYS; } });
var order_queue_projection_schema_1 = require("./response/order-queue-projection.schema");
Object.defineProperty(exports, "KitchenQueueOrderSchema", { enumerable: true, get: function () { return order_queue_projection_schema_1.KitchenQueueOrderSchema; } });
Object.defineProperty(exports, "CourierQueueOrderSchema", { enumerable: true, get: function () { return order_queue_projection_schema_1.CourierQueueOrderSchema; } });
var queue_projection_runtime_1 = require("./response/queue-projection-runtime");
Object.defineProperty(exports, "COURIER_QUEUE_FORBIDDEN_KEYS", { enumerable: true, get: function () { return queue_projection_runtime_1.COURIER_QUEUE_FORBIDDEN_KEYS; } });
Object.defineProperty(exports, "courierQueueForbiddenKeysPresent", { enumerable: true, get: function () { return queue_projection_runtime_1.courierQueueForbiddenKeysPresent; } });
Object.defineProperty(exports, "describeQueueProjectionZodIssues", { enumerable: true, get: function () { return queue_projection_runtime_1.describeQueueProjectionZodIssues; } });
Object.defineProperty(exports, "kitchenQueueForbiddenKeysPresent", { enumerable: true, get: function () { return queue_projection_runtime_1.kitchenQueueForbiddenKeysPresent; } });
Object.defineProperty(exports, "listForbiddenKeysPresent", { enumerable: true, get: function () { return queue_projection_runtime_1.listForbiddenKeysPresent; } });
// ── Menu ───────────────────────────────────────────────────────────────────
var menu_schema_1 = require("./menu.schema");
Object.defineProperty(exports, "MenuItemSchema", { enumerable: true, get: function () { return menu_schema_1.MenuItemSchema; } });
Object.defineProperty(exports, "MenuItemImageUrlSchema", { enumerable: true, get: function () { return menu_schema_1.MenuItemImageUrlSchema; } });
Object.defineProperty(exports, "ModifierGroupSchema", { enumerable: true, get: function () { return menu_schema_1.ModifierGroupSchema; } });
Object.defineProperty(exports, "CreateMenuItemSchema", { enumerable: true, get: function () { return menu_schema_1.CreateMenuItemSchema; } });
Object.defineProperty(exports, "UpdateMenuItemSchema", { enumerable: true, get: function () { return menu_schema_1.UpdateMenuItemSchema; } });
Object.defineProperty(exports, "ModifierGroupInputSchema", { enumerable: true, get: function () { return menu_schema_1.ModifierGroupInputSchema; } });
Object.defineProperty(exports, "MenuRecipeLineInputSchema", { enumerable: true, get: function () { return menu_schema_1.MenuRecipeLineInputSchema; } });
Object.defineProperty(exports, "UpsertMenuRecipeSchema", { enumerable: true, get: function () { return menu_schema_1.UpsertMenuRecipeSchema; } });
Object.defineProperty(exports, "MENU_ITEM_IMAGE_URL_MAX_LEN", { enumerable: true, get: function () { return menu_schema_1.MENU_ITEM_IMAGE_URL_MAX_LEN; } });
Object.defineProperty(exports, "isMenuItemImageUrl", { enumerable: true, get: function () { return menu_schema_1.isMenuItemImageUrl; } });
// ── Storefront pricing (client checkout ↔ API order mapping) ─────────────
var storefront_pricing_1 = require("./storefront-pricing");
Object.defineProperty(exports, "CLIENT_WEB_CHECKOUT_VAT_RATE", { enumerable: true, get: function () { return storefront_pricing_1.CLIENT_WEB_CHECKOUT_VAT_RATE; } });
Object.defineProperty(exports, "normalizeCheckoutVatRate", { enumerable: true, get: function () { return storefront_pricing_1.normalizeCheckoutVatRate; } });
Object.defineProperty(exports, "computeClientWebCheckoutTotals", { enumerable: true, get: function () { return storefront_pricing_1.computeClientWebCheckoutTotals; } });
Object.defineProperty(exports, "computeCheckoutBreakdown", { enumerable: true, get: function () { return storefront_pricing_1.computeCheckoutBreakdown; } });
// ── Delivery JSON (settings.deliveryJson) ─────────────────────────────────
var delivery_json_1 = require("./delivery-json");
Object.defineProperty(exports, "parseDeliveryJson", { enumerable: true, get: function () { return delivery_json_1.parseDeliveryJson; } });
Object.defineProperty(exports, "haversineDistanceKm", { enumerable: true, get: function () { return delivery_json_1.haversineDistanceKm; } });
Object.defineProperty(exports, "computeDeliveryFeeLkr", { enumerable: true, get: function () { return delivery_json_1.computeDeliveryFeeLkr; } });
// ── Inventory (Sprint S5, apps/admin only) ─────────────────────────────────
var inventory_schema_1 = require("./inventory.schema");
Object.defineProperty(exports, "IngredientSchema", { enumerable: true, get: function () { return inventory_schema_1.IngredientSchema; } });
Object.defineProperty(exports, "CreateIngredientInputSchema", { enumerable: true, get: function () { return inventory_schema_1.CreateIngredientInputSchema; } });
Object.defineProperty(exports, "UpdateIngredientInputSchema", { enumerable: true, get: function () { return inventory_schema_1.UpdateIngredientInputSchema; } });
Object.defineProperty(exports, "CreateRestockEntryInputSchema", { enumerable: true, get: function () { return inventory_schema_1.CreateRestockEntryInputSchema; } });
Object.defineProperty(exports, "CreateWasteEntryInputSchema", { enumerable: true, get: function () { return inventory_schema_1.CreateWasteEntryInputSchema; } });
Object.defineProperty(exports, "CreateStockAdjustmentInputSchema", { enumerable: true, get: function () { return inventory_schema_1.CreateStockAdjustmentInputSchema; } });
Object.defineProperty(exports, "CreateOverheadCostEntryInputSchema", { enumerable: true, get: function () { return inventory_schema_1.CreateOverheadCostEntryInputSchema; } });
Object.defineProperty(exports, "InventoryMovementSchema", { enumerable: true, get: function () { return inventory_schema_1.InventoryMovementSchema; } });
Object.defineProperty(exports, "IngredientValuationSnapshotSchema", { enumerable: true, get: function () { return inventory_schema_1.IngredientValuationSnapshotSchema; } });
Object.defineProperty(exports, "OrderCogsLineSchema", { enumerable: true, get: function () { return inventory_schema_1.OrderCogsLineSchema; } });
Object.defineProperty(exports, "DatedMarginReportSchema", { enumerable: true, get: function () { return inventory_schema_1.DatedMarginReportSchema; } });
Object.defineProperty(exports, "RecipeIngredientSchema", { enumerable: true, get: function () { return inventory_schema_1.RecipeIngredientSchema; } });
Object.defineProperty(exports, "RestockLogSchema", { enumerable: true, get: function () { return inventory_schema_1.RestockLogSchema; } });
Object.defineProperty(exports, "LowStockAlertSchema", { enumerable: true, get: function () { return inventory_schema_1.LowStockAlertSchema; } });
Object.defineProperty(exports, "IngredientUnitSchema", { enumerable: true, get: function () { return inventory_schema_1.IngredientUnitSchema; } });
Object.defineProperty(exports, "InventoryMovementTypeSchema", { enumerable: true, get: function () { return inventory_schema_1.InventoryMovementTypeSchema; } });
Object.defineProperty(exports, "InventoryReferenceTypeSchema", { enumerable: true, get: function () { return inventory_schema_1.InventoryReferenceTypeSchema; } });
Object.defineProperty(exports, "OverheadCostTypeSchema", { enumerable: true, get: function () { return inventory_schema_1.OverheadCostTypeSchema; } });
Object.defineProperty(exports, "OverheadAllocationScopeSchema", { enumerable: true, get: function () { return inventory_schema_1.OverheadAllocationScopeSchema; } });
// ── Customer ──────────────────────────────────────────────────────────────
var customer_schema_1 = require("./customer.schema");
Object.defineProperty(exports, "CustomerAddressSchema", { enumerable: true, get: function () { return customer_schema_1.CustomerAddressSchema; } });
Object.defineProperty(exports, "SavedPaymentTokenSchema", { enumerable: true, get: function () { return customer_schema_1.SavedPaymentTokenSchema; } });
Object.defineProperty(exports, "CustomerSchema", { enumerable: true, get: function () { return customer_schema_1.CustomerSchema; } });
Object.defineProperty(exports, "CustomerHistoryOrderSchema", { enumerable: true, get: function () { return customer_schema_1.CustomerHistoryOrderSchema; } });
// ── Settings ────────────────────────────────────────────────────────────────
var settings_contracts_1 = require("./settings.contracts");
Object.defineProperty(exports, "DEFAULT_PAYMENT_METHODS", { enumerable: true, get: function () { return settings_contracts_1.DEFAULT_PAYMENT_METHODS; } });
Object.defineProperty(exports, "DEFAULT_PAYMENT_CONFIG", { enumerable: true, get: function () { return settings_contracts_1.DEFAULT_PAYMENT_CONFIG; } });
Object.defineProperty(exports, "DEFAULT_OPERATIONS_CALENDAR", { enumerable: true, get: function () { return settings_contracts_1.DEFAULT_OPERATIONS_CALENDAR; } });
// ── Staff ───────────────────────────────────────────────────────────────────
var staff_contracts_1 = require("./staff.contracts");
Object.defineProperty(exports, "STAFF_ROLES", { enumerable: true, get: function () { return staff_contracts_1.STAFF_ROLES; } });
Object.defineProperty(exports, "SHOPPER_ROLE", { enumerable: true, get: function () { return staff_contracts_1.SHOPPER_ROLE; } });
// ── Payments ─────────────────────────────────────────────────────────────────
var payment_contracts_1 = require("./payment.contracts");
Object.defineProperty(exports, "PayHereWebhookSchema", { enumerable: true, get: function () { return payment_contracts_1.PayHereWebhookSchema; } });
// ── Analytics (Sprint S20) ───────────────────────────────────────────────────
var analytics_contracts_1 = require("./analytics.contracts");
// Constants
Object.defineProperty(exports, "ANALYTICS_GROUPINGS", { enumerable: true, get: function () { return analytics_contracts_1.ANALYTICS_GROUPINGS; } });
Object.defineProperty(exports, "PIPELINE_STATUSES", { enumerable: true, get: function () { return analytics_contracts_1.PIPELINE_STATUSES; } });
Object.defineProperty(exports, "ACTIVE_PIPELINE_STATUSES", { enumerable: true, get: function () { return analytics_contracts_1.ACTIVE_PIPELINE_STATUSES; } });
// Schemas
Object.defineProperty(exports, "DailySalesReportSchema", { enumerable: true, get: function () { return analytics_contracts_1.DailySalesReportSchema; } });
Object.defineProperty(exports, "SalesStatPointSchema", { enumerable: true, get: function () { return analytics_contracts_1.SalesStatPointSchema; } });
Object.defineProperty(exports, "SalesStatsResponseSchema", { enumerable: true, get: function () { return analytics_contracts_1.SalesStatsResponseSchema; } });
Object.defineProperty(exports, "ItemMarginSchema", { enumerable: true, get: function () { return analytics_contracts_1.ItemMarginSchema; } });
Object.defineProperty(exports, "ItemMarginsResponseSchema", { enumerable: true, get: function () { return analytics_contracts_1.ItemMarginsResponseSchema; } });
Object.defineProperty(exports, "PaymentReconciliationSchema", { enumerable: true, get: function () { return analytics_contracts_1.PaymentReconciliationSchema; } });
Object.defineProperty(exports, "PipelineStageSchema", { enumerable: true, get: function () { return analytics_contracts_1.PipelineStageSchema; } });
Object.defineProperty(exports, "PipelineTotalsSchema", { enumerable: true, get: function () { return analytics_contracts_1.PipelineTotalsSchema; } });
Object.defineProperty(exports, "OrderPipelineResponseSchema", { enumerable: true, get: function () { return analytics_contracts_1.OrderPipelineResponseSchema; } });
Object.defineProperty(exports, "TopSellerItemSchema", { enumerable: true, get: function () { return analytics_contracts_1.TopSellerItemSchema; } });
Object.defineProperty(exports, "TopSellersResponseSchema", { enumerable: true, get: function () { return analytics_contracts_1.TopSellersResponseSchema; } });
Object.defineProperty(exports, "DailyIngredientConsumptionRowSchema", { enumerable: true, get: function () { return analytics_contracts_1.DailyIngredientConsumptionRowSchema; } });
Object.defineProperty(exports, "IngredientConsumptionTotalSchema", { enumerable: true, get: function () { return analytics_contracts_1.IngredientConsumptionTotalSchema; } });
Object.defineProperty(exports, "DailyIngredientConsumptionReportSchema", { enumerable: true, get: function () { return analytics_contracts_1.DailyIngredientConsumptionReportSchema; } });
//# sourceMappingURL=index.js.map