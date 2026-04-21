import { type StaffRole, SHOPPER_ROLE } from '@wrap-roll/contracts';

export type AppRole = StaffRole | typeof SHOPPER_ROLE;
