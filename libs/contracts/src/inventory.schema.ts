// libs/contracts/src/inventory.schema.ts
// ⛔ LSA-ONLY — Ingredient-level inventory contracts (Sprint S5).

import { z } from 'zod';

export const IngredientUnitSchema = z.enum(['g', 'ml', 'pcs']);
export type IngredientUnit = z.infer<typeof IngredientUnitSchema>;
export const InventoryMovementTypeSchema = z.enum(['PURCHASE', 'CONSUME', 'WASTE', 'ADJUSTMENT', 'RETURN']);
export const InventoryReferenceTypeSchema = z.enum(['PURCHASE', 'ORDER', 'WASTE', 'ADJUSTMENT', 'RETURN', 'SYSTEM']);
export const OverheadCostTypeSchema = z.enum(['GAS', 'WATER', 'ELECTRICITY', 'LABOR', 'RENT', 'OTHER']);
export const OverheadAllocationScopeSchema = z.enum(['GLOBAL', 'KITCHEN', 'DELIVERY']);

export const IngredientSchema = z.object({
  ingredientId:      z.string().uuid(),
  name:              z.string(),
  unit:              IngredientUnitSchema,
  costPerUnit:       z.number().nonnegative(),   // LKR
  currentStock:      z.number().nonnegative(),   // in units
  lowStockThreshold: z.number().nonnegative(),   // alert fires at or below this
  createdAt:         z.string().datetime(),
  updatedAt:         z.string().datetime(),
});

export const CreateIngredientInputSchema = z.object({
  name: z.string().min(1),
  unit: IngredientUnitSchema,
  costPerUnit: z.number().nonnegative(),
  currentStock: z.number().nonnegative(),
  lowStockThreshold: z.number().nonnegative(),
});

export const UpdateIngredientInputSchema = CreateIngredientInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field must be provided',
);

export const CreateRestockEntryInputSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  occurredAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export const CreateWasteEntryInputSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  occurredAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export const CreateStockAdjustmentInputSchema = z.object({
  ingredientId: z.string().uuid(),
  quantityDelta: z.number().refine((value) => value !== 0, 'quantityDelta must not be zero'),
  occurredAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export const CreateOverheadCostEntryInputSchema = z.object({
  costType: OverheadCostTypeSchema,
  amount: z.number().positive(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  allocationScope: OverheadAllocationScopeSchema.default('GLOBAL'),
  note: z.string().max(500).optional(),
});

export const InventoryMovementSchema = z.object({
  movementId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  movementType: InventoryMovementTypeSchema,
  quantityDelta: z.number(),
  unitCost: z.number().nullable(),
  totalValueDelta: z.number().nullable(),
  resultingQty: z.number().nonnegative(),
  resultingAvgCost: z.number().nonnegative(),
  referenceType: InventoryReferenceTypeSchema,
  referenceId: z.string().nullable(),
  note: z.string().nullable(),
  occurredAt: z.string().datetime(),
});

export const IngredientValuationSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  avgUnitCost: z.number().nonnegative(),
  onHandQty: z.number().nonnegative(),
  inventoryValue: z.number().nonnegative(),
  asOf: z.string().datetime(),
});

export const OrderCogsLineSchema = z.object({
  cogsLineId: z.string().uuid(),
  orderId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  qtyConsumed: z.number().nonnegative(),
  unitCostAtSale: z.number().nonnegative(),
  lineCost: z.number().nonnegative(),
  occurredAt: z.string().datetime(),
});

export const DatedMarginReportSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  totalRevenue: z.number(),
  totalCOGS: z.number(),
  totalOverhead: z.number(),
  grossMargin: z.number(),
  contributionMargin: z.number(),
  grossMarginPercentage: z.number(),
  contributionMarginPercentage: z.number(),
  overheadByType: z.array(
    z.object({
      costType: OverheadCostTypeSchema,
      amount: z.number(),
    }),
  ),
  wasteImpact: z.object({
    quantity: z.number(),
    estimatedValue: z.number(),
  }),
});

// Maps a MenuItem to its ingredient quantities consumed per 1 item sold
export const RecipeIngredientSchema = z.object({
  recipeId:      z.string().uuid(),
  menuItemId:    z.string().uuid(),
  ingredientId:  z.string().uuid(),
  quantityUsed:  z.number().positive(),          // units consumed per 1 wrap sold
});

export const RestockLogSchema = z.object({
  logId:         z.string().uuid(),
  ingredientId:  z.string().uuid(),
  quantity:      z.number().positive(),          // units added
  note:          z.string().optional(),
  restockedAt:   z.string().datetime(),
});

// Event shape emitted via Supabase Realtime when stock ≤ lowStockThreshold
export const LowStockAlertSchema = z.object({
  ingredientId:   z.string().uuid(),
  name:           z.string(),
  currentStock:   z.number(),
  threshold:      z.number(),
  unit:           IngredientUnitSchema,
  triggeredAt:    z.string().datetime(),
});

export type Ingredient      = z.infer<typeof IngredientSchema>;
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type RestockLog      = z.infer<typeof RestockLogSchema>;
export type LowStockAlert   = z.infer<typeof LowStockAlertSchema>;
export type CreateIngredientInput = z.infer<typeof CreateIngredientInputSchema>;
export type UpdateIngredientInput = z.infer<typeof UpdateIngredientInputSchema>;
export type InventoryMovementType = z.infer<typeof InventoryMovementTypeSchema>;
export type InventoryReferenceType = z.infer<typeof InventoryReferenceTypeSchema>;
export type OverheadCostType = z.infer<typeof OverheadCostTypeSchema>;
export type OverheadAllocationScope = z.infer<typeof OverheadAllocationScopeSchema>;
export type CreateRestockEntryInput = z.infer<typeof CreateRestockEntryInputSchema>;
export type CreateWasteEntryInput = z.infer<typeof CreateWasteEntryInputSchema>;
export type CreateStockAdjustmentInput = z.infer<typeof CreateStockAdjustmentInputSchema>;
export type CreateOverheadCostEntryInput = z.infer<typeof CreateOverheadCostEntryInputSchema>;
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;
export type IngredientValuationSnapshot = z.infer<typeof IngredientValuationSnapshotSchema>;
export type OrderCogsLine = z.infer<typeof OrderCogsLineSchema>;
export type DatedMarginReport = z.infer<typeof DatedMarginReportSchema>;
