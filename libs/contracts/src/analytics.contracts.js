"use strict";
// libs/contracts/src/analytics.contracts.ts
// ⛔ LSA-ONLY — Analytics API response contracts (Sprint S20).
// All analytics surfaces import ONLY from @wrap-roll/contracts — never directly.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverheadCostTypeSchema = exports.DailyIngredientConsumptionReportSchema = exports.IngredientConsumptionTotalSchema = exports.DailyIngredientConsumptionRowSchema = exports.TopSellersResponseSchema = exports.TopSellerItemSchema = exports.OrderPipelineResponseSchema = exports.PipelineTotalsSchema = exports.PipelineStageSchema = exports.PaymentReconciliationSchema = exports.ItemMarginsResponseSchema = exports.ItemMarginSchema = exports.SalesStatsResponseSchema = exports.SalesStatPointSchema = exports.DailySalesReportSchema = exports.ACTIVE_PIPELINE_STATUSES = exports.PIPELINE_STATUSES = exports.ANALYTICS_GROUPINGS = void 0;
const zod_1 = require("zod");
const inventory_schema_1 = require("./inventory.schema");
Object.defineProperty(exports, "OverheadCostTypeSchema", { enumerable: true, get: function () { return inventory_schema_1.OverheadCostTypeSchema; } });
// ── Enums / Constants ────────────────────────────────────────────────────────
exports.ANALYTICS_GROUPINGS = ['daily', 'weekly', 'monthly'];
exports.PIPELINE_STATUSES = [
    'placed',
    'paid',
    'in_kitchen',
    'ready',
    'in_transit',
    'delivered',
    'cancelled',
    'voided',
    'refunded',
];
/** Active (in-flight) pipeline statuses shown on the ops funnel. */
exports.ACTIVE_PIPELINE_STATUSES = [
    'placed',
    'paid',
    'in_kitchen',
    'ready',
    'in_transit',
];
// ── Response Schemas (Zod) ────────────────────────────────────────────────────
/** `GET /analytics/sales/daily` */
exports.DailySalesReportSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
    totalOrders: zod_1.z.number().int().nonnegative(),
    totalRevenue: zod_1.z.number().nonnegative(),
    avgTicketSize: zod_1.z.number().nonnegative(),
    sourceBreakdown: zod_1.z.object({
        web: zod_1.z.number().int().nonnegative(),
        pos: zod_1.z.number().int().nonnegative(),
        delivery: zod_1.z.number().int().nonnegative(),
    }),
});
/** Single data point from `GET /analytics/sales` */
exports.SalesStatPointSchema = zod_1.z.object({
    label: zod_1.z.string(),
    revenue: zod_1.z.number(),
    volume: zod_1.z.number().int().nonnegative(),
});
/** Array response from `GET /analytics/sales?startDate=&endDate=&grouping=` */
exports.SalesStatsResponseSchema = zod_1.z.array(exports.SalesStatPointSchema);
/** Single item from `GET /analytics/margins` */
exports.ItemMarginSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    category: zod_1.z.string(),
    basePrice: zod_1.z.number().nonnegative(),
    theoreticalCost: zod_1.z.number().nonnegative(),
    grossMargin: zod_1.z.number(),
    foodCostPercentage: zod_1.z.number(),
});
/** Array response from `GET /analytics/margins` */
exports.ItemMarginsResponseSchema = zod_1.z.array(exports.ItemMarginSchema);
/** `GET /analytics/margin/gross` — this schema already exists as DatedMarginReportSchema      *
 *  in inventory.schema.ts (Sprint S5). Re-export from there; do not duplicate here.           *
 *  Use: import { type DatedMarginReport } from '@wrap-roll/contracts';                         */
/** `GET /analytics/payments/reconciliation` */
exports.PaymentReconciliationSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cash_pending_count: zod_1.z.number().int().nonnegative(),
    cash_pending_amount: zod_1.z.number().nonnegative(),
    cash_collected_by_pos: zod_1.z.number().nonnegative(),
    cash_collected_by_rider: zod_1.z.number().nonnegative(),
    expected_cash_total: zod_1.z.number().nonnegative(),
    collected_cash_total: zod_1.z.number().nonnegative(),
    variance: zod_1.z.number(),
});
/** Single stage in `GET /analytics/pipeline` response */
exports.PipelineStageSchema = zod_1.z.object({
    status: zod_1.z.enum(exports.PIPELINE_STATUSES),
    count: zod_1.z.number().int().nonnegative(),
});
/** KPI totals embedded in `GET /analytics/pipeline` response */
exports.PipelineTotalsSchema = zod_1.z.object({
    totalToday: zod_1.z.number().int().nonnegative(),
    revenueToday: zod_1.z.number().nonnegative(),
    paidOrdersToday: zod_1.z.number().int().nonnegative(),
    avgTicket: zod_1.z.number().nonnegative(),
});
/** `GET /analytics/pipeline` */
exports.OrderPipelineResponseSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pipeline: zod_1.z.array(exports.PipelineStageSchema),
    totals: exports.PipelineTotalsSchema,
});
/** Single item from `GET /analytics/top-sellers` */
exports.TopSellerItemSchema = zod_1.z.object({
    rank: zod_1.z.number().int().positive(),
    menuItemId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    qtySold: zod_1.z.number().int().nonnegative(),
    revenue: zod_1.z.number().nonnegative(),
});
/** Array response from `GET /analytics/top-sellers` */
exports.TopSellersResponseSchema = zod_1.z.array(exports.TopSellerItemSchema);
/** One aggregated row per calendar day + ingredient (`GET /analytics/inventory/daily-consumption`) */
exports.DailyIngredientConsumptionRowSchema = zod_1.z.object({
    day: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ingredientId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    unit: zod_1.z.string(),
    qtyConsumed: zod_1.z.number().nonnegative(),
    lineCost: zod_1.z.number().nonnegative(),
});
/** Period total per ingredient (same endpoint — use for restock planning) */
exports.IngredientConsumptionTotalSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    unit: zod_1.z.string(),
    qtyConsumed: zod_1.z.number().nonnegative(),
    lineCost: zod_1.z.number().nonnegative(),
});
/** `GET /analytics/inventory/daily-consumption` */
exports.DailyIngredientConsumptionReportSchema = zod_1.z.object({
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    daily: zod_1.z.array(exports.DailyIngredientConsumptionRowSchema),
    totalsByIngredient: zod_1.z.array(exports.IngredientConsumptionTotalSchema),
});
//# sourceMappingURL=analytics.contracts.js.map