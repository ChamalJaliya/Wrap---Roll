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
export const OPS_ACTIVITY_ENTITY_TYPE_FILTERS = [
  'order',
  'staff_user',
  'courier',
  'settings',
  'coupon',
  'inventory_ingredient',
  'inventory_overhead',
] as const;

export type OpsActivityEntityTypeFilter = (typeof OPS_ACTIVITY_ENTITY_TYPE_FILTERS)[number];

/** Short titles for admin surfaces (`OpsActivityEventRow.app`). */
export const ACTIVITY_APP_LABELS: Record<OpsActivityEventRow['app'], string> = {
  client: 'Storefront',
  cashier: 'Cashier POS',
  kitchen: 'Kitchen',
  delivery: 'Delivery',
  admin: 'Admin',
  system: 'System',
};

/** Short titles for `entityType` strings stored on activity rows. */
export const ACTIVITY_ENTITY_TYPE_LABELS: Record<string, string> = {
  order: 'Order',
  staff_user: 'Staff user',
  courier: 'Courier',
  settings: 'Settings',
  coupon: 'Coupon',
  inventory_ingredient: 'Inventory',
  inventory_overhead: 'Overhead',
};

/**
 * Optional pretty titles for `eventType` audit slugs (e.g. `order.status_changed`).
 * Add a row here when you introduce a new event from the backend.
 */
export const ACTIVITY_EVENT_TYPE_LABELS: Record<string, string> = {
  'order.status_changed': 'Status change',
  'order.payment_confirmed': 'Payment confirmed',
  'order.payment_collected': 'Payment collected',
  'order.courier_assigned': 'Courier assigned',
  'order.created': 'Order created',
  'inventory.async_handler_failed': 'Inventory error',
};

export function formatActivityApp(app: string): string {
  return (ACTIVITY_APP_LABELS as Record<string, string>)[app] ?? app;
}

export function formatActivityEntityType(entityType: string): string {
  return ACTIVITY_ENTITY_TYPE_LABELS[entityType] ?? entityType.replace(/_/g, ' ');
}

export function formatActivityEventTypeLabel(eventType: string): string {
  if (ACTIVITY_EVENT_TYPE_LABELS[eventType]) return ACTIVITY_EVENT_TYPE_LABELS[eventType];
  const parts = eventType.split('.');
  const tail = parts[parts.length - 1] ?? eventType;
  return tail
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatActivityActorRole(role: string | null | undefined): string {
  if (!role) return '';
  if (role === 'CLIENT') return 'Customer';
  if (role === 'SYSTEM') return 'System';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function activityEventLooksLikeFailure(
  event: Pick<OpsActivityEventRow, 'eventType' | 'summary'>,
): boolean {
  const s = `${event.eventType} ${event.summary}`.toLowerCase();
  return s.includes('fail') || s.includes('error');
}

/** Hints for styling (no CSS here — apps map to theme classes). */
export function getActivityEventVisualHints(
  event: Pick<OpsActivityEventRow, 'eventType' | 'summary' | 'app'>,
): { failure: boolean; systemSurface: boolean } {
  return {
    failure: activityEventLooksLikeFailure(event),
    systemSurface: event.app === 'system',
  };
}
