// libs/contracts/src/analytics.contracts.ts
// ⛔ LSA-ONLY — Analytics API response contracts (Sprint S20).
// All analytics surfaces import ONLY from @wrap-roll/contracts — never directly.

import { z } from 'zod';
import { OverheadCostTypeSchema } from './inventory.schema';

// ── Enums / Constants ────────────────────────────────────────────────────────

export const ANALYTICS_GROUPINGS = ['daily', 'weekly', 'monthly'] as const;
export type AnalyticsGrouping = (typeof ANALYTICS_GROUPINGS)[number];

export const PIPELINE_STATUSES = [
  'placed',
  'paid',
  'in_kitchen',
  'ready',
  'in_transit',
  'delivered',
  'cancelled',
  'voided',
  'refunded',
] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

/** Active (in-flight) pipeline statuses shown on the ops funnel. */
export const ACTIVE_PIPELINE_STATUSES = [
  'placed',
  'paid',
  'in_kitchen',
  'ready',
  'in_transit',
] as const satisfies readonly PipelineStatus[];

// ── Response Schemas (Zod) ────────────────────────────────────────────────────

/** `GET /analytics/sales/daily` */
export const DailySalesReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  totalOrders: z.number().int().nonnegative(),
  totalRevenue: z.number().nonnegative(),
  avgTicketSize: z.number().nonnegative(),
  sourceBreakdown: z.object({
    web: z.number().int().nonnegative(),
    pos: z.number().int().nonnegative(),
    delivery: z.number().int().nonnegative(),
  }),
});
export type DailySalesReport = z.infer<typeof DailySalesReportSchema>;

/** Single data point from `GET /analytics/sales` */
export const SalesStatPointSchema = z.object({
  label: z.string(),
  revenue: z.number(),
  volume: z.number().int().nonnegative(),
});
export type SalesStatPoint = z.infer<typeof SalesStatPointSchema>;

/** Array response from `GET /analytics/sales?startDate=&endDate=&grouping=` */
export const SalesStatsResponseSchema = z.array(SalesStatPointSchema);
export type SalesStatsResponse = z.infer<typeof SalesStatsResponseSchema>;

/** Single item from `GET /analytics/margins` */
export const ItemMarginSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  basePrice: z.number().nonnegative(),
  theoreticalCost: z.number().nonnegative(),
  grossMargin: z.number(),
  foodCostPercentage: z.number(),
});
export type ItemMargin = z.infer<typeof ItemMarginSchema>;

/** Array response from `GET /analytics/margins` */
export const ItemMarginsResponseSchema = z.array(ItemMarginSchema);
export type ItemMarginsResponse = z.infer<typeof ItemMarginsResponseSchema>;

/** `GET /analytics/margin/gross` — this schema already exists as DatedMarginReportSchema      *
 *  in inventory.schema.ts (Sprint S5). Re-export from there; do not duplicate here.           *
 *  Use: import { type DatedMarginReport } from '@wrap-roll/contracts';                         */

/** Card payments recorded in POS (standalone terminal — matches `PaymentEvent` card_collected). */
export const CardCollectionReconciliationEventSchema = z.object({
  order_id: z.string(),
  amount_lkr: z.number().nonnegative(),
  actor_role: z.string().nullable().optional(),
  actor_user_id: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  recorded_at: z.string(),
});
export type CardCollectionReconciliationEvent = z.infer<
  typeof CardCollectionReconciliationEventSchema
>;

export const CardCollectionReconciliationSchema = z.object({
  count: z.number().int().nonnegative(),
  total_lkr: z.number().nonnegative(),
  events: z.array(CardCollectionReconciliationEventSchema),
});
export type CardCollectionReconciliation = z.infer<typeof CardCollectionReconciliationSchema>;

