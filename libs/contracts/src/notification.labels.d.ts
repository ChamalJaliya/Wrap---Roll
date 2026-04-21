/**
 * Single source of truth for Notifications admin UI (delivery audit + staff inbox).
 *
 * When the API adds a new `status`, `channel`, `templateKey`, or staff `kind`, add a row
 * to the matching map below for a polished label; otherwise formatters fall back to readable text.
 */
import type { NotificationDeliveryRow, StaffNotificationRow } from './order.api.contracts';
export declare const NOTIFICATION_CHANNEL_LABELS: Record<string, string>;
/** Logged delivery outcomes from the API (extend when new statuses appear). */
export declare const NOTIFICATION_DELIVERY_STATUS_LABELS: Record<string, string>;
/** Optional pretty names for `templateKey` (e.g. order_sms_ready). */
export declare const NOTIFICATION_TEMPLATE_KEY_LABELS: Record<string, string>;
export declare const STAFF_NOTIFICATION_KIND_LABELS: Record<string, string>;
export declare const NOTIFICATION_PAGE_COPY: {
    readonly pageTitle: "Notifications";
    readonly pageDescription: "SMS delivery audit and your staff inbox. In-app messages show here when the API creates them.";
    readonly smsLogHeading: "SMS delivery log";
    readonly inboxHeading: "Staff inbox";
    readonly loadMore: "Load more";
    readonly markAllRead: "Mark all read";
    readonly markRead: "Mark read";
    readonly loadingDeliveries: "Loading…";
    readonly loadingDeliveriesDesc: "Fetching delivery history.";
    readonly loadingInbox: "Loading…";
    readonly loadingInboxDesc: "Fetching inbox.";
    readonly emptyDeliveriesTitle: "No deliveries yet";
    readonly emptyDeliveriesDesc: "Outbound SMS attempts are logged when orders trigger customer texts.";
    readonly emptyInboxTitle: "Inbox empty";
    readonly emptyInboxDesc: "No in-app staff notifications yet.";
    readonly toRecipient: "To";
};
export declare function notificationInboxSectionTitle(unreadCount: number): string;
export declare function formatNotificationChannel(channel: string): string;
export declare function formatNotificationDeliveryStatus(status: string): string;
export declare function formatNotificationTemplateKey(templateKey: string | null | undefined): string;
export declare function formatStaffNotificationKind(kind: string): string;
/** Parse `{ detail }` / `{ message }` from Nest or Next API proxy JSON bodies. */
export declare function parseNestProxyErrorDetail(data: unknown): string | undefined;
/**
 * User-facing API errors for the notifications admin page (proxy / Nest failures).
 * Pass `detail` from `parseNestProxyErrorDetail(err.response?.data)`.
 */
export declare function formatNotificationPageApiError(opts: {
    status?: number;
    detail?: string;
    context: 'deliveries' | 'inbox';
}): string;
/** One-line summary under a delivery row (channel, template, order hint). */
export declare function formatNotificationDeliveryMetaLine(d: Pick<NotificationDeliveryRow, 'channel' | 'templateKey' | 'orderId'>): string;
export declare function notificationDeliveryLooksLikeError(d: Pick<NotificationDeliveryRow, 'status' | 'error'>): boolean;
export declare function getNotificationDeliveryVisualHints(d: Pick<NotificationDeliveryRow, 'status' | 'error'>): {
    error: boolean;
    skipped: boolean;
};
export declare function shortNotificationOrderRef(orderId: string | null | undefined): string | null;
/** Optional badge for inbox rows (kind is often enough). */
export declare function staffNotificationSummaryLine(n: Pick<StaffNotificationRow, 'kind'>): string;
//# sourceMappingURL=notification.labels.d.ts.map