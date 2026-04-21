export declare const STAFF_ROLES: readonly ["ADMIN", "CASHIER", "KITCHEN", "COURIER"];
export type StaffRole = (typeof STAFF_ROLES)[number];
/** Storefront shopper role — Supabase `user_metadata.role` (distinct from staff roles). */
export declare const SHOPPER_ROLE: "CLIENT";
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
//# sourceMappingURL=staff.contracts.d.ts.map