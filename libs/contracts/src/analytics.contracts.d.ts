import { z } from 'zod';
import { OverheadCostTypeSchema } from './inventory.schema';
export declare const ANALYTICS_GROUPINGS: readonly ["daily", "weekly", "monthly"];
export type AnalyticsGrouping = (typeof ANALYTICS_GROUPINGS)[number];
export declare const PIPELINE_STATUSES: readonly ["placed", "paid", "in_kitchen", "ready", "in_transit", "delivered", "cancelled", "voided", "refunded"];
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
/** Active (in-flight) pipeline statuses shown on the ops funnel. */
export declare const ACTIVE_PIPELINE_STATUSES: readonly ["placed", "paid", "in_kitchen", "ready", "in_transit"];
/** `GET /analytics/sales/daily` */
export declare const DailySalesReportSchema: z.ZodObject<{
    date: z.ZodString;
    totalOrders: z.ZodNumber;
    totalRevenue: z.ZodNumber;
    avgTicketSize: z.ZodNumber;
    sourceBreakdown: z.ZodObject<{
        web: z.ZodNumber;
        pos: z.ZodNumber;
        delivery: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type DailySalesReport = z.infer<typeof DailySalesReportSchema>;
/** Single data point from `GET /analytics/sales` */
export declare const SalesStatPointSchema: z.ZodObject<{
    label: z.ZodString;
    revenue: z.ZodNumber;
    volume: z.ZodNumber;
}, z.core.$strip>;
export type SalesStatPoint = z.infer<typeof SalesStatPointSchema>;
/** Array response from `GET /analytics/sales?startDate=&endDate=&grouping=` */
export declare const SalesStatsResponseSchema: z.ZodArray<z.ZodObject<{
    label: z.ZodString;
    revenue: z.ZodNumber;
    volume: z.ZodNumber;
}, z.core.$strip>>;
export type SalesStatsResponse = z.infer<typeof SalesStatsResponseSchema>;
/** Single item from `GET /analytics/margins` */
export declare const ItemMarginSchema: z.ZodObject<{
    itemId: z.ZodString;
    name: z.ZodString;
    category: z.ZodString;
    basePrice: z.ZodNumber;
    theoreticalCost: z.ZodNumber;
    grossMargin: z.ZodNumber;
    foodCostPercentage: z.ZodNumber;
}, z.core.$strip>;
export type ItemMargin = z.infer<typeof ItemMarginSchema>;
/** Array response from `GET /analytics/margins` */
export declare const ItemMarginsResponseSchema: z.ZodArray<z.ZodObject<{
    itemId: z.ZodString;
    name: z.ZodString;
    category: z.ZodString;
    basePrice: z.ZodNumber;
    theoreticalCost: z.ZodNumber;
    grossMargin: z.ZodNumber;
    foodCostPercentage: z.ZodNumber;
}, z.core.$strip>>;
export type ItemMarginsResponse = z.infer<typeof ItemMarginsResponseSchema>;
/** `GET /analytics/margin/gross` — this schema already exists as DatedMarginReportSchema      *
 *  in inventory.schema.ts (Sprint S5). Re-export from there; do not duplicate here.           *
 *  Use: import { type DatedMarginReport } from '@wrap-roll/contracts';                         */
/** `GET /analytics/payments/reconciliation` */
export declare const PaymentReconciliationSchema: z.ZodObject<{
    date: z.ZodString;
    cash_pending_count: z.ZodNumber;
    cash_pending_amount: z.ZodNumber;
    cash_collected_by_pos: z.ZodNumber;
    cash_collected_by_rider: z.ZodNumber;
    expected_cash_total: z.ZodNumber;
    collected_cash_total: z.ZodNumber;
    variance: z.ZodNumber;
}, z.core.$strip>;
export type PaymentReconciliation = z.infer<typeof PaymentReconciliationSchema>;
/** Single stage in `GET /analytics/pipeline` response */
export declare const PipelineStageSchema: z.ZodObject<{
    status: z.ZodEnum<{
        placed: "placed";
        paid: "paid";
        in_kitchen: "in_kitchen";
        ready: "ready";
        in_transit: "in_transit";
        delivered: "delivered";
        cancelled: "cancelled";
        voided: "voided";
        refunded: "refunded";
    }>;
    count: z.ZodNumber;
}, z.core.$strip>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;
/** KPI totals embedded in `GET /analytics/pipeline` response */
export declare const PipelineTotalsSchema: z.ZodObject<{
    totalToday: z.ZodNumber;
    revenueToday: z.ZodNumber;
    paidOrdersToday: z.ZodNumber;
    avgTicket: z.ZodNumber;
}, z.core.$strip>;
export type PipelineTotals = z.infer<typeof PipelineTotalsSchema>;
/** `GET /analytics/pipeline` */
export declare const OrderPipelineResponseSchema: z.ZodObject<{
    date: z.ZodString;
    pipeline: z.ZodArray<z.ZodObject<{
        status: z.ZodEnum<{
            placed: "placed";
            paid: "paid";
            in_kitchen: "in_kitchen";
            ready: "ready";
            in_transit: "in_transit";
            delivered: "delivered";
            cancelled: "cancelled";
            voided: "voided";
            refunded: "refunded";
        }>;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    totals: z.ZodObject<{
        totalToday: z.ZodNumber;
        revenueToday: z.ZodNumber;
        paidOrdersToday: z.ZodNumber;
        avgTicket: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type OrderPipelineResponse = z.infer<typeof OrderPipelineResponseSchema>;
/** Single item from `GET /analytics/top-sellers` */
export declare const TopSellerItemSchema: z.ZodObject<{
    rank: z.ZodNumber;
    menuItemId: z.ZodString;
    name: z.ZodString;
    qtySold: z.ZodNumber;
    revenue: z.ZodNumber;
}, z.core.$strip>;
export type TopSellerItem = z.infer<typeof TopSellerItemSchema>;
/** Array response from `GET /analytics/top-sellers` */
export declare const TopSellersResponseSchema: z.ZodArray<z.ZodObject<{
    rank: z.ZodNumber;
    menuItemId: z.ZodString;
    name: z.ZodString;
    qtySold: z.ZodNumber;
    revenue: z.ZodNumber;
}, z.core.$strip>>;
export type TopSellersResponse = z.infer<typeof TopSellersResponseSchema>;
/** One aggregated row per calendar day + ingredient (`GET /analytics/inventory/daily-consumption`) */
export declare const DailyIngredientConsumptionRowSchema: z.ZodObject<{
    day: z.ZodString;
    ingredientId: z.ZodString;
    name: z.ZodString;
    unit: z.ZodString;
    qtyConsumed: z.ZodNumber;
    lineCost: z.ZodNumber;
}, z.core.$strip>;
export type DailyIngredientConsumptionRow = z.infer<typeof DailyIngredientConsumptionRowSchema>;
/** Period total per ingredient (same endpoint — use for restock planning) */
export declare const IngredientConsumptionTotalSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    name: z.ZodString;
    unit: z.ZodString;
    qtyConsumed: z.ZodNumber;
    lineCost: z.ZodNumber;
}, z.core.$strip>;
export type IngredientConsumptionTotal = z.infer<typeof IngredientConsumptionTotalSchema>;
/** `GET /analytics/inventory/daily-consumption` */
export declare const DailyIngredientConsumptionReportSchema: z.ZodObject<{
    startDate: z.ZodString;
    endDate: z.ZodString;
    daily: z.ZodArray<z.ZodObject<{
        day: z.ZodString;
        ingredientId: z.ZodString;
        name: z.ZodString;
        unit: z.ZodString;
        qtyConsumed: z.ZodNumber;
        lineCost: z.ZodNumber;
    }, z.core.$strip>>;
    totalsByIngredient: z.ZodArray<z.ZodObject<{
        ingredientId: z.ZodString;
        name: z.ZodString;
        unit: z.ZodString;
        qtyConsumed: z.ZodNumber;
        lineCost: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DailyIngredientConsumptionReport = z.infer<typeof DailyIngredientConsumptionReportSchema>;
/** Shape for `GET /analytics/sales` query params. */
export type SalesStatsQuery = {
    startDate: string;
    endDate: string;
    grouping?: AnalyticsGrouping;
};
/** Shape for `GET /analytics/margin/gross` query params. */
export type GrossMarginQuery = {
    startDate?: string;
    endDate?: string;
};
/** Shape for `GET /analytics/top-sellers` query params. */
export type TopSellersQuery = {
    date?: string;
    limit?: number;
};
/** Shape for `GET /analytics/inventory/daily-consumption` query params. */
export type DailyConsumptionQuery = {
    startDate?: string;
    endDate?: string;
};
export { OverheadCostTypeSchema };
//# sourceMappingURL=analytics.contracts.d.ts.map