import { z } from 'zod';
/** Max stored length (~1.5MB base64) — keeps menu rows and JSON payloads bounded */
export declare const MENU_ITEM_IMAGE_URL_MAX_LEN = 2000000;
export declare function isMenuItemImageUrl(val: string): boolean;
export declare const MenuItemImageUrlSchema: z.ZodString;
export declare const ModifierGroupSchema: z.ZodObject<{
    groupId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
        single: "single";
        multi: "multi";
    }>;
    options: z.ZodArray<z.ZodObject<{
        optionId: z.ZodString;
        label: z.ZodString;
        priceAdjust: z.ZodDefault<z.ZodNumber>;
        isDefault: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    required: z.ZodDefault<z.ZodBoolean>;
    minSelect: z.ZodDefault<z.ZodNumber>;
    maxSelect: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const MenuItemSchema: z.ZodObject<{
    itemId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    basePrice: z.ZodNumber;
    prepTimeMinutes: z.ZodNumber;
    imageUrl: z.ZodOptional<z.ZodString>;
    categoryId: z.ZodString;
    categoryName: z.ZodString;
    availability: z.ZodDefault<z.ZodEnum<{
        available: "available";
        sold_out: "sold_out";
        limited: "limited";
    }>>;
    modifierGroups: z.ZodArray<z.ZodObject<{
        groupId: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            single: "single";
            multi: "multi";
        }>;
        options: z.ZodArray<z.ZodObject<{
            optionId: z.ZodString;
            label: z.ZodString;
            priceAdjust: z.ZodDefault<z.ZodNumber>;
            isDefault: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        required: z.ZodDefault<z.ZodBoolean>;
        minSelect: z.ZodDefault<z.ZodNumber>;
        maxSelect: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const ModifierOptionInputSchema: z.ZodObject<{
    optionId: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    priceAdjust: z.ZodDefault<z.ZodNumber>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ModifierGroupInputSchema: z.ZodObject<{
    groupId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    type: z.ZodEnum<{
        single: "single";
        multi: "multi";
    }>;
    options: z.ZodArray<z.ZodObject<{
        optionId: z.ZodOptional<z.ZodString>;
        label: z.ZodString;
        priceAdjust: z.ZodDefault<z.ZodNumber>;
        isDefault: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    required: z.ZodDefault<z.ZodBoolean>;
    minSelect: z.ZodDefault<z.ZodNumber>;
    maxSelect: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const CreateMenuItemSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    basePrice: z.ZodNumber;
    prepTimeMinutes: z.ZodDefault<z.ZodNumber>;
    imageUrl: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
    categoryId: z.ZodString;
    availability: z.ZodDefault<z.ZodEnum<{
        available: "available";
        sold_out: "sold_out";
        limited: "limited";
    }>>;
    modifierGroups: z.ZodDefault<z.ZodArray<z.ZodObject<{
        groupId: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        type: z.ZodEnum<{
            single: "single";
            multi: "multi";
        }>;
        options: z.ZodArray<z.ZodObject<{
            optionId: z.ZodOptional<z.ZodString>;
            label: z.ZodString;
            priceAdjust: z.ZodDefault<z.ZodNumber>;
            isDefault: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        required: z.ZodDefault<z.ZodBoolean>;
        minSelect: z.ZodDefault<z.ZodNumber>;
        maxSelect: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const UpdateMenuItemSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    basePrice: z.ZodOptional<z.ZodNumber>;
    prepTimeMinutes: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    imageUrl: z.ZodOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>>;
    categoryId: z.ZodOptional<z.ZodString>;
    availability: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        available: "available";
        sold_out: "sold_out";
        limited: "limited";
    }>>>;
    modifierGroups: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        groupId: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        type: z.ZodEnum<{
            single: "single";
            multi: "multi";
        }>;
        options: z.ZodArray<z.ZodObject<{
            optionId: z.ZodOptional<z.ZodString>;
            label: z.ZodString;
            priceAdjust: z.ZodDefault<z.ZodNumber>;
            isDefault: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
        required: z.ZodDefault<z.ZodBoolean>;
        minSelect: z.ZodDefault<z.ZodNumber>;
        maxSelect: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const MenuRecipeLineInputSchema: z.ZodObject<{
    ingredientId: z.ZodString;
    quantityUsed: z.ZodNumber;
}, z.core.$strip>;
export declare const UpsertMenuRecipeSchema: z.ZodObject<{
    lines: z.ZodArray<z.ZodObject<{
        ingredientId: z.ZodString;
        quantityUsed: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type ModifierGroup = z.infer<typeof ModifierGroupSchema>;
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemSchema>;
export type ModifierGroupInput = z.infer<typeof ModifierGroupInputSchema>;
export type MenuRecipeLineInput = z.infer<typeof MenuRecipeLineInputSchema>;
export type UpsertMenuRecipeInput = z.infer<typeof UpsertMenuRecipeSchema>;
export type ModifierDefaultsByGroup = Record<string, string[]>;
//# sourceMappingURL=menu.schema.d.ts.map