// libs/contracts/src/menu-item-review.contracts.ts
// Dish ratings & comments — shared validation, API shapes, and eligibility policy.

import { z } from 'zod';
import { isMenuItemImageUrl, MENU_ITEM_IMAGE_URL_MAX_LEN } from './menu.schema';

export const MENU_ITEM_REVIEW_COMMENT_MAX_LEN = 2_000;
export const MENU_ITEM_REVIEW_MAX_PHOTOS = 3;
/** Same URL rules as review photos; max count per reply */
export const MENU_ITEM_REVIEW_REPLY_MAX_PHOTOS = 3;
export const MENU_ITEM_REVIEW_REPLY_MAX_LEN = 2_000;

/** Days after order `placedAt` during which a review may be submitted */
export const MENU_ITEM_REVIEW_WINDOW_DAYS = 60;

export const MENU_ITEM_REVIEW_CLIENT_SOURCES = ['client_web', 'client_mobile'] as const;
export type MenuItemReviewClientSource = (typeof MENU_ITEM_REVIEW_CLIENT_SOURCES)[number];

export const MenuItemReviewVisibilitySchema = z.enum(['pending', 'public', 'hidden']);
export type MenuItemReviewVisibility = z.infer<typeof MenuItemReviewVisibilitySchema>;

export const MenuItemReviewPhotoUrlSchema = z
  .string()
  .max(MENU_ITEM_IMAGE_URL_MAX_LEN)
  .refine(isMenuItemImageUrl, { message: 'Must be a valid https URL or a PNG/JPEG/GIF/WebP data URL' });

export const CreateMenuItemReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .max(MENU_ITEM_REVIEW_COMMENT_MAX_LEN)
    .optional()
    .nullable(),
  photoUrls: z.array(MenuItemReviewPhotoUrlSchema).max(MENU_ITEM_REVIEW_MAX_PHOTOS).optional(),
});

export type CreateMenuItemReviewBody = z.infer<typeof CreateMenuItemReviewBodySchema>;

export const PublicMenuItemReviewReplyAuthorKindSchema = z.enum(['customer', 'staff']);
export type PublicMenuItemReviewReplyAuthorKind = z.infer<typeof PublicMenuItemReviewReplyAuthorKindSchema>;

export const PublicMenuItemReviewReplyRowSchema = z.object({
  id: z.string().uuid(),
  authorKind: PublicMenuItemReviewReplyAuthorKindSchema,
  authorLabel: z.string(),
  body: z.string(),
  photoUrls: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export type PublicMenuItemReviewReplyRow = z.infer<typeof PublicMenuItemReviewReplyRowSchema>;

export const CreateMenuItemReviewReplyBodySchema = z
  .object({
    body: z.string().max(MENU_ITEM_REVIEW_REPLY_MAX_LEN).optional(),
    photoUrls: z.array(MenuItemReviewPhotoUrlSchema).max(MENU_ITEM_REVIEW_REPLY_MAX_PHOTOS).optional(),
  })
  .superRefine((val, ctx) => {
    const text = (val.body ?? '').trim();
    const photos = val.photoUrls ?? [];
    if (!text && photos.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reply must include text or at least one image',
      });
    }
  })
  .transform((val) => ({
    body: (val.body ?? '').trim(),
    photoUrls: val.photoUrls ?? [],
  }));

export type CreateMenuItemReviewReplyBody = z.infer<typeof CreateMenuItemReviewReplyBodySchema>;

export const PublicMenuItemReviewRowSchema = z.object({
  id: z.string().uuid(),
  menuItemId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  photoUrls: z.array(z.string()),
  authorLabel: z.string(),
  helpfulCount: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative(),
  replies: z.array(PublicMenuItemReviewReplyRowSchema),
  createdAt: z.string().datetime(),
});

export type PublicMenuItemReviewRow = z.infer<typeof PublicMenuItemReviewRowSchema>;

export const MenuItemReviewSummarySchema = z.object({
  menuItemId: z.string().uuid(),
  averageRating: z.number().min(1).max(5).nullable(),
  reviewCount: z.number().int().nonnegative(),
});

export type MenuItemReviewSummary = z.infer<typeof MenuItemReviewSummarySchema>;

