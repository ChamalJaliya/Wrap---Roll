"use strict";
/**
 * Single source of truth for human-readable Activity / audit UI strings.
 *
 * When you add a new `eventType` from the API, add one entry to
 * `ACTIVITY_EVENT_TYPE_LABELS` for a nice title; if you skip it,
 * `formatActivityEventTypeLabel` still derives a readable label from the slug.
 *
 * Keep this file in sync with `OpsActivityEventRow` in `order.api.contracts.ts`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVITY_EVENT_TYPE_LABELS = exports.ACTIVITY_ENTITY_TYPE_LABELS = exports.ACTIVITY_APP_LABELS = exports.OPS_ACTIVITY_ENTITY_TYPE_FILTERS = void 0;
exports.formatActivityApp = formatActivityApp;
exports.formatActivityEntityType = formatActivityEntityType;
exports.formatActivityEventTypeLabel = formatActivityEventTypeLabel;
exports.formatActivityActorRole = formatActivityActorRole;
exports.activityEventLooksLikeFailure = activityEventLooksLikeFailure;
exports.getActivityEventVisualHints = getActivityEventVisualHints;
/** Filter dropdown: entity `entityType` values we expect in ops activity. */
exports.OPS_ACTIVITY_ENTITY_TYPE_FILTERS = [
    'order',
    'staff_user',
    'courier',
    'settings',
    'coupon',
    'inventory_ingredient',
    'inventory_overhead',
];
/** Short titles for admin surfaces (`OpsActivityEventRow.app`). */
exports.ACTIVITY_APP_LABELS = {
    client: 'Storefront',
    cashier: 'Cashier POS',
    kitchen: 'Kitchen',
    delivery: 'Delivery',
    admin: 'Admin',
    system: 'System',
};
/** Short titles for `entityType` strings stored on activity rows. */
exports.ACTIVITY_ENTITY_TYPE_LABELS = {
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
exports.ACTIVITY_EVENT_TYPE_LABELS = {
    'order.status_changed': 'Status change',
    'order.payment_confirmed': 'Payment confirmed',
    'order.payment_collected': 'Payment collected',
    'order.courier_assigned': 'Courier assigned',
    'order.created': 'Order created',
    'inventory.async_handler_failed': 'Inventory error',
};
function formatActivityApp(app) {
    var _a;
    return (_a = exports.ACTIVITY_APP_LABELS[app]) !== null && _a !== void 0 ? _a : app;
}
function formatActivityEntityType(entityType) {
    var _a;
    return (_a = exports.ACTIVITY_ENTITY_TYPE_LABELS[entityType]) !== null && _a !== void 0 ? _a : entityType.replace(/_/g, ' ');
}
function formatActivityEventTypeLabel(eventType) {
    var _a;
    if (exports.ACTIVITY_EVENT_TYPE_LABELS[eventType])
        return exports.ACTIVITY_EVENT_TYPE_LABELS[eventType];
    const parts = eventType.split('.');
    const tail = (_a = parts[parts.length - 1]) !== null && _a !== void 0 ? _a : eventType;
    return tail
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatActivityActorRole(role) {
    if (!role)
        return '';
    if (role === 'CLIENT')
        return 'Customer';
    if (role === 'SYSTEM')
        return 'System';
    return role.charAt(0) + role.slice(1).toLowerCase();
}
function activityEventLooksLikeFailure(event) {
    const s = `${event.eventType} ${event.summary}`.toLowerCase();
    return s.includes('fail') || s.includes('error');
}
/** Hints for styling (no CSS here — apps map to theme classes). */
function getActivityEventVisualHints(event) {
    return {
        failure: activityEventLooksLikeFailure(event),
        systemSurface: event.app === 'system',
    };
}
//# sourceMappingURL=activity.labels.js.map