"use strict";
/**
 * Single source of truth for Notifications admin UI (delivery audit + staff inbox).
 *
 * When the API adds a new `status`, `channel`, `templateKey`, or staff `kind`, add a row
 * to the matching map below for a polished label; otherwise formatters fall back to readable text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_PAGE_COPY = exports.STAFF_NOTIFICATION_KIND_LABELS = exports.NOTIFICATION_TEMPLATE_KEY_LABELS = exports.NOTIFICATION_DELIVERY_STATUS_LABELS = exports.NOTIFICATION_CHANNEL_LABELS = void 0;
exports.notificationInboxSectionTitle = notificationInboxSectionTitle;
exports.formatNotificationChannel = formatNotificationChannel;
exports.formatNotificationDeliveryStatus = formatNotificationDeliveryStatus;
exports.formatNotificationTemplateKey = formatNotificationTemplateKey;
exports.formatStaffNotificationKind = formatStaffNotificationKind;
exports.parseNestProxyErrorDetail = parseNestProxyErrorDetail;
exports.formatNotificationPageApiError = formatNotificationPageApiError;
exports.formatNotificationDeliveryMetaLine = formatNotificationDeliveryMetaLine;
exports.notificationDeliveryLooksLikeError = notificationDeliveryLooksLikeError;
exports.getNotificationDeliveryVisualHints = getNotificationDeliveryVisualHints;
exports.shortNotificationOrderRef = shortNotificationOrderRef;
exports.staffNotificationSummaryLine = staffNotificationSummaryLine;
// ── SMS / delivery audit (`NotificationDeliveryRow`) ─────────────────────────
exports.NOTIFICATION_CHANNEL_LABELS = {
    sms: 'SMS',
    email: 'Email',
};
/** Logged delivery outcomes from the API (extend when new statuses appear). */
exports.NOTIFICATION_DELIVERY_STATUS_LABELS = {
    sent: 'Sent',
    failed: 'Failed',
    skipped_no_phone: 'Skipped (no phone)',
    pending: 'Pending',
};
/** Optional pretty names for `templateKey` (e.g. order_sms_ready). */
exports.NOTIFICATION_TEMPLATE_KEY_LABELS = {};
// ── Staff inbox (`StaffNotificationRow.kind`) ───────────────────────────────
exports.STAFF_NOTIFICATION_KIND_LABELS = {
    info: 'Info',
    alert: 'Alert',
    system: 'System',
};
// ── Admin page copy (headings, empty states, buttons) ───────────────────────
exports.NOTIFICATION_PAGE_COPY = {
    pageTitle: 'Notifications',
    pageDescription: 'SMS delivery audit and your staff inbox. In-app messages show here when the API creates them.',
    smsLogHeading: 'SMS delivery log',
    inboxHeading: 'Staff inbox',
    loadMore: 'Load more',
    markAllRead: 'Mark all read',
    markRead: 'Mark read',
    loadingDeliveries: 'Loading…',
    loadingDeliveriesDesc: 'Fetching delivery history.',
    loadingInbox: 'Loading…',
    loadingInboxDesc: 'Fetching inbox.',
    emptyDeliveriesTitle: 'No deliveries yet',
    emptyDeliveriesDesc: 'Outbound SMS attempts are logged when orders trigger customer texts.',
    emptyInboxTitle: 'Inbox empty',
    emptyInboxDesc: 'No in-app staff notifications yet.',
    toRecipient: 'To',
};
function notificationInboxSectionTitle(unreadCount) {
    const base = exports.NOTIFICATION_PAGE_COPY.inboxHeading;
    return unreadCount > 0 ? `${base} (${unreadCount} unread)` : base;
}
function formatNotificationChannel(channel) {
    var _a;
    return (_a = exports.NOTIFICATION_CHANNEL_LABELS[channel]) !== null && _a !== void 0 ? _a : channel.toUpperCase();
}
function formatNotificationDeliveryStatus(status) {
    var _a;
    return (_a = exports.NOTIFICATION_DELIVERY_STATUS_LABELS[status]) !== null && _a !== void 0 ? _a : status.replace(/_/g, ' ');
}
function formatNotificationTemplateKey(templateKey) {
    if (templateKey == null || templateKey === '')
        return '';
    if (exports.NOTIFICATION_TEMPLATE_KEY_LABELS[templateKey]) {
        return exports.NOTIFICATION_TEMPLATE_KEY_LABELS[templateKey];
    }
    return templateKey.replace(/_/g, ' ');
}
function formatStaffNotificationKind(kind) {
    var _a;
    return (_a = exports.STAFF_NOTIFICATION_KIND_LABELS[kind]) !== null && _a !== void 0 ? _a : kind.replace(/_/g, ' ');
}
/** Parse `{ detail }` / `{ message }` from Nest or Next API proxy JSON bodies. */
function parseNestProxyErrorDetail(data) {
    if (!data || typeof data !== 'object')
        return undefined;
    const d = data;
    if (typeof d.detail === 'string' && d.detail.length > 0)
        return d.detail;
    if (typeof d.message === 'string')
        return d.message;
    if (Array.isArray(d.message) && d.message.every((x) => typeof x === 'string')) {
        return d.message.join(', ');
    }
    return undefined;
}
/**
 * User-facing API errors for the notifications admin page (proxy / Nest failures).
 * Pass `detail` from `parseNestProxyErrorDetail(err.response?.data)`.
 */