export const PublicMenuItemReviewListSchema = z.object({
  items: z.array(PublicMenuItemReviewRowSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    lastPage: z.number().int().positive(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export type PublicMenuItemReviewList = z.infer<typeof PublicMenuItemReviewListSchema>;

export const ExistingDishReviewSnapshotSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional(),
  photoUrls: z.array(z.string()).optional(),
  visibility: MenuItemReviewVisibilitySchema,
  createdAt: z.string().datetime().optional(),
  helpfulCount: z.number().int().nonnegative().optional(),
  replyCount: z.number().int().nonnegative().optional(),
});

export type ExistingDishReviewSnapshot = z.infer<typeof ExistingDishReviewSnapshotSchema>;

export const DishReviewHintRowSchema = z.object({
  menuItemId: z.string().uuid(),
  name: z.string(),
  canSubmit: z.boolean(),
  reasonCode: z.string().optional(),
  existingReview: ExistingDishReviewSnapshotSchema.nullable().optional(),
});

export type DishReviewHintRow = z.infer<typeof DishReviewHintRowSchema>;

export const AdminMenuItemReviewRowSchema = z.object({
  id: z.string().uuid(),
  menuItemId: z.string().uuid(),
  menuItemName: z.string(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  customerEmail: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  photoUrls: z.array(z.string()),
  replyCount: z.number().int().nonnegative(),
  helpfulCount: z.number().int().nonnegative(),
  visibility: MenuItemReviewVisibilitySchema,
  adminNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AdminMenuItemReviewRow = z.infer<typeof AdminMenuItemReviewRowSchema>;

export const AdminMenuItemReviewListSchema = z.object({
  items: z.array(AdminMenuItemReviewRowSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    lastPage: z.number().int().positive(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

export type AdminMenuItemReviewList = z.infer<typeof AdminMenuItemReviewListSchema>;

export const AdminPatchMenuItemReviewBodySchema = z.object({
  visibility: MenuItemReviewVisibilitySchema,
  adminNote: z.string().max(500).optional().nullable(),
});

export type AdminPatchMenuItemReviewBody = z.infer<typeof AdminPatchMenuItemReviewBodySchema>;

export type MenuItemReviewEligibilityOrder = {
  status: string;
  paymentStatus: string;
  source: string;
  fulfillmentType: string;
  customerId: string | null;
  placedAt: Date | string;
};

export type MenuItemReviewEligibilityResult =
  | { ok: true }
  | { ok: false; code: string };

function toDate(placedAt: Date | string): Date {
  if (placedAt instanceof Date) return placedAt;
  const d = new Date(placedAt);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

/**
 * Server-side gate for creating a dish review (must be re-run on POST; do not trust clients).
 */
export function evaluateMenuItemReviewEligibility(input: {
  order: MenuItemReviewEligibilityOrder;
  actorCustomerId: string;
  menuItemId: string;
  orderContainsMenuItem: boolean;
  now?: Date;
}): MenuItemReviewEligibilityResult {
  const now = input.now ?? new Date();
  const { order, actorCustomerId, menuItemId, orderContainsMenuItem } = input;

  if (!menuItemId) return { ok: false, code: 'MENU_ITEM_REQUIRED' };
  if (!orderContainsMenuItem) return { ok: false, code: 'ITEM_NOT_IN_ORDER' };

  if (!order.customerId || order.customerId !== actorCustomerId) {
    return { ok: false, code: 'ORDER_NOT_OWNED' };
  }

  if (order.paymentStatus !== 'completed') {
    return { ok: false, code: 'PAYMENT_NOT_COMPLETED' };
  }

  if (!MENU_ITEM_REVIEW_CLIENT_SOURCES.includes(order.source as MenuItemReviewClientSource)) {
    return { ok: false, code: 'SOURCE_NOT_ELIGIBLE' };
  }

  const terminalCancelled = ['cancelled', 'voided', 'refunded'].includes(order.status);
  if (terminalCancelled) return { ok: false, code: 'ORDER_TERMINAL_INELIGIBLE' };

  const isDelivery = order.fulfillmentType === 'delivery';
  const statusOk = isDelivery
    ? order.status === 'delivered'
    : order.status === 'delivered' || order.status === 'ready';
  if (!statusOk) return { ok: false, code: 'ORDER_NOT_COMPLETE' };

  const placed = toDate(order.placedAt);
  const windowMs = MENU_ITEM_REVIEW_WINDOW_DAYS * 86_400_000;
  if (now.getTime() - placed.getTime() > windowMs) {
    return { ok: false, code: 'REVIEW_WINDOW_EXPIRED' };
  }

  return { ok: true };
}
