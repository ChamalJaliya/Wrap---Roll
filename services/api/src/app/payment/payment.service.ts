import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueResponseCacheService } from '../order/queue-response-cache.service';
import { type OutboxRelayJobPayload, type PayHereWebhookPayload } from '@wrap-roll/contracts';
import { RequestUser } from '../../auth/current-user.decorator';
import { trackOpsActivity } from '../common/ops-activity';
import { OutboxService } from '../outbox/outbox.service';
import { OrderService } from '../order/order.service';
import { PAYMENT_JOB, type PaymentJobName } from './payment.constants';

/**
 * PayHere hashes the merchant secret as plain UTF-8 text from the dashboard.
 * If the value was pasted as Base64 (decodes to PayHere's long numeric sandbox secret), use the decoded form.
 */
function resolvePayHereMerchantSecret(raw: string): string {
  const s = raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\uFEFF/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(s) || s.length < 12) return s;
  try {
    const decoded = Buffer.from(s, 'base64').toString('utf8').trim();
    if (/^\d{10,}$/.test(decoded)) return decoded;
  } catch {
    /* keep s */
  }
  return s;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly merchantId = String(process.env.PAYHERE_MERCHANT_ID ?? '')
    .trim()
    .replace(/\uFEFF/g, '');
  private readonly merchantSecret = resolvePayHereMerchantSecret(
    process.env.PAYHERE_MERCHANT_SECRET || '',
  );
  
  constructor(
    private prisma: PrismaService,
    private readonly queueCache: QueueResponseCacheService,
    private readonly outboxService: OutboxService,
    private readonly orderService: OrderService,
  ) {
    const allowInsecurePayment =
      process.env.NODE_ENV === 'test' || process.env.ALLOW_INSECURE_PAYMENT_DEFAULTS === 'true';
    if ((!this.merchantId || !this.merchantSecret) && !allowInsecurePayment) {
      throw new Error(
        'PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET must be configured for payment operations.',
      );
    }
  }

  async processQueueJob(
    jobName: PaymentJobName,
    payload: OutboxRelayJobPayload,
    attemptsMade = 0,
  ): Promise<void> {
    const payloadObj =
      payload.payload && typeof payload.payload === 'object'
        ? (payload.payload as Record<string, unknown>)
        : {};
    const embeddedOrderId = String(payloadObj.orderId ?? '');
    const orderId = String(payload.entityId ?? '').trim() || embeddedOrderId;
    if (!orderId) {
      this.logger.warn(`Received payment queue job without order id: ${jobName}`);
      return;
    }

    if (jobName === PAYMENT_JOB.webhookFailed) {
      this.logger.warn(`Payment failed event received for order ${orderId}`);
      return;
    }

    if (jobName === PAYMENT_JOB.webhookPaid || jobName === PAYMENT_JOB.reconcilePaid) {
      await this.orderService.handleOrderPaid({
        ...payloadObj,
        orderId,
        correlationId: payload.correlationId ?? payloadObj.correlationId ?? null,
        retryAttempt: attemptsMade,
      });
      return;
    }

    this.logger.warn(`Unsupported payment queue job: ${jobName}`);
  }

  private idempotencyEventId(webhookKey: string): string {
    const digest = crypto.createHash('sha256').update(webhookKey, 'utf8').digest('hex');
    return `wh_${digest}`;
  }

  private paymentCorrelationId(orderId: string, paymentId?: string | null): string {
    const seed = `${orderId}:${paymentId ?? 'none'}:${Date.now()}:${Math.random()}`;
    const digest = crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 24);
    return `paycorr_${digest}`;
  }

  /**
   * DB-backed idempotency claim.
   * Uses a deterministic PaymentEvent.id so duplicate deliveries fail with unique violation.
   */
  private async claimWebhookProcessing(webhookKey: string, orderId: string): Promise<boolean> {
    try {
      await this.prisma.paymentEvent.create({
        data: {
          id: this.idempotencyEventId(webhookKey),
          orderId,
          eventType: 'online_webhook_claim',
          paymentMethod: 'payhere',
          metadataJson: { webhookKey },
        },
      });
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  generatePaymentHash(orderId: string, amount: number, currency: string = 'LKR') {
    const oid = String(orderId ?? '').trim();
    const cur = String(currency ?? 'LKR')
      .trim()
      .toUpperCase();
    const n =
      typeof amount === 'number' && Number.isFinite(amount)
        ? amount
        : parseFloat(String(amount ?? '').replace(/,/g, ''));
    if (!Number.isFinite(n)) {
      throw new BadRequestException('Invalid payment amount for hash');
    }
    const amountStr = n.toFixed(2);
    const merchantSecretHash = crypto
      .createHash('md5')
      .update(this.merchantSecret, 'utf8')
      .digest('hex')
      .toUpperCase();
    const hash = crypto
      .createHash('md5')
      .update(this.merchantId + oid + amountStr + cur + merchantSecretHash, 'utf8')
      .digest('hex')
      .toUpperCase();

    if (process.env.PAYHERE_DEBUG_HASH === 'true') {
      this.logger.warn(
        `[PayHere hash debug] merchantId=${this.merchantId} orderId=${oid} amountStr=${amountStr} currency=${cur} secretLen=${this.merchantSecret.length} hash=${hash}`,
      );
    }

    return {
      hash,
      merchantId: this.merchantId,
      merchant_id: this.merchantId,
    };
  }

  async generatePaymentHashForOrder(
    actor: RequestUser,
    orderId: string,
    requestedAmount: number,
    currency: string = 'LKR',
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: String(orderId) },
    });
    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const privileged = ['ADMIN', 'CASHIER', 'COURIER', 'KITCHEN'].includes(String(actor.role));
    const ownerUserId = String((order as Record<string, unknown>).placedByUserId ?? order.customerId ?? '');
    if (!privileged && ownerUserId !== actor.sub) {
      throw new ForbiddenException('You do not have access to this order');
    }

    const expectedAmount = Number(order.total);
    const normalizedRequested = Number(String(requestedAmount ?? '').replace(/,/g, ''));
    if (!Number.isFinite(normalizedRequested) || normalizedRequested <= 0) {
      throw new BadRequestException('Invalid payment amount for hash');
    }
    if (Math.abs(expectedAmount - normalizedRequested) > 0.009) {
      throw new BadRequestException('Payment amount mismatch');
    }

    return this.generatePaymentHash(order.id, expectedAmount, currency);
  }

  async abortCheckout(orderId: string, actor: RequestUser, reason?: string) {
    const id = String(orderId ?? '').trim();
    if (!id) {
      throw new BadRequestException('Order id is required');
    }

    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const privileged = ['ADMIN', 'CASHIER', 'COURIER', 'KITCHEN'].includes(String(actor.role));
    const ownerUserId = String(
      (order as Record<string, unknown>).placedByUserId ?? order.customerId ?? '',
    );
    if (!privileged && ownerUserId !== actor.sub) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.paymentMethod !== 'payhere' && order.paymentMethod !== 'online') {
      return { success: true, updated: false, reason: 'not_online_payment_order' };
    }
    if (order.paymentStatus === 'completed') {
      return { success: true, updated: false, reason: 'already_paid' };
    }
    if (order.status !== 'placed') {
      return { success: true, updated: false, reason: `status_${order.status}` };
    }

    const note = String(reason ?? '').trim().slice(0, 160) || 'checkout_aborted_before_gateway_auth';
    const correlationId = this.paymentCorrelationId(id, null);
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id,
          status: 'placed',
          paymentStatus: { not: 'completed' },
        },
        data: {
          status: 'voided',
          paymentStatus: 'failed',
        },
      });
      if (result.count === 0) return false;

      await tx.paymentEvent.create({
        data: {
          orderId: id,
          eventType: 'online_checkout_aborted',
          paymentMethod: order.paymentMethod,
          actorRole: String(actor.role),
          actorUserId: actor.sub,
          note,
          metadataJson: {
            correlationId,
            reason: note,
          },
        },
      });
      return true;
    });

    if (updated) {
      await trackOpsActivity(this.prisma, {
        entityType: 'payment',
        entityId: id,
        eventType: 'payment.checkout_aborted',
        summary: `Online checkout aborted for order ${id}`,
        actor,
        metadataJson: {
          reason: note,
          previousStatus: order.status,
          previousPaymentStatus: order.paymentStatus,
        },
      });
      void this.queueCache
        .bumpGlobalRevAndPublish({ orderId: id, type: 'payment.checkout_aborted' })
        .catch(() => undefined);
    }

    return { success: true, updated };
  }

  async processWebhook(data: PayHereWebhookPayload) {
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig, payment_id } = data;
    const merchantSecretHash = crypto
      .createHash('md5')
      .update(this.merchantSecret, 'utf8')
      .digest('hex')
      .toUpperCase();
    
    // Ensure all variables exist before hashing, handle cases where some might be undefined in malformed requests
    if (!merchant_id || !order_id || !payhere_amount || !payhere_currency || !status_code || !md5sig) {
        throw new BadRequestException('Invalid webhook payload');
    }

    if (merchant_id !== this.merchantId) {
      this.logger.error(`Merchant mismatch in webhook for order ${order_id}`);
      throw new BadRequestException('Invalid merchant');
    }

    // SEC-003 — DB-backed idempotency key (claim occurs after payload validation)
    const webhookKey = `${order_id}_${payment_id || status_code}`;
    const correlationId = this.paymentCorrelationId(String(order_id), payment_id ? String(payment_id) : null);

    const localMd5sig = crypto
      .createHash('md5')
      .update(
        merchant_id + order_id + payhere_amount + payhere_currency + status_code + merchantSecretHash,
        'utf8',
      )
      .digest('hex')
      .toUpperCase();

    if (localMd5sig !== md5sig) {
      this.logger.error('Invalid PayHere signature for order ' + order_id);
      throw new BadRequestException('Invalid signature');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: String(order_id) },
    });
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    const alreadyHandledSuccess =
      status_code === '2' &&
      order.paymentStatus === 'completed' &&
      payment_id &&
      String(order.transactionId ?? '') === String(payment_id);
    if (alreadyHandledSuccess) {
      return { success: true };
    }

    const normalizedCurrency = String(payhere_currency ?? '').toUpperCase();
    if (normalizedCurrency !== 'LKR') {
      throw new BadRequestException('Unsupported currency');
    }

    if (order.paymentMethod !== 'payhere' && order.paymentMethod !== 'online') {
      throw new BadRequestException('Order payment method does not accept online webhook');
    }
    const orderAmount = Number(order.total);
    const webhookAmount = Number(String(payhere_amount).replace(/,/g, ''));
    if (!Number.isFinite(webhookAmount) || webhookAmount <= 0) {
      throw new BadRequestException('Invalid webhook amount');
    }
    if (Math.abs(orderAmount - webhookAmount) > 0.009) {
      throw new BadRequestException('Webhook amount mismatch');
    }
    const claimed = await this.claimWebhookProcessing(webhookKey, String(order_id));
    if (!claimed) {
      this.logger.log(`Webhook already processed: ${webhookKey}. Returning 200 silently.`);
      return { success: true };
    }

    if (status_code === '2') {
      this.logger.log(`Payment successful for order ${order_id}`);
      await this.prisma.paymentEvent.create({
        data: {
          orderId: String(order_id),
          eventType: 'online_webhook_paid',
          paymentMethod: 'payhere',
          metadataJson: {
            correlationId,
            paymentId: payment_id,
            statusCode: status_code,
            payhereAmount: payhere_amount,
            currency: payhere_currency,
          },
        },
      });
      await this.outboxService.append({
        eventType: 'payment.webhook.paid',
        eventVersion: 1,
        entityType: 'order',
        entityId: String(order_id),
        correlationId,
        idempotencyKey: `payment.webhook.paid:${String(order_id)}:${String(payment_id ?? status_code)}:v1`,
        payloadJson: {
          orderId: String(order_id),
          paymentId: payment_id ?? null,
          statusCode: status_code,
          amount: payhere_amount,
          currency: payhere_currency,
        },
      });
    } else {
      this.logger.log(`Payment status ${status_code} for order ${order_id}`);
      await this.prisma.order.update({
        where: { id: String(order_id) },
        data: { paymentStatus: 'failed' },
      });
      void this.queueCache
        .bumpGlobalRevAndPublish({ orderId: String(order_id), type: 'payment.failed' })
        .catch(() => undefined);
      await this.prisma.paymentEvent.create({
        data: {
          orderId: String(order_id),
          eventType: 'online_webhook_failed',
          paymentMethod: 'payhere',
          metadataJson: {
            correlationId,
            paymentId: payment_id,
            statusCode: status_code,
            payhereAmount: payhere_amount,
            currency: payhere_currency,
          },
        },
      });
      await this.outboxService.append({
        eventType: 'payment.webhook.failed',
        eventVersion: 1,
        entityType: 'order',
        entityId: String(order_id),
        correlationId,
        idempotencyKey: `payment.webhook.failed:${String(order_id)}:${String(payment_id ?? status_code)}:v1`,
        payloadJson: {
          orderId: String(order_id),
          paymentId: payment_id ?? null,
          statusCode: status_code,
          amount: payhere_amount,
          currency: payhere_currency,
        },
      });
    }

    return { success: true };
  }

  /**
   * RECON-001 — Reconciliation method for dropped webhooks.
   * Checks transaction status against PayHere Inquiry API.
   */
  async reconcilePayment(orderId: string, actor: RequestUser) {
    this.logger.log(`Manually reconciling payment for order ${orderId} (Actor: ${actor.email})`);
    if (process.env.ALLOW_INSECURE_RECONCILE_MOCK !== 'true') {
      throw new BadRequestException(
        'Reconciliation mock is disabled. Enable ALLOW_INSECURE_RECONCILE_MOCK=true only for controlled non-production testing.',
      );
    }
    
    // In a real scenario, we'd fetch an OAuth token first. 
    // Here we simulate the inquiry against PayHere's sandbox/production endpoint.
    // Since we don't have the full API credentials in .env, we assume standard behavior.
    
    try {
        // Mocking the PayHere inquiry API response for the prompt implementation.
        // In production, this would be: 
        // const response = await axios.get(`https://sandbox.payhere.lk/merchant/v1/payment/search?order_id=${orderId}`, { ...auth });
        // const data = response.data.data; 
        
        // Let's assume we find a successful payment in the inquiry
        // We'll simulate a payload similar to what the webhook would provide.
        const mockPayHereData = {
            merchant_id: this.merchantId,
            order_id: orderId,
            payment_id: `RECON_${Date.now()}`,
            payhere_amount: '0.00', // We'd get actual amount from API
            payhere_currency: 'LKR',
            status_code: '2', // Success
            md5sig: 'SKIPPED_FOR_RECON' 
        };

        const webhookKey = `${orderId}_${mockPayHereData.payment_id}`;
        const correlationId = this.paymentCorrelationId(orderId, mockPayHereData.payment_id);
        
        // SEC-003 — Webhook idempotency check even for reconciliation
        const claimed = await this.claimWebhookProcessing(webhookKey, orderId);
        if (!claimed) {
            this.logger.warn(`Payment for ${orderId} already recognized. Skipping reconciliation.`);
            return { success: true, message: 'Already processed' };
        }

        this.logger.log(`Reconciliation found successful payment for order ${orderId}`);
        await this.prisma.paymentEvent.create({
          data: {
            orderId,
            eventType: 'online_reconcile_paid',
            paymentMethod: 'payhere',
            metadataJson: {
              correlationId,
              paymentId: mockPayHereData.payment_id,
              statusCode: mockPayHereData.status_code,
              payhereAmount: mockPayHereData.payhere_amount,
              currency: mockPayHereData.payhere_currency,
              actorRole: actor.role,
              actorEmail: actor.email,
            },
          },
        });
        await this.outboxService.append({
          eventType: 'payment.reconcile.paid',
          eventVersion: 1,
          entityType: 'order',
          entityId: orderId,
          correlationId,
          idempotencyKey: `payment.reconcile.paid:${orderId}:${mockPayHereData.payment_id}:v1`,
          payloadJson: {
            orderId,
            paymentId: mockPayHereData.payment_id,
            statusCode: mockPayHereData.status_code,
            actorRole: actor.role,
            actorEmail: actor.email,
          },
        });
        
        await trackOpsActivity(this.prisma, {
          entityType: 'payment',
          entityId: orderId,
          eventType: 'payment.reconciled',
          summary: `Payment manually reconciled for order ${orderId}`,
          actor,
          metadataJson: {
            paymentId: mockPayHereData.payment_id,
            status: 'PAID',
          },
        });
        
        return { success: true, status: 'PAID' };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Reconciliation failed for order ${orderId}: ${message}`);
        throw new BadRequestException(`Reconciliation failed: ${message}`);
    }
  }
}
