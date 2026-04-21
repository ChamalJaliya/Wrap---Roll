// libs/contracts/src/menu.schema.ts
// ⛔ LSA-ONLY — Menu and Modifier contracts.

import { z } from 'zod';
import { AvailabilitySchema } from './availability.schema';

/** Max stored length (~1.5MB base64) — keeps menu rows and JSON payloads bounded */
export const MENU_ITEM_IMAGE_URL_MAX_LEN = 2_000_000;

export function isMenuItemImageUrl(val: string): boolean {
  if (!val || val.length > MENU_ITEM_IMAGE_URL_MAX_LEN) return false;
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(val)) return true;
  try {
    const u = new URL(val);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const MenuItemImageUrlSchema = z
  .string()
  .max(MENU_ITEM_IMAGE_URL_MAX_LEN)
  .refine(isMenuItemImageUrl, {
    message: 'Must be a valid https URL or a PNG/JPEG/GIF/WebP data URL',
  });

export const ModifierGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string(), // e.g. "Base", "Protein", "Toppings", "Sauces"
  type: z.enum(['single', 'multi']),
  options: z.array(
    z.object({
      optionId: z.string().uuid(),
      label: z.string(),
      priceAdjust: z.number().default(0), // LKR — 0 for included options
      isDefault: z.boolean().default(false),
    }),
  ),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
});

export const MenuItemSchema = z.object({
  itemId:          z.string().uuid(),
  name:            z.string(),
  description:     z.string().optional(),
  basePrice:       z.number().nonnegative(),  // LKR
  prepTimeMinutes: z.number().int().nonnegative(),
  imageUrl:        MenuItemImageUrlSchema.optional(),
  categoryId:      z.string().uuid(),
  categoryName:    z.string(),
  availability:    AvailabilitySchema.default('available'),
  modifierGroups:  z.array(ModifierGroupSchema),
  isActive:        z.boolean().default(true),
  createdAt:       z.string().datetime(),
  updatedAt:       z.string().datetime(),
});

export const ModifierOptionInputSchema = z.object({
  optionId: z.string().uuid().optional(),
  label: z.string().min(1),
  priceAdjust: z.number().default(0),
  isDefault: z.boolean().default(false),
});

export const ModifierGroupInputSchema = z.object({
  groupId: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['single', 'multi']),
  options: z.array(ModifierOptionInputSchema),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
});

export const CreateMenuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  basePrice: z.number().nonnegative(),
  prepTimeMinutes: z.number().int().nonnegative().default(0),
  imageUrl: z.union([MenuItemImageUrlSchema, z.null()]).optional(),
  categoryId: z.string().uuid(),
  availability: AvailabilitySchema.default('available'),
  modifierGroups: z.array(ModifierGroupInputSchema).default([]),
  isActive: z.boolean().default(true),
});

export const UpdateMenuItemSchema = CreateMenuItemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field must be provided',
);

export const MenuRecipeLineInputSchema = z.object({
  ingredientId: z.string().uuid(),
  quantityUsed: z.number().positive(),
});

export const UpsertMenuRecipeSchema = z.object({
  lines: z.array(MenuRecipeLineInputSchema),
});

export type MenuItem      = z.infer<typeof MenuItemSchema>;
export type ModifierGroup = z.infer<typeof ModifierGroupSchema>;
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemSchema>;
export type ModifierGroupInput = z.infer<typeof ModifierGroupInputSchema>;
export type MenuRecipeLineInput = z.infer<typeof MenuRecipeLineInputSchema>;
export type UpsertMenuRecipeInput = z.infer<typeof UpsertMenuRecipeSchema>;
export type ModifierDefaultsByGroup = Record<string, string[]>;
