import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  WrapOrderSchema,
  CustomerAddressSchema,
  SavedPaymentTokenSchema,
  PayHereWebhookSchema,
  CreateMenuItemSchema,
  UpdateMenuItemSchema,
  UpsertMenuRecipeSchema,
  MenuRecipeLineInputSchema,
  CreateIngredientInputSchema,
  UpdateIngredientInputSchema,
  CreateRestockEntryInputSchema,
  CreateWasteEntryInputSchema,
  CreateStockAdjustmentInputSchema,
  CreateOverheadCostEntryInputSchema,
} from '@wrap-roll/contracts';

/** Matches `OrderService.updateOrderSupportDetails` body. */
export const SupportOrderUpdateSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  tableNumber: z.string().optional(),
  deliveryAddress: z.string().optional(),
  estimatedReadyTime: z.string().nullable().optional(),
  note: z.string().optional(),
});

/** Partial admin update for `BusinessSettings` (writable fields only). */
export const UpdateAdminSettingsSchema = z.object({
  timezone: z.string().optional(),
  openingTimeMinutes: z.number().optional(),
  closingTimeMinutes: z.number().optional(),
  scheduleSameDayOnly: z.boolean().optional(),
  minLeadTimeMinutes: z.number().optional(),
  businessName: z.string().optional(),
  contactEmail: z.string().optional(),
  replyToEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  checkoutVatRate: z.number().optional(),
  deliveryJson: z.unknown().optional(),
  paymentJson: z.unknown().optional(),
  operationsCalendarJson: z.unknown().optional(),
});

export const MenuCategoryBodySchema = z.object({
  name: z.string().min(1),
});

/** `MenuService.replaceModifierDeltas` — `deltas` array shape. */
export const ReplaceModifierDeltasBodySchema = z.object({
  deltas: z.array(
    z.object({
      optionId: z.string(),
      ingredientId: z.string(),
      quantityDelta: z.union([z.string(), z.number()]),
    }),
  ),
});

export const ValidateCouponBodySchema = z.object({
  code: z.string(),
  subtotal: z.number(),
  customerPhone: z.string().optional(),
});

export const AdminCouponCreateBodySchema = z.object({
  code: z.string(),
  discountPercent: z.number(),
  minSubtotal: z.number().nullable().optional(),
  firstOrderOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  expiryDate: z.string().nullable().optional(),
});

export const AdminCouponUpdateBodySchema = z.object({
  discountPercent: z.number().optional(),
  minSubtotal: z.number().nullable().optional(),
  firstOrderOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  expiryDate: z.string().nullable().optional(),
});

export const CustomerProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
});

export const CustomerAdminPatchSchema = z.object({
  name: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export class CreateOrderBodyDto extends createZodDto(WrapOrderSchema) {}

export class CustomerAddressBodyDto extends createZodDto(CustomerAddressSchema) {}
export class SavedPaymentTokenBodyDto extends createZodDto(SavedPaymentTokenSchema) {}
export class PayHereWebhookBodyDto extends createZodDto(PayHereWebhookSchema) {}

export class SupportOrderUpdateBodyDto extends createZodDto(SupportOrderUpdateSchema) {}
export class UpdateAdminSettingsBodyDto extends createZodDto(UpdateAdminSettingsSchema) {}

export class MenuCategoryBodyDto extends createZodDto(MenuCategoryBodySchema) {}
export class CreateMenuItemBodyDto extends createZodDto(CreateMenuItemSchema) {}
export class UpdateMenuItemBodyDto extends createZodDto(UpdateMenuItemSchema) {}
export class UpsertMenuRecipeBodyDto extends createZodDto(UpsertMenuRecipeSchema) {}
export class MenuRecipeLineBodyDto extends createZodDto(MenuRecipeLineInputSchema) {}
export class ReplaceModifierDeltasBodyDto extends createZodDto(ReplaceModifierDeltasBodySchema) {}

export class CreateIngredientBodyDto extends createZodDto(CreateIngredientInputSchema) {}
export class UpdateIngredientBodyDto extends createZodDto(UpdateIngredientInputSchema) {}
export class CreateRestockEntryBodyDto extends createZodDto(CreateRestockEntryInputSchema) {}
export class CreateWasteEntryBodyDto extends createZodDto(CreateWasteEntryInputSchema) {}
export class CreateStockAdjustmentBodyDto extends createZodDto(CreateStockAdjustmentInputSchema) {}
export class CreateOverheadCostEntryBodyDto extends createZodDto(CreateOverheadCostEntryInputSchema) {}

export class ValidateCouponBodyDto extends createZodDto(ValidateCouponBodySchema) {}
export class AdminCouponCreateBodyDto extends createZodDto(AdminCouponCreateBodySchema) {}
export class AdminCouponUpdateBodyDto extends createZodDto(AdminCouponUpdateBodySchema) {}

export class CustomerProfileUpdateBodyDto extends createZodDto(CustomerProfileUpdateSchema) {}
export class CustomerAdminPatchBodyDto extends createZodDto(CustomerAdminPatchSchema) {}

const staffRole = z.enum(['ADMIN', 'CASHIER', 'KITCHEN', 'COURIER']);

export class StaffCreateUserBodyDto extends createZodDto(
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
    role: staffRole,
    fullName: z.string().min(1),
    phone: z.string().optional(),
  }),
) {}

export class StaffUpdateUserBodyDto extends createZodDto(
  z.object({
    role: staffRole.optional(),
    fullName: z.string().optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional(),
    password: z.string().optional(),
  }),
) {}

export class StaffBulkUpdateBodyDto extends createZodDto(
  z.object({
    userIds: z.array(z.string()),
    action: z.enum(['setActive', 'setRole']),
    isActive: z.boolean().optional(),
    role: staffRole.optional(),
  }),
) {}

export class StaffCreateCourierBodyDto extends createZodDto(
  z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
  }),
) {}

export class StaffCourierStatusBodyDto extends createZodDto(
  z.object({
    isActive: z.boolean(),
  }),
) {}
