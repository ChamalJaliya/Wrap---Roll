// libs/contracts/src/customer.schema.ts
import { z } from 'zod';
import { DishReviewHintRowSchema } from './menu-item-review.contracts';

export const CustomerAddressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, 'Label is required (e.g. Home, Work)'),
  addressLine1: z.string().min(1, 'Address Line 1 is required'),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  geocodeSource: z.string().optional().nullable(),
  geocodeAccuracy: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
});

export const SavedPaymentTokenSchema = z.object({
  id: z.string().uuid().optional(),
  token: z.string(),
  cardBrand: z.string(),
  last4: z.string().length(4),
  isDefault: z.boolean().default(false),
});

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  addresses: z.array(CustomerAddressSchema),
  savedPayments: z.array(SavedPaymentTokenSchema),
});

export const CustomerHistoryOrderItemRowSchema = z.object({
  id: z.string().uuid(),
  menuItemId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number().or(z.string()),
  lineTotal: z.number().or(z.string()),
  modifiersJson: z.unknown().optional(),
});

export const CustomerHistoryOrderSchema = z.object({
  id: z.string().uuid(),
  placedAt: z.string(),
  fulfillmentType: z.string(),
  status: z.string(),
  total: z.number().or(z.string()),
  paymentStatus: z.string().optional(),
  source: z.string().optional(),
  updatedAt: z.string().optional(),
  items: z.array(CustomerHistoryOrderItemRowSchema).optional(),
  /** Per distinct menu item on this order — server-computed review affordances */
  dishReviewHints: z.array(DishReviewHintRowSchema).optional(),
});

export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;
export type SavedPaymentToken = z.infer<typeof SavedPaymentTokenSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type CustomerHistoryOrderItemRow = z.infer<typeof CustomerHistoryOrderItemRowSchema>;
export type CustomerHistoryOrder = z.infer<typeof CustomerHistoryOrderSchema>;