/** `GET /analytics/payments/reconciliation` */
export const PaymentReconciliationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cash_pending_count: z.number().int().nonnegative(),
  cash_pending_amount: z.number().nonnegative(),
  cash_collected_by_pos: z.number().nonnegative(),
  cash_collected_by_rider: z.number().nonnegative(),
  expected_cash_total: z.number().nonnegative(),
  collected_cash_total: z.number().nonnegative(),
  variance: z.number(),
  card_collection: CardCollectionReconciliationSchema,
});
export type PaymentReconciliation = z.infer<typeof PaymentReconciliationSchema>;

/** Single stage in `GET /analytics/pipeline` response */
export const PipelineStageSchema = z.object({
  status: z.enum(PIPELINE_STATUSES),
  count: z.number().int().nonnegative(),
});
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

/** KPI totals embedded in `GET /analytics/pipeline` response */
export const PipelineTotalsSchema = z.object({
  totalToday: z.number().int().nonnegative(),
  revenueToday: z.number().nonnegative(),
  paidOrdersToday: z.number().int().nonnegative(),
  avgTicket: z.number().nonnegative(),
});
export type PipelineTotals = z.infer<typeof PipelineTotalsSchema>;

/** `GET /analytics/pipeline` */
export const OrderPipelineResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pipeline: z.array(PipelineStageSchema),
  totals: PipelineTotalsSchema,
});
export type OrderPipelineResponse = z.infer<typeof OrderPipelineResponseSchema>;

/** Single item from `GET /analytics/top-sellers` */
export const TopSellerItemSchema = z.object({
  rank: z.number().int().positive(),
  menuItemId: z.string().uuid(),
  name: z.string(),
  qtySold: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
});
export type TopSellerItem = z.infer<typeof TopSellerItemSchema>;

/** Array response from `GET /analytics/top-sellers` */
export const TopSellersResponseSchema = z.array(TopSellerItemSchema);
export type TopSellersResponse = z.infer<typeof TopSellersResponseSchema>;

/** One aggregated row per calendar day + ingredient (`GET /analytics/inventory/daily-consumption`) */
export const DailyIngredientConsumptionRowSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ingredientId: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  qtyConsumed: z.number().nonnegative(),
  lineCost: z.number().nonnegative(),
});
export type DailyIngredientConsumptionRow = z.infer<typeof DailyIngredientConsumptionRowSchema>;

/** Period total per ingredient (same endpoint — use for restock planning) */
export const IngredientConsumptionTotalSchema = z.object({
  ingredientId: z.string().uuid(),
  name: z.string(),
  unit: z.string(),
  qtyConsumed: z.number().nonnegative(),
  lineCost: z.number().nonnegative(),
});
export type IngredientConsumptionTotal = z.infer<typeof IngredientConsumptionTotalSchema>;

/** `GET /analytics/inventory/daily-consumption` */
export const DailyIngredientConsumptionReportSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  daily: z.array(DailyIngredientConsumptionRowSchema),
  totalsByIngredient: z.array(IngredientConsumptionTotalSchema),
});
export type DailyIngredientConsumptionReport = z.infer<typeof DailyIngredientConsumptionReportSchema>;

// ── Query parameter type helpers (used by both NestJS and frontend) ──────────

/** Shape for `GET /analytics/sales` query params. */
export type SalesStatsQuery = {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  grouping?: AnalyticsGrouping;
};

/** Shape for `GET /analytics/margin/gross` query params. */
export type GrossMarginQuery = {
  startDate?: string;
  endDate?: string;
};

/** Shape for `GET /analytics/top-sellers` query params. */
export type TopSellersQuery = {
  date?: string; // YYYY-MM-DD, defaults to today
  limit?: number;
};

/** Shape for `GET /analytics/inventory/daily-consumption` query params. */
export type DailyConsumptionQuery = {
  startDate?: string;
  endDate?: string;
};

// ── Overhead cost type re-export (convenience, avoids cross-schema imports) ──
export { OverheadCostTypeSchema };
