import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Param } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayHereWebhookBodyDto } from '../../openapi/zod-dtos';
import { PaymentService } from './payment.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { Public, SupabaseAuthGuard, Roles, CurrentUser, RequestUser } from '../../auth';
import { Throttle } from '@nestjs/throttler';
import { PayHereWebhookSchema } from '@wrap-roll/contracts';

@Controller('payment')
@ApiTags('payment')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Throttle({ default: { limit: 5, ttl: 10000 } })
  @Post('hash')
  @ApiOperation({ summary: 'Generate PayHere checkout hash', description: 'Validates order ownership (IDOR) and amount, then returns an md5 hash for the PayHere checkout form.' })
  @ApiBody({ type: ProcessPaymentDto })
  generateHash(@Body() dto: ProcessPaymentDto, @CurrentUser() actor: RequestUser) {
    return this.paymentService.generatePaymentHashForOrder(
      actor,
      dto.orderId,
      dto.amount,
      dto.currency,
    );
  }

  @Post('abort/:orderId')
  @HttpCode(HttpStatus.OK)
  @Roles('CLIENT', 'ADMIN', 'CASHIER')
  @ApiOperation({
    summary: 'Abort pending online checkout',
    description:
      'Marks a just-created online order as failed/voided when checkout fails before payment authorization.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID to abort' })
  async abortCheckout(
    @Param('orderId') orderId: string,
    @CurrentUser() actor: RequestUser,
    @Body('reason') reason?: string,
  ) {
    return this.paymentService.abortCheckout(orderId, actor, reason);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayHere payment gateway webhook (public)', description: 'Validates md5sig, deduplicates via DB-backed idempotency key, and emits order.paid event on status_code=2.' })
  @ApiBody({ type: PayHereWebhookBodyDto })
  async processWebhook(@Body() body: unknown) {
    const parsedResult = PayHereWebhookSchema.safeParse(body);
    if (!parsedResult.success) {
      return { success: false, message: 'Invalid webhook payload' };
    }
    const parsed = parsedResult.data;
    return this.paymentService.processWebhook(parsed);
  }

  /**
   * ADMIN-001 — RESTRICTED: Trigger manual reconciliation against PayHere Inquiry API
   */
  @Post('reconcile/:orderId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manual payment reconciliation (ADMIN, sandbox only)', description: 'Triggers a reconciliation via PayHere inquiry API. Requires ALLOW_INSECURE_RECONCILE_MOCK=true in non-production.' })
  @ApiParam({ name: 'orderId', description: 'Order UUID to reconcile' })
  async reconcile(@Param('orderId') orderId: string, @CurrentUser() actor: RequestUser) {
    return this.paymentService.reconcilePayment(orderId, actor);
  }
}
