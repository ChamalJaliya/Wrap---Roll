import { Injectable, Logger } from '@nestjs/common';
import { parseCashTenderFromAuditNote } from '@wrap-roll/order-kit';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailPlainText,
  type InvoiceEmailInput,
} from './invoice-email-html';
import { resolveReceiptLetterhead } from '../../common/receipt-letterhead';

function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf('@');
  if (at <= 1) return '***';
  return `${e[0]}***${e.slice(at)}`;
}

export type SendReceiptEmailManualResult = {
  ok: boolean;
  status:
    | 'sent'
    | 'skipped_no_resend'
    | 'skipped_no_email'
    | 'skipped_wrong_source'
    | 'already_sent'
    | 'not_found'
    | 'failed';
  message?: string;
};

@Injectable()
export class InvoiceEmailService {
  private readonly logger = new Logger(InvoiceEmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sends HTML receipt to the linked customer email when the order is from web/mobile,
   * payment notification fired, and `RESEND_API_KEY` is set. No-op otherwise.
   */
  async trySendPaidOrderInvoice(orderId: string): Promise<void> {
    await this.deliverInvoiceEmail(orderId, {
      requireClientSource: true,
      force: false,
    });
  }

  /**
   * Staff-triggered send (cashier/admin). Allows non-storefront orders; optional `force`
   * bypasses the “already sent” dedupe row (still records a new delivery attempt).
   */
  async sendReceiptEmailManual(
    orderId: string,
    opts?: { force?: boolean },
  ): Promise<SendReceiptEmailManualResult> {
    return this.deliverInvoiceEmail(orderId, {
      requireClientSource: false,
      force: Boolean(opts?.force),
    });
  }

  private async deliverInvoiceEmail(
    orderId: string,
    opts: { requireClientSource: boolean; force: boolean },
  ): Promise<SendReceiptEmailManualResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        status: 'skipped_no_resend',
        message: 'RESEND_API_KEY is not set',
      };
    }

    if (!opts.force) {
      const alreadySent = await this.prisma.notificationDelivery.findFirst({
        where: {
          orderId,
          channel: 'email',
          templateKey: 'order.invoice_email',
          status: 'sent',
        },
        select: { id: true },
      });
      if (alreadySent) {
        return {
          ok: false,
          status: 'already_sent',
          message: 'Receipt email was already sent for this order',
        };
      }
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: { select: { email: true } },
      },
    });
    if (!order) {
      return { ok: false, status: 'not_found', message: 'Order not found' };
    }

    if (
      opts.requireClientSource &&
      order.source !== 'client_web' &&
      order.source !== 'client_mobile'
    ) {
      return {
        ok: false,
        status: 'skipped_wrong_source',
        message: 'Automatic invoice email applies to storefront orders only',
      };
    }

    const to = order.customer?.email?.trim();
    if (!to) {
      this.logger.debug(`Invoice email skipped for ${orderId}: no customer email`);
      await this.recordDelivery(orderId, null, 'skipped_no_email', 'order.invoice_email');
      return {
        ok: false,
        status: 'skipped_no_email',
        message: 'No email on the linked customer record',
      };
    }

    let cashReceivedLkr: number | undefined;
    let changeReturnedLkr: number | undefined;
    const events = await this.prisma.paymentEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    for (const e of events) {
      if (String(e.eventType) !== 'cash_collected') continue;
      const parsed = parseCashTenderFromAuditNote(e.note);
      if (parsed) {
        cashReceivedLkr = parsed.tenderLkr;
        changeReturnedLkr = parsed.changeLkr;
        break;
      }
    }

    const settings = await this.prisma.businessSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        businessName: true,
        contactPhone: true,
        addressLine1: true,
        addressLine2: true,
        contactEmail: true,
      },
    });
    const letterhead = resolveReceiptLetterhead(settings);

    const input: InvoiceEmailInput = {
      id: order.id,
      placedAt: order.placedAt,
      customerName: order.customerName ?? null,
      customerPhone: order.customerPhone ?? null,
      fulfillmentType: order.fulfillmentType,
      tableNumber: order.tableNumber ?? null,
      deliveryAddress: order.deliveryAddress ?? null,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      tax: Number(order.tax),
      deliveryFee: Number(order.deliveryFee ?? 0),
      total: Number(order.total),
      ...(cashReceivedLkr !== undefined && changeReturnedLkr !== undefined
        ? { cashReceivedLkr, changeReturnedLkr }
        : {}),
      items: order.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        lineTotal: Number(it.lineTotal),
      })),
    };

    const shortId = order.id.slice(0, 8).toUpperCase();
    const subject = `Receipt #${shortId} · ${letterhead.businessName}`;
    const html = buildInvoiceEmailHtml(input, letterhead);
    const text = buildInvoiceEmailPlainText(input, letterhead);

    try {
      await this.sendResend({ to, subject, html, text });
      await this.recordDelivery(orderId, to, 'sent', 'order.invoice_email');
      this.logger.log(`Invoice email sent for order ${orderId} to ${maskEmail(to)}`);
      return { ok: true, status: 'sent' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Invoice email failed for ${orderId}: ${msg}`);
      await this.recordDelivery(orderId, to, 'failed', 'order.invoice_email', msg.slice(0, 2000));
      return { ok: false, status: 'failed', message: msg.slice(0, 500) };
    }
  }

  private async sendResend(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const key = process.env.RESEND_API_KEY!.trim();
    const from =
      process.env.INVOICE_EMAIL_FROM?.trim() || 'Wrap & Roll <onboarding@resend.dev>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 800)}`);
    }
  }

  private async recordDelivery(
    orderId: string,
    to: string | null,
    status: string,
    templateKey: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.notificationDelivery.create({
      data: {
        channel: 'email',
        orderId,
        templateKey,
        toMasked: to ? maskEmail(to) : null,
        bodyPreview: 'Invoice / receipt email',
        status,
        error: error ?? null,
        metadataJson: { kind: 'order_invoice' },
      },
    });
  }
}