function formatNotificationPageApiError(opts) {
    const { status, detail, context } = opts;
    if (status === 401) {
        return 'Not signed in or session expired. Refresh the page and sign in again.';
    }
    if (status === 403) {
        if (context === 'deliveries') {
            return 'SMS delivery log is limited to Admin accounts. Sign in as an Admin or ask an Admin to review deliveries.';
        }
        return 'You do not have access to the staff inbox with this account.';
    }
    if (status === 502 || status === 504) {
        const base = 'Could not reach the API (proxy timeout or backend down). Ensure the API is running on port 4000 and apps/admin/.env.local has API_PROXY_TARGET=http://127.0.0.1:4000/api';
        return detail ? `${base}. (${detail})` : base;
    }
    if (status === 500 && detail) {
        return `Server error: ${detail}`;
    }
    if (status) {
        return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status}).`;
    }
    return detail !== null && detail !== void 0 ? detail : 'Network error.';
}
/** One-line summary under a delivery row (channel, template, order hint). */
function formatNotificationDeliveryMetaLine(d) {
    const parts = [];
    const ch = formatNotificationChannel(d.channel);
    const tk = formatNotificationTemplateKey(d.templateKey);
    if (tk)
        parts.push(tk);
    else
        parts.push(ch);
    if (d.orderId) {
        parts.push(`Order ${d.orderId.slice(0, 8)}…`);
    }
    return parts.join(' · ');
}
function notificationDeliveryLooksLikeError(d) {
    var _a;
    if (d.error && String(d.error).trim().length > 0)
        return true;
    const s = String((_a = d.status) !== null && _a !== void 0 ? _a : '').toLowerCase();
    return s === 'failed' || s.includes('fail');
}
function getNotificationDeliveryVisualHints(d) {
    var _a;
    const s = String((_a = d.status) !== null && _a !== void 0 ? _a : '').toLowerCase();
    return {
        error: notificationDeliveryLooksLikeError(d),
        skipped: s.includes('skipped') || s.includes('skip'),
    };
}
function shortNotificationOrderRef(orderId) {
    if (!orderId)
        return null;
    return orderId.length > 12 ? `${orderId.slice(0, 8)}…` : orderId;
}
/** Optional badge for inbox rows (kind is often enough). */
function staffNotificationSummaryLine(n) {
    return formatStaffNotificationKind(n.kind);
}
//# sourceMappingURL=notification.labels.js.map