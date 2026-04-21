/**
 * Single source of truth for human-readable Activity / audit UI strings.
 *
 * When you add a new `eventType` from the API, add one entry to
 * `ACTIVITY_EVENT_TYPE_LABELS` for a nice title; if you skip it,
 * `formatActivityEventTypeLabel` still derives a readable label from the slug.
 *
 * Keep this file in sync with `OpsActivityEventRow` in `order.api.contracts.ts`.
 */
import type { OpsActivityEventRow } from './order.api.contracts';
/** Filter dropdown: entity `entityType` values we expect in ops activity. */
export declare const OPS_ACTIVITY_ENTITY_TYPE_FILTERS: readonly ["order", "staff_user", "courier", "settings", "coupon", "inventory_ingredient", "inventory_overhead"];
export type OpsActivityEntityTypeFilter = (typeof OPS_ACTIVITY_ENTITY_TYPE_FILTERS)[number];
/** Short titles for admin surfaces (`OpsActivityEventRow.app`). */
export declare const ACTIVITY_APP_LABELS: Record<OpsActivityEventRow['app'], string>;
/** Short titles for `entityType` strings stored on activity rows. */
export declare const ACTIVITY_ENTITY_TYPE_LABELS: Record<string, string>;
/**
 * Optional pretty titles for `eventType` audit slugs (e.g. `order.status_changed`).
 * Add a row here when you introduce a new event from the backend.
 */
export declare const ACTIVITY_EVENT_TYPE_LABELS: Record<string, string>;
export declare function formatActivityApp(app: string): string;
export declare function formatActivityEntityType(entityType: string): string;
export declare function formatActivityEventTypeLabel(eventType: string): string;
export declare function formatActivityActorRole(role: string | null | undefined): string;
export declare function activityEventLooksLikeFailure(event: Pick<OpsActivityEventRow, 'eventType' | 'summary'>): boolean;
/** Hints for styling (no CSS here — apps map to theme classes). */
export declare function getActivityEventVisualHints(event: Pick<OpsActivityEventRow, 'eventType' | 'summary' | 'app'>): {
    failure: boolean;
    systemSurface: boolean;
};
//# sourceMappingURL=activity.labels.d.ts.map