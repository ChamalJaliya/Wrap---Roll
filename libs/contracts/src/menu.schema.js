"use strict";
// libs/contracts/src/menu.schema.ts
// ⛔ LSA-ONLY — Menu and Modifier contracts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertMenuRecipeSchema = exports.MenuRecipeLineInputSchema = exports.UpdateMenuItemSchema = exports.CreateMenuItemSchema = exports.ModifierGroupInputSchema = exports.ModifierOptionInputSchema = exports.MenuItemSchema = exports.ModifierGroupSchema = exports.MenuItemImageUrlSchema = exports.MENU_ITEM_IMAGE_URL_MAX_LEN = void 0;
exports.isMenuItemImageUrl = isMenuItemImageUrl;
const zod_1 = require("zod");
const order_schema_1 = require("./order.schema");
/** Max stored length (~1.5MB base64) — keeps menu rows and JSON payloads bounded */
exports.MENU_ITEM_IMAGE_URL_MAX_LEN = 2000000;
function isMenuItemImageUrl(val) {
    if (!val || val.length > exports.MENU_ITEM_IMAGE_URL_MAX_LEN)
        return false;
    if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(val))
        return true;
    try {
        const u = new URL(val);
        return u.protocol === 'http:' || u.protocol === 'https:';
    }
    catch {
        return false;
    }
}
exports.MenuItemImageUrlSchema = zod_1.z
    .string()
    .max(exports.MENU_ITEM_IMAGE_URL_MAX_LEN)
    .refine(isMenuItemImageUrl, {
    message: 'Must be a valid https URL or a PNG/JPEG/GIF/WebP data URL',
});
exports.ModifierGroupSchema = zod_1.z.object({
    groupId: zod_1.z.string().uuid(),
    name: zod_1.z.string(), // e.g. "Base", "Protein", "Toppings", "Sauces"
    type: zod_1.z.enum(['single', 'multi']),
    options: zod_1.z.array(zod_1.z.object({
        optionId: zod_1.z.string().uuid(),
        label: zod_1.z.string(),
        priceAdjust: zod_1.z.number().default(0), // LKR — 0 for included options
        isDefault: zod_1.z.boolean().default(false),
    })),
    required: zod_1.z.boolean().default(false),
    minSelect: zod_1.z.number().int().min(0).default(0),
    maxSelect: zod_1.z.number().int().min(1).default(1),
});
exports.MenuItemSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    basePrice: zod_1.z.number().nonnegative(), // LKR
    prepTimeMinutes: zod_1.z.number().int().nonnegative(),
    imageUrl: exports.MenuItemImageUrlSchema.optional(),
    categoryId: zod_1.z.string().uuid(),
    categoryName: zod_1.z.string(),
    availability: order_schema_1.AvailabilitySchema.default('available'),
    modifierGroups: zod_1.z.array(exports.ModifierGroupSchema),
    isActive: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.ModifierOptionInputSchema = zod_1.z.object({
    optionId: zod_1.z.string().uuid().optional(),
    label: zod_1.z.string().min(1),
    priceAdjust: zod_1.z.number().default(0),
    isDefault: zod_1.z.boolean().default(false),
});
exports.ModifierGroupInputSchema = zod_1.z.object({
    groupId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(1),
    type: zod_1.z.enum(['single', 'multi']),
    options: zod_1.z.array(exports.ModifierOptionInputSchema),
    required: zod_1.z.boolean().default(false),
    minSelect: zod_1.z.number().int().min(0).default(0),
    maxSelect: zod_1.z.number().int().min(1).default(1),
});
exports.CreateMenuItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    basePrice: zod_1.z.number().nonnegative(),
    prepTimeMinutes: zod_1.z.number().int().nonnegative().default(0),
    imageUrl: zod_1.z.union([exports.MenuItemImageUrlSchema, zod_1.z.null()]).optional(),
    categoryId: zod_1.z.string().uuid(),
    availability: order_schema_1.AvailabilitySchema.default('available'),
    modifierGroups: zod_1.z.array(exports.ModifierGroupInputSchema).default([]),
    isActive: zod_1.z.boolean().default(true),
});
exports.UpdateMenuItemSchema = exports.CreateMenuItemSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');
exports.MenuRecipeLineInputSchema = zod_1.z.object({
    ingredientId: zod_1.z.string().uuid(),
    quantityUsed: zod_1.z.number().positive(),
});
exports.UpsertMenuRecipeSchema = zod_1.z.object({
    lines: zod_1.z.array(exports.MenuRecipeLineInputSchema),
});
//# sourceMappingURL=menu.schema.js.map