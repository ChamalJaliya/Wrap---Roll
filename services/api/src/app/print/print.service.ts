import { Injectable, Logger } from '@nestjs/common';
import type { OrderItem, Order } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EscPos } = require('escpos-xml');
import { formatPaymentStatusDisplayLabel } from '@wrap-roll/contracts';
import {
  getOrderItemModifierDisplayLines,
  parseCashTenderFromAuditNote,
  type ParsedCashTenderAudit,
} from '@wrap-roll/order-kit';
import { PrismaService } from '../prisma/prisma.service';
import { resolveReceiptLetterhead } from '../../common/receipt-letterhead';
import { CASHIER_RECEIPT_TEMPLATE, KITCHEN_TICKET_TEMPLATE } from './print.templates';
import { PRINT_JOB, type PrintJobName } from './print.constants';

type OrderWithItems = Order & { items: OrderItem[] };

/** ESC/POS XML template expects escaped &, &lt;, &gt; in dynamic text */
function escPosXmlText(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);

  constructor(private readonly prisma: PrismaService) {}
  
  // Store base64-encoded ESC/POS payloads in memory for frontend polling/retrieval
  private cashierReceipts = new Map<string, string>();
  private kitchenTickets = new Map<string, string>();

  /**
   * ESC/POS standard control codes for 80mm thermal printers.
   * GS V m n (m=66: Feed n lines and execute full cut)
   */
  private readonly FEED_AND_CUT = [0x1d, 0x56, 0x42, 0x03];

  async processQueueJob(
    jobName: PrintJobName,
    payload: { entityId?: string; correlationId?: string | null } | { orderId?: string; correlationId?: string | null },
    attemptsMade = 0,
  ): Promise<void> {
    const orderId = String((payload as { orderId?: string }).orderId ?? (payload as { entityId?: string }).entityId ?? '');
    if (!orderId) return;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;

    if (jobName === PRINT_JOB.cashierReceipt) {
      try {
        const base64 = await this.buildCashierReceiptFromRow(order);
        this.cashierReceipts.set(orderId, base64);
      } catch (error: unknown) {
        await this.logAsyncFailure({
          orderId,
          handler: 'print.processQueueJob.cashierReceipt',
          retryAttempt: attemptsMade,
          correlationId: payload.correlationId ?? null,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (jobName === PRINT_JOB.kitchenTicket) {
      try {
        const base64 = this.buildKitchenTicketFromRow(order);
        this.kitchenTickets.set(orderId, base64);
      } catch (error: unknown) {
        await this.logAsyncFailure({
          orderId,
          handler: 'print.processQueueJob.kitchenTicket',
          retryAttempt: attemptsMade,
          correlationId: payload.correlationId ?? null,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (jobName === PRINT_JOB.orderReadyNote) {
      this.logger.log(`Order ${orderId} is ready for pickup/delivery`);
      return;
    }
  }

  getReceipt(orderId: string): string | null {
    return this.cashierReceipts.get(orderId) || null;
  }

  getKitchenTicket(orderId: string): string | null {
    return this.kitchenTickets.get(orderId) || null;
  }

  /**
   * Build ESC/POS cashier receipt from persisted order rows (survives API restarts).
   */
  async regenerateCashierReceiptBase64(orderId: string): Promise<string | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return null;
    try {
      return await this.buildCashierReceiptFromRow(order);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Receipt regeneration failed for ${orderId}: ${msg}`);
      return null;
    }
  }

  private async buildCashierReceiptFromRow(order: OrderWithItems): Promise<string> {
    const events = await this.prisma.paymentEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    let cashTender: ParsedCashTenderAudit | null = null;
    for (const e of events) {
      if (String(e.eventType) !== 'cash_collected') continue;
      const parsed = parseCashTenderFromAuditNote(e.note);
      if (parsed) {
        cashTender = parsed;
        break;
      }
    }
    const data = await this.orderToReceiptTemplateData(order, cashTender);
    const bufferArray = EscPos.getBufferFromTemplate(CASHIER_RECEIPT_TEMPLATE, data);
    const finalPayload = Buffer.concat([
      Buffer.from(bufferArray),
      Buffer.from(this.FEED_AND_CUT),
    ]);
    return finalPayload.toString('base64');
  }

  private buildKitchenTicketFromRow(order: OrderWithItems): string {
    const data = {
      orderId: order.id,
      placedAt: new Date(order.placedAt).toLocaleString('en-US', { hour12: true }),
      shortOrderId: order.id.substring(order.id.length - 4).toUpperCase(),
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        modifiers: {
          lines: getOrderItemModifierDisplayLines(item.modifiersJson).map(
            (l) => `${l.label}: ${l.value}`,
          ),
        },
      })),
    };
    const bufferArray = EscPos.getBufferFromTemplate(KITCHEN_TICKET_TEMPLATE, data);
    const finalPayload = Buffer.concat([
      Buffer.from(bufferArray),
      Buffer.from(this.FEED_AND_CUT),
    ]);
    return finalPayload.toString('base64');
  }

  private async logAsyncFailure(args: {
    orderId: string;
    handler: string;
    retryAttempt: number;
    correlationId?: string | null;
    message: string;
  }): Promise<void> {
    await this.prisma.opsActivityEvent.create({
      data: {
        app: 'system',
        entityType: 'order',
        entityId: args.orderId,
        eventType: 'print.async_handler_failed',
        summary: 'Print generation failed',
        metadataJson: {
          handler: args.handler,
          retryAttempt: args.retryAttempt,
          deadLettered: args.retryAttempt >= 3,
          correlationId: args.correlationId ?? null,
          error: args.message,
        },
      },
    });
    this.logger.error(`Print handler failed for ${args.orderId}: ${args.message}`);
  }

  private formatPaymentMethodCustomer(order: OrderWithItems): string {
    const m = String(order.paymentMethod ?? '').toLowerCase();
    if (m === 'cash') return 'Cash';
    if (m === 'card') return 'Card';
    return String(order.paymentMethod ?? '—').replace(/_/g, ' ');
  }

  private formatFulfillmentCustomer(order: OrderWithItems): string {
    const ft = String(order.fulfillmentType ?? '').toLowerCase();
    if (ft === 'takeaway') return 'Takeaway';
    if (ft === 'dine_in') {
      const t = order.tableNumber?.trim();
      return t ? `Dine in · Table ${t}` : 'Dine in';
    }
    if (ft === 'delivery') return 'Delivery';
    return String(order.fulfillmentType ?? '').replace(/_/g, ' ') || '—';
  }

  private async orderToReceiptTemplateData(
    order: OrderWithItems,
    cashTender: ParsedCashTenderAudit | null,
  ) {
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
    const lh = resolveReceiptLetterhead(settings);
    const placedAt = new Date(order.placedAt).toLocaleString('en-US', { hour12: true });
    const shortOrderId = order.id.substring(order.id.length - 4).toUpperCase();
    const subtotal = Number(order.subtotal);
    const discountAmount = Number(order.discountAmount);
    const tax = Number(order.tax);
    const deliveryFee = Number(order.deliveryFee ?? 0);
    return {
      letterhead: {
        title: escPosXmlText(lh.businessName),
        lines: lh.lines.map((line) => escPosXmlText(line)),
      },
      orderId: order.id,
      placedAt,
      shortOrderId,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        modifiers: {
          lines: getOrderItemModifierDisplayLines(item.modifiersJson).map(
            (l) => `${l.label}: ${l.value}`,
          ),
        },
      })),
      pricing: {
        subtotal,
        discountAmount,
        tax,
        deliveryFee,
        total: Number(order.total),
        showDiscount: discountAmount > 0.005,
        showDelivery: deliveryFee > 0.005,
        showTax: tax > 0.005,
      },
      payment: {
        method: order.paymentMethod,
        status: order.paymentStatus,
        showCashTender: Boolean(cashTender),
        cashReceived: cashTender ? cashTender.tenderLkr.toFixed(2) : '',
        changeGiven: cashTender ? cashTender.changeLkr.toFixed(2) : '',
        summaryLine: `${this.formatPaymentMethodCustomer(order)} · ${formatPaymentStatusDisplayLabel(order.paymentStatus)}`,
      },
      fulfillment: {
        type: order.fulfillmentType,
        summaryLine: this.formatFulfillmentCustomer(order),
        tableNumber: order.tableNumber ?? undefined,
        deliveryAddress: order.deliveryAddress ?? undefined,
      },
      kitchen: {
        priority: order.kitchenPriority,
      },
      source: order.source,
    };
  }
}
