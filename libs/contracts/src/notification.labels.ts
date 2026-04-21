/**
 * Single source of truth for Notifications admin UI (delivery audit + staff inbox).
 *
 * When the API adds a new `status`, `channel`, `templateKey`, or staff `kind`, add a row
 * to the matching map below for a polished label; otherwise formatters fall back to readable text.
 */

import type { NotificationDeliveryRow, StaffNotificationRow } from './order.api.contracts';

// ── SMS / delivery audit (`NotificationDeliveryRow`) ─────────────────────────

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
};

/** Logged delivery outcomes from the API (extend when new statuses appear). */
export const NOTIFICATION_DELIVERY_STATUS_LABELS: Record<string, string> = {
  sent: 'Sent',
  failed: 'Failed',
  skipped_no_phone: 'Skipped (no phone)',
  pending: 'Pending',
};

/** Optional pretty names for `templateKey` (e.g. order_sms_ready). */
export const NOTIFICATION_TEMPLATE_KEY_LABELS: Record<string, string> = {};

// ── Staff inbox (`StaffNotificationRow.kind`) ───────────────────────────────

export const STAFF_NOTIFICATION_KIND_LABELS: Record<string, string> = {
  info: 'Info',
  alert: 'Alert',
  system: 'System',
};

// ── Admin page copy (headings, empty states, buttons) ───────────────────────

export const NOTIFICATION_PAGE_COPY = {
  pageTitle: 'Notifications',
  pageDescription:
    'SMS delivery audit and your staff inbox. In-app messages show here when the API creates them.',
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
} as const;

export function notificationInboxSectionTitle(unreadCount: number): string {
  const base = NOTIFICATION_PAGE_COPY.inboxHeading;
  return unreadCount > 0 ? `${base} (${unreadCount} unread)` : base;
}

export function formatNotificationChannel(channel: string): string {
  return NOTIFICATION_CHANNEL_LABELS[channel] ?? channel.toUpperCase();
}

export function formatNotificationDeliveryStatus(status: string): string {
  return NOTIFICATION_DELIVERY_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function formatNotificationTemplateKey(templateKey: string | null | undefined): string {
  if (templateKey == null || templateKey === '') return '';
  if (NOTIFICATION_TEMPLATE_KEY_LABELS[templateKey]) {
    return NOTIFICATION_TEMPLATE_KEY_LABELS[templateKey];
  }
  return templateKey.replace(/_/g, ' ');
}

export function formatStaffNotificationKind(kind: string): string {
  return STAFF_NOTIFICATION_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

/** Parse `{ detail }` / `{ message }` from Nest or Next API proxy JSON bodies. */
export function parseNestProxyErrorDetail(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.detail === 'string' && d.detail.length > 0) return d.detail;
  if (typeof d.message === 'string') return d.message;
  if (Array.isArray(d.message) && d.message.every((x) => typeof x === 'string')) {
    return d.message.join(', ');
  }
  return undefined;
}

/**
 * User-facing API errors for the notifications admin page (proxy / Nest failures).
 * Pass `detail` from `parseNestProxyErrorDetail(err.response?.data)`.
 */
export function formatNotificationPageApiError(opts: {
  status?: number;
  detail?: string;
  context: 'deliveries' | 'inbox';
}): string {
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
    const base =
      'Could not reach the API (proxy timeout or backend down). Ensure the API is running on port 4000 and apps/admin/.env.local has API_PROXY_TARGET=http://127.0.0.1:4000/api';
    return detail ? `${base}. (${detail})` : base;
  }
  if (status === 500 && detail) {
    return `Server error: ${detail}`;
  }
  if (status) {
    return detail ? `Request failed (${status}): ${detail}` : `Request failed (${status}).`;
  }
  return detail ?? 'Network error.';
}

/** One-line summary under a delivery row (channel, template, order hint). */
export function formatNotificationDeliveryMetaLine(d: Pick<NotificationDeliveryRow, 'channel' | 'templateKey' | 'orderId'>): string {
  const parts: string[] = [];
  const ch = formatNotificationChannel(d.channel);
  const tk = formatNotificationTemplateKey(d.templateKey);
  if (tk) parts.push(tk);
  else parts.push(ch);
  if (d.orderId) {
    parts.push(`Order ${d.orderId.slice(0, 8)}…`);
  }
  return parts.join(' · ');
}

export function notificationDeliveryLooksLikeError(d: Pick<NotificationDeliveryRow, 'status' | 'error'>): boolean {
  if (d.error && String(d.error).trim().length > 0) return true;
  const s = String(d.status ?? '').toLowerCase();
  return s === 'failed' || s.includes('fail');
}

export function getNotificationDeliveryVisualHints(
  d: Pick<NotificationDeliveryRow, 'status' | 'error'>,
): { error: boolean; skipped: boolean } {
  const s = String(d.status ?? '').toLowerCase();
  return {
    error: notificationDeliveryLooksLikeError(d),
    skipped: s.includes('skipped') || s.includes('skip'),
  };
}

export function shortNotificationOrderRef(orderId: string | null | undefined): string | null {
  if (!orderId) return null;
  return orderId.length > 12 ? `${orderId.slice(0, 8)}…` : orderId;
}

/** Optional badge for inbox rows (kind is often enough). */
export function staffNotificationSummaryLine(n: Pick<StaffNotificationRow, 'kind'>): string {
  return formatStaffNotificationKind(n.kind);
}
