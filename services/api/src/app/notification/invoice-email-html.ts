import { formatPaymentStatusDisplayLabel } from '@wrap-roll/contracts';
import {
  getFallbackReceiptLetterhead,
  type ReceiptLetterhead,
} from '../../common/receipt-letterhead';

export type InvoiceEmailLineItem = {
  name: string;
  quantity: number;
  lineTotal: number;
};

/** Minimal order shape for HTML invoice (email-safe inline styles). */
export type InvoiceEmailInput = {
  id: string;
  placedAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  fulfillmentType: string;
  tableNumber: string | null;
  deliveryAddress: string | null;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discountAmount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  cashReceivedLkr?: number | null;
  changeReturnedLkr?: number | null;
  items: InvoiceEmailLineItem[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return n.toFixed(2);
}

function methodLabel(m: string): string {
  const x = String(m ?? '').toLowerCase();
  if (x === 'cash') return 'Cash';
  if (x === 'card') return 'Card';
  if (x === 'payhere') return 'PayHere';
  if (x === 'online') return 'Online';
  return esc(String(m ?? '—').replace(/_/g, ' '));
}

function fulfillmentLabel(ft: string, table: string | null): string {
  const x = String(ft ?? '').toLowerCase();
  if (x === 'takeaway') return 'Takeaway';
  if (x === 'dine_in') return table?.trim() ? `Dine in · Table ${esc(table.trim())}` : 'Dine in';
  if (x === 'delivery') return 'Delivery';
  return esc(String(ft ?? '').replace(/_/g, ' ') || '—');
}

/**
 * Compact, email-client-safe HTML receipt (inline CSS only).
 * Pass `letterhead` from `resolveReceiptLetterhead(BusinessSettings)`; falls back if omitted.
 */
export function buildInvoiceEmailHtml(
  o: InvoiceEmailInput,
  letterhead?: ReceiptLetterhead,
): string {
  const lh = letterhead ?? getFallbackReceiptLetterhead();
  const letterheadSubLines = lh.lines
    .map(
      (line) =>
        `<p style="margin:5px 0 0;font-size:13px;color:#64748b;line-height:1.5;">${esc(line)}</p>`,
    )
    .join('');
  const shortId = String(o.id).slice(0, 8).toUpperCase();
  const placed = o.placedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const payLine = `${methodLabel(o.paymentMethod)} · ${formatPaymentStatusDisplayLabel(o.paymentStatus)}`;
  const service = fulfillmentLabel(o.fulfillmentType, o.tableNumber);
  const disc = o.discountAmount > 0.005;
  const taxShow = o.tax > 0.005;
  const delShow = o.deliveryFee > 0.005;
  const cr = o.cashReceivedLkr;
  const ch = o.changeReturnedLkr;
  const tender =
    cr != null &&
    ch != null &&
    Number.isFinite(Number(cr)) &&
    Number.isFinite(Number(ch));

  const totalHeading =
    String(o.paymentStatus ?? '').toLowerCase() === 'completed' ? 'Total paid' : 'Amount due';

  const rows = o.items
    .map(
      (it) => `
  <tr>
    <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${esc(it.name)}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;text-align:center;width:48px;">×${it.quantity}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">Rs ${money(it.lineTotal)}</td>
  </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 40px -28px rgba(15,23,42,0.35);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#9a3412,#ea580c,#fb923c);"></td>
          </tr>
          <tr>
            <td style="padding:28px 24px 16px;text-align:center;border-bottom:1px solid #e2e8f0;background:linear-gradient(180deg,#ffffff 0%,#fffdfb 100%);">
              <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#c2410c;">Invoice / receipt</p>
              <h1 style="margin:10px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;line-height:1.15;">${esc(lh.businessName)}</h1>
              ${letterheadSubLines}
              <span style="display:inline-block;margin-top:16px;padding:6px 14px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;border:1px solid rgba(234,88,12,0.35);border-radius:999px;background:#fff7ed;">Official receipt</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 20px;">
              <table role="presentation" width="100%" style="background:#fffbeb;border:1px solid rgba(251,146,60,0.28);border-radius:12px;padding:14px 16px;">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;">Receipt no.</div>
                    <div style="font-size:17px;font-weight:800;color:#0f172a;margin-top:4px;">#${esc(shortId)}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:6px;line-height:1.4;">${service}</div>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;">Date</div>
                    <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:4px;max-width:180px;">${esc(placed)}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 8px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Customer</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${esc(o.customerName?.trim() || 'Guest')}</p>
              ${o.customerPhone ? `<p style="margin:6px 0 0;font-size:14px;color:#475569;">${esc(o.customerPhone)}</p>` : ''}
              ${
                String(o.fulfillmentType).toLowerCase() === 'delivery' && o.deliveryAddress?.trim()
                  ? `<p style="margin:14px 0 0;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Deliver to</p>
              <p style="margin:6px 0 0;font-size:13px;color:#0f172a;line-height:1.45;">${esc(o.deliveryAddress.trim())}</p>`
                  : ''
              }
              <p style="margin:18px 0 8px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Payment</p>
              <div style="display:inline-block;padding:10px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #ea580c;font-size:14px;font-weight:700;color:#0f172a;">${esc(payLine)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Items</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <thead>
                  <tr>
                    <th align="left" style="padding:8px;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Item</th>
                    <th style="padding:8px;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Qty</th>
                    <th align="right" style="padding:8px;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Amount</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px;">
              <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:6px 0;color:#64748b;">Subtotal</td><td align="right" style="padding:6px 0;font-weight:600;color:#0f172a;">Rs ${money(o.subtotal)}</td></tr>
                ${disc ? `<tr><td style="padding:6px 0;color:#64748b;">Discount</td><td align="right" style="padding:6px 0;font-weight:600;color:#c2410c;">−Rs ${money(o.discountAmount)}</td></tr>` : ''}
                ${taxShow ? `<tr><td style="padding:6px 0;color:#64748b;">Tax</td><td align="right" style="padding:6px 0;font-weight:600;color:#0f172a;">Rs ${money(o.tax)}</td></tr>` : ''}
                ${delShow ? `<tr><td style="padding:6px 0;color:#64748b;">Delivery</td><td align="right" style="padding:6px 0;font-weight:600;color:#0f172a;">Rs ${money(o.deliveryFee)}</td></tr>` : ''}
              </table>
              <table role="presentation" width="100%" style="margin-top:12px;border-radius:14px;background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" width="100%">
                      <tr>
                        <td style="font-size:12px;font-weight:700;color:rgba(248,250,252,0.88);">${esc(totalHeading)}</td>
                        <td align="right" style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;">Rs ${money(o.total)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${
                tender
                  ? `<table role="presentation" width="100%" style="margin-top:12px;border-radius:12px;background:#ecfdf5;border:1px solid rgba(16,185,129,0.22);">
                <tr><td style="padding:12px 14px;">
                  <div style="font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#047857;margin-bottom:8px;">Tender</div>
                  <table role="presentation" width="100%" style="font-size:13px;color:#065f46;">
                    <tr><td>Cash received</td><td align="right" style="font-weight:700;">Rs ${money(Number(cr))}</td></tr>
                    <tr><td style="padding-top:4px;">Change</td><td align="right" style="font-weight:700;padding-top:4px;">Rs ${money(Number(ch))}</td></tr>
                  </table>
                </td></tr>
              </table>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 26px;text-align:center;background:#0f172a;">
              <p style="margin:0 0 8px;font-size:15px;font-weight:800;background:linear-gradient(90deg,#fff,#cbd5e1);-webkit-background-clip:text;background-clip:text;color:transparent;">Thank you</p>
              <p style="margin:0;font-size:12px;color:rgba(226,232,240,0.7);line-height:1.5;">Your proof of purchase — we appreciate your order.</p>
              <p style="margin:14px 0 0;font-size:10px;font-family:Consolas,monospace;color:#94a3b8;word-break:break-all;">${esc(o.id)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInvoiceEmailPlainText(
  o: InvoiceEmailInput,
  letterhead?: ReceiptLetterhead,
): string {
  const lh = letterhead ?? getFallbackReceiptLetterhead();
  const shortId = String(o.id).slice(0, 8).toUpperCase();
  const lines = [
    lh.businessName,
    ...lh.lines,
    '',
    `Receipt #${shortId}`,
    `Date: ${o.placedAt.toISOString()}`,
    `Total: Rs ${money(o.total)}`,
    `Payment: ${methodLabel(o.paymentMethod)} · ${formatPaymentStatusDisplayLabel(o.paymentStatus)}`,
    '',
    ...o.items.map((it) => `${it.quantity}× ${it.name} — Rs ${money(it.lineTotal)}`),
  ];
  return lines.join('\n');
}
