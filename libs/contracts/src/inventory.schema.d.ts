import { z } from 'zod';
export declare const IngredientUnitSchema: z.ZodEnum<{
    g: "g";
    ml: "ml";
    pcs: "pcs";
}>;
export type IngredientUnit = z.infer<typeof IngredientUnitSchema>;
export declare const InventoryMovementTypeSchema: z.ZodEnum<{
    PURCHASE: "PURCHASE";
    CONSUME: "CONSUME";
    WASTE: "WASTE";
    ADJUSTMENT: "ADJUSTMENT";
    RETURN: "RETURN";
}>;
export declare const InventoryReferenceTypeSchema: z.ZodEnum<{
    SYSTEM: "SYSTEM";
    PURCHASE: "PURCHASE";
    WASTE: "WASTE";
    ADJUSTMENT: "ADJUSTMENT";
    RETURN: "RETURN";
    ORDER: "ORDER";
}>;
export declare const OverheadCostTypeSchema: z.ZodEnum<{
    GAS: "GAS";
    WATER: "WATER";
    ELECTRICITY: "ELECTRICITY";
    LABOR: "LABOR";
    RENT: "RENT";
    OTHER: "OTHER";
}>;
export declare const OverheadAllocationScopeSchema: z.ZodEnum<{
    KITCHEN: "KITCHEN";
    GLOBAL: "GLOBAL";
    DELIVERY: "DELIVERY";
}>;
export declare const IngredientSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    name: z.ZodString;
    unit: z.ZodEnum<{
        g: "g";
        ml: "ml";
        pcs: "pcs";
    }>;
    costPerUnit: z.ZodNumber;
    currentStock: z.ZodNumber;
    lowStockThreshold: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const CreateIngredientInputSchema: z.ZodObject<{
    name: z.ZodString;
    unit: z.ZodEnum<{
        g: "g";
        ml: "ml";
        pcs: "pcs";
    }>;
    costPerUnit: z.ZodNumber;
    currentStock: z.ZodNumber;
    lowStockThreshold: z.ZodNumber;
}, z.core.$strip>;
export declare const UpdateIngredientInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    unit: z.ZodOptional<z.ZodEnum<{
        g: "g";
        ml: "ml";
        pcs: "pcs";
    }>>;
    costPerUnit: z.ZodOptional<z.ZodNumber>;
    currentStock: z.ZodOptional<z.ZodNumber>;
    lowStockThreshold: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const CreateRestockEntryInputSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    quantity: z.ZodNumber;
    unitCost: z.ZodNumber;
    occurredAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const CreateWasteEntryInputSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    quantity: z.ZodNumber;
    occurredAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const CreateStockAdjustmentInputSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    quantityDelta: z.ZodNumber;
    occurredAt: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const CreateOverheadCostEntryInputSchema: z.ZodObject<{
    costType: z.ZodEnum<{
        GAS: "GAS";
        WATER: "WATER";
        ELECTRICITY: "ELECTRICITY";
        LABOR: "LABOR";
        RENT: "RENT";
        OTHER: "OTHER";
    }>;
    amount: z.ZodNumber;
    periodStart: z.ZodString;
    periodEnd: z.ZodString;
    allocationScope: z.ZodDefault<z.ZodEnum<{
        KITCHEN: "KITCHEN";
        GLOBAL: "GLOBAL";
        DELIVERY: "DELIVERY";
    }>>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const InventoryMovementSchema: z.ZodObject<{
    movementId: z.ZodString;
    ingredientId: z.ZodString;
    movementType: z.ZodEnum<{
        PURCHASE: "PURCHASE";
        CONSUME: "CONSUME";
        WASTE: "WASTE";
        ADJUSTMENT: "ADJUSTMENT";
        RETURN: "RETURN";
    }>;
    quantityDelta: z.ZodNumber;
    unitCost: z.ZodNullable<z.ZodNumber>;
    totalValueDelta: z.ZodNullable<z.ZodNumber>;
    resultingQty: z.ZodNumber;
    resultingAvgCost: z.ZodNumber;
    referenceType: z.ZodEnum<{
        SYSTEM: "SYSTEM";
        PURCHASE: "PURCHASE";
        WASTE: "WASTE";
        ADJUSTMENT: "ADJUSTMENT";
        RETURN: "RETURN";
        ORDER: "ORDER";
    }>;
    referenceId: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
}, z.core.$strip>;
export declare const IngredientValuationSnapshotSchema: z.ZodObject<{
    snapshotId: z.ZodString;
    ingredientId: z.ZodString;
    avgUnitCost: z.ZodNumber;
    onHandQty: z.ZodNumber;
    inventoryValue: z.ZodNumber;
    asOf: z.ZodString;
}, z.core.$strip>;
export declare const OrderCogsLineSchema: z.ZodObject<{
    cogsLineId: z.ZodString;
    orderId: z.ZodString;
    menuItemId: z.ZodString;
    ingredientId: z.ZodString;
    qtyConsumed: z.ZodNumber;
    unitCostAtSale: z.ZodNumber;
    lineCost: z.ZodNumber;
    occurredAt: z.ZodString;
}, z.core.$strip>;
export declare const DatedMarginReportSchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    totalRevenue: z.ZodNumber;
    totalCOGS: z.ZodNumber;
    totalOverhead: z.ZodNumber;
    grossMargin: z.ZodNumber;
    contributionMargin: z.ZodNumber;
    grossMarginPercentage: z.ZodNumber;
    contributionMarginPercentage: z.ZodNumber;
    overheadByType: z.ZodArray<z.ZodObject<{
        costType: z.ZodEnum<{
            GAS: "GAS";
            WATER: "WATER";
            ELECTRICITY: "ELECTRICITY";
            LABOR: "LABOR";
            RENT: "RENT";
            OTHER: "OTHER";
        }>;
        amount: z.ZodNumber;
    }, z.core.$strip>>;
    wasteImpact: z.ZodObject<{
        quantity: z.ZodNumber;
        estimatedValue: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const RecipeIngredientSchema: z.ZodObject<{
    recipeId: z.ZodString;
    menuItemId: z.ZodString;
    ingredientId: z.ZodString;
    quantityUsed: z.ZodNumber;
}, z.core.$strip>;
export declare const RestockLogSchema: z.ZodObject<{
    logId: z.ZodString;
    ingredientId: z.ZodString;
    quantity: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
    restockedAt: z.ZodString;
}, z.core.$strip>;
export declare const LowStockAlertSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    name: z.ZodString;
    currentStock: z.ZodNumber;
    threshold: z.ZodNumber;
    unit: z.ZodEnum<{
        g: "g";
        ml: "ml";
        pcs: "pcs";
    }>;
    triggeredAt: z.ZodString;
}, z.core.$strip>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type RestockLog = z.infer<typeof RestockLogSchema>;
export type LowStockAlert = z.infer<typeof LowStockAlertSchema>;
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
//# sourceMappingURL=inventory.schema.d.ts.map