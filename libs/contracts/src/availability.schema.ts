// libs/contracts/src/availability.schema.ts
// ⛔ LSA-ONLY — Shared menu/order availability enum (no imports from order/bundle/menu).
// Kept in its own module to avoid circular imports: order ↔ bundle ↔ menu.

import { z } from 'zod';

/** Item availability (managed by apps/admin, Sprint S5). */
export const AvailabilitySchema = z.enum(['available', 'sold_out', 'limited']);
export type Availability = z.infer<typeof AvailabilitySchema>;
