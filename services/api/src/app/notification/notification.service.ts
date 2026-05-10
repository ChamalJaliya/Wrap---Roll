import { Injectable, Logger, Inject } from '@nestjs/common';
import type { OutboxRelayJobPayload } from '@wrap-roll/contracts';
import { SmsProvider } from './providers/sms.provider';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_JOB,
  type NotificationJobName,
} from './notification.constants';
import { InvoiceEmailService } from './invoice-email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject('SMS_PROVIDER') private readonly smsProvider: SmsProvider,
    private readonly prisma: PrismaService,
    private readonly invoiceEmailService: InvoiceEmailService,
  ) {}

  async processQueueJob(jobName: NotificationJobName, payload: OutboxRelayJobPayload, attemptsMade = 0) {
    const embeddedOrderId =
      payload.payload && typeof payload.payload === 'object'
        ? String((payload.payload as { orderId?: string }).orderId ?? '')
        : '';
    const orderId = String(payload.entityId ?? '').trim() || embeddedOrderId;
    if (!orderId) return;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        customerPhone: true,
      },
    });
    if (!order) {
      this.logger.warn(`Skipping notification job ${jobName}; order ${orderId} not found`);
      return;
    }
    const eventPayload = {
      ...order,
      correlationId: payload.correlationId ?? null,
      retryAttempt: attemptsMade,
    };
    switch (jobName) {
      case NOTIFICATION_JOB.orderPaid:
        await this.processNotification(
          eventPayload,
          'Your order is confirmed! It’s moving to the kitchen now. 🌯',
          'order.paid_sms',
        );
        void this.invoiceEmailService.trySendPaidOrderInvoice(orderId);
        return;
      case NOTIFICATION_JOB.orderReady:
        await this.processNotification(
          eventPayload,
          'Your delicious wrap is ready for pickup! Come and get it. 🔥',
          'order.ready_sms',
        );
        return;
      case NOTIFICATION_JOB.orderInTransit:
        await this.processNotification(
          eventPayload,
          'Good news! Your order is on its way with our courier. 🛵',
          'order.in_transit_sms',
        );
        return;
      default: {
        const _never: never = jobName;
        this.logger.warn(`Unhandled notification job: ${String(_never)}`);
      }
    }
  }

  private maskPhone(phone: string): string {
    const d = String(phone).replace(/\D/g, '');
    if (d.length < 4) return '****';
    return `***${d.slice(-4)}`;
  }

  private async processNotification(order: any, message: string, templateKey: string) {
    const orderId = String(order.id ?? order.orderId ?? '') || null;
    try {
      const phone = await this.getCustomerPhone(order);
      if (!phone) {
        this.logger.warn(`Skipping SMS for order ${orderId}: No customer phone found.`);
        await this.prisma.notificationDelivery.create({
          data: {
            channel: 'sms',
            orderId,
            templateKey,
            toMasked: null,
            bodyPreview: message.slice(0, 240),
            status: 'skipped_no_phone',
            metadataJson: { reason: 'no_phone' },
          },
        });
        return;
      }

      await this.smsProvider.send(phone, message);
      await this.prisma.notificationDelivery.create({
        data: {
          channel: 'sms',
          orderId,
          templateKey,
          toMasked: this.maskPhone(phone),
          bodyPreview: message.slice(0, 240),
          status: 'sent',
          metadataJson: {},
        },
      });
      this.logger.log(`SMS sent for order ${orderId}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.prisma.notificationDelivery.create({
        data: {
          channel: 'sms',
          orderId,
          templateKey,
          toMasked: null,
          bodyPreview: message.slice(0, 240),
          status: 'failed',
          error: errMsg.slice(0, 2000),
          metadataJson: {},
        },
      });
      await this.prisma.opsActivityEvent.create({
        data: {
          app: 'system',
          entityType: 'order',
          entityId: orderId ?? 'unknown',
          eventType: 'notification.async_handler_failed',
          summary: 'Order notification send failed',
          metadataJson: {
            handler: 'notification.processNotification',
            retryAttempt: Number((order as Record<string, unknown>).retryAttempt ?? 0),
            deadLettered: Number((order as Record<string, unknown>).retryAttempt ?? 0) >= 3,
            correlationId:
              (order as Record<string, unknown>).correlationId == null
                ? null
                : String((order as Record<string, unknown>).correlationId),
            error: errMsg,
          },
        },
      });
      this.logger.error(`Failed to send notification for order ${orderId}: ${errMsg}`);
    }
  }

  private async getCustomerPhone(order: any): Promise<string | null> {
    // 1. Check if phone is directly on order record (denormalized)
    if (order.customerPhone) return order.customerPhone;

    // 2. Fallback to related customer record if customerId exists
    if (order.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { phone: true }
      });
      return customer?.phone || null;
    }

    return null;
  }
}
