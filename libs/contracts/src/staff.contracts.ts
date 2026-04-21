export const STAFF_ROLES = ['ADMIN', 'CASHIER', 'KITCHEN', 'COURIER'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Storefront shopper role — Supabase `user_metadata.role` (distinct from staff roles). */
export const SHOPPER_ROLE = 'CLIENT' as const;
export type ShopperRole = typeof SHOPPER_ROLE;

export type StaffAuthUserView = {
  id: string;
  email: string;
  role: StaffRole;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};
