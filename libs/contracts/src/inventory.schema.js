"use strict";
// libs/contracts/src/inventory.schema.ts
// ⛔ LSA-ONLY — Ingredient-level inventory contracts (Sprint S5).
Object.defineProperty(exports, "__esModule", { value: true });
exports.LowStockAlertSchema = exports.RestockLogSchema = exports.RecipeIngredientSchema = exports.DatedMarginReportSchema = exports.OrderCogsLineSchema = exports.IngredientValuationSnapshotSchema = exports.InventoryMovementSchema = exports.CreateOverheadCostEntryInputSchema = exports.CreateStockAdjustmentInputSchema = exports.CreateWasteEntryInputSchema = exports.CreateRestockEntryInputSchema = exports.UpdateIngredientInputSchema = exports.CreateIngredientInputSchema = exports.IngredientSchema = exports.OverheadAllocationScopeSchema = exports.OverheadCostTypeSchema = exports.InventoryReferenceTypeSchema = exports.InventoryMovementTypeSchema = exports.IngredientUnitSchema = void 0;
const zod_1 = require("zod");
exports.IngredientUnitSchema = zod_1.z.enum(['g', 'ml', 'pcs']);
exports.InventoryMovementTypeSchema = zod_1.z.enum(['PURCHASE', 'CONSUME', 'WASTE', 'ADJUSTMENT', 'RETURN']);
exports.InventoryReferenceTypeSchema = zod_1.z.enum(['PURCHASE', 'ORDER', 'WASTE', 'ADJUSTMENT', 'RETURN', 'SYSTEM']);
exports.OverheadCostTypeSchema = zod_1.z.enum(['GAS', 'WATER', 'ELECTRICITY', 'LABOR', 'RENT', 'OTHER']);
exports.OverheadAllocationScopeSchema = zod_1.z.enum(['GLOBAL', 'KITCHEN', 'DELIVERY']);
exports.IngredientSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    unit: exports.IngredientUnitSchema,
    costPerUnit: zod_1.z.number().nonnegative(), // LKR
    currentStock: zod_1.z.number().nonnegative(), // in units
    lowStockThreshold: zod_1.z.number().nonnegative(), // alert fires at or below this
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.CreateIngredientInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unit: exports.IngredientUnitSchema,
    costPerUnit: zod_1.z.number().nonnegative(),
    currentStock: zod_1.z.number().nonnegative(),
    lowStockThreshold: zod_1.z.number().nonnegative(),
});
exports.UpdateIngredientInputSchema = exports.CreateIngredientInputSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
exports.CreateRestockEntryInputSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().positive(),
    unitCost: zod_1.z.number().nonnegative(),
    occurredAt: zod_1.z.string().datetime().optional(),
    note: zod_1.z.string().max(500).optional(),
});
exports.CreateWasteEntryInputSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().positive(),
    occurredAt: zod_1.z.string().datetime().optional(),
    note: zod_1.z.string().max(500).optional(),
});
exports.CreateStockAdjustmentInputSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    quantityDelta: zod_1.z.number().refine((value) => value !== 0, 'quantityDelta must not be zero'),
    occurredAt: zod_1.z.string().datetime().optional(),
    note: zod_1.z.string().max(500).optional(),
});
exports.CreateOverheadCostEntryInputSchema = zod_1.z.object({
    costType: exports.OverheadCostTypeSchema,
    amount: zod_1.z.number().positive(),
    periodStart: zod_1.z.string().datetime(),
    periodEnd: zod_1.z.string().datetime(),
    allocationScope: exports.OverheadAllocationScopeSchema.default('GLOBAL'),
    note: zod_1.z.string().max(500).optional(),
});
exports.InventoryMovementSchema = zod_1.z.object({
    movementId: zod_1.z.string().uuid(),
    ingredientId: zod_1.z.string().uuid(),
    movementType: exports.InventoryMovementTypeSchema,
    quantityDelta: zod_1.z.number(),
    unitCost: zod_1.z.number().nullable(),
    totalValueDelta: zod_1.z.number().nullable(),
    resultingQty: zod_1.z.number().nonnegative(),
    resultingAvgCost: zod_1.z.number().nonnegative(),
    referenceType: exports.InventoryReferenceTypeSchema,
    referenceId: zod_1.z.string().nullable(),
    note: zod_1.z.string().nullable(),
    occurredAt: zod_1.z.string().datetime(),
});
exports.IngredientValuationSnapshotSchema = zod_1.z.object({
    snapshotId: zod_1.z.string().uuid(),
    ingredientId: zod_1.z.string().uuid(),
    avgUnitCost: zod_1.z.number().nonnegative(),
    onHandQty: zod_1.z.number().nonnegative(),
    inventoryValue: zod_1.z.number().nonnegative(),
    asOf: zod_1.z.string().datetime(),
});
exports.OrderCogsLineSchema = zod_1.z.object({
    cogsLineId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(),
    menuItemId: zod_1.z.string().uuid(),
    ingredientId: zod_1.z.string().uuid(),
    qtyConsumed: zod_1.z.number().nonnegative(),
    unitCostAtSale: zod_1.z.number().nonnegative(),
    lineCost: zod_1.z.number().nonnegative(),
    occurredAt: zod_1.z.string().datetime(),
});
exports.DatedMarginReportSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    totalRevenue: zod_1.z.number(),
    totalCOGS: zod_1.z.number(),
    totalOverhead: zod_1.z.number(),
    grossMargin: zod_1.z.number(),
    contributionMargin: zod_1.z.number(),
    grossMarginPercentage: zod_1.z.number(),
    contributionMarginPercentage: zod_1.z.number(),
    overheadByType: zod_1.z.array(zod_1.z.object({
        costType: exports.OverheadCostTypeSchema,
        amount: zod_1.z.number(),
    })),
    wasteImpact: zod_1.z.object({
        quantity: zod_1.z.number(),
        estimatedValue: zod_1.z.number(),
    }),
});
// Maps a MenuItem to its ingredient quantities consumed per 1 item sold
exports.RecipeIngredientSchema = zod_1.z.object({
    recipeId: zod_1.z.string().uuid(),
    menuItemId: zod_1.z.string().uuid(),
    ingredientId: zod_1.z.string().uuid(),
    quantityUsed: zod_1.z.number().positive(), // units consumed per 1 wrap sold
});
exports.RestockLogSchema = zod_1.z.object({
    logId: zod_1.z.string().uuid(),
    ingredientId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().positive(), // units added
    note: zod_1.z.string().optional(),
    restockedAt: zod_1.z.string().datetime(),
});
// Event shape emitted via Supabase Realtime when stock ≤ lowStockThreshold
exports.LowStockAlertSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    currentStock: zod_1.z.number(),
    threshold: zod_1.z.number(),
    unit: exports.IngredientUnitSchema,
    triggeredAt: zod_1.z.string().datetime(),
});
//# sourceMappingURL=inventory.schema.js.map