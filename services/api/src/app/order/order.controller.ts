import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
  Headers,
  Sse,
  MessageEvent,
  Req,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateOrderBodyDto,
  SupportOrderUpdateBodyDto,
  ReplaceOrderLineItemsBodyDto,
} from '../../openapi/zod-dtos';
import { OrderService } from './order.service';
import { InvoiceEmailService } from '../notification/invoice-email.service';
import { QueueResponseCacheService } from './queue-response-cache.service';
import { PrivateNoStoreVaryAuthInterceptor } from './private-no-store-vary-auth.interceptor';
import { SupabaseAuthGuard, Roles } from '../../auth';
import { Public } from '../../auth';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly queueCache: QueueResponseCacheService,
    private readonly invoiceEmailService: InvoiceEmailService,
  ) {}

  // INT-003 — Roles are now UPPERCASE
  @Throttle({ default: { limit: 5, ttl: 10000 } })
  @Post()
  @Roles('CLIENT', 'CASHIER')
  @ApiOperation({ summary: 'Place a new order', description: 'Validates against WrapOrderSchema. Rate-limited to 5 req/10s. Supports X-Idempotency-Key header.' })
  @ApiBody({
    type: CreateOrderBodyDto,
    description:
      'Canonical WrapOrder JSON. The storefront may send a legacy cart shape; the server normalizes it before Zod validation.',
  })
  async createOrder(
    @Body() body: unknown,
    @Headers('x-idempotency-key') idempotencyKey?: string,
    @Headers('x-supervisor-elevation') supervisorElevation?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.orderService.createOrder(body, idempotencyKey, user, supervisorElevation);
  }

  // API-001 — status moved from @Body to @Query
  @Get()
  @Roles('ADMIN', 'CASHIER', 'COURIER', 'KITCHEN')
  @ApiOperation({ summary: 'List orders', description: 'Filter by status and fulfillmentType. Staff roles only.' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status' })
  @ApiQuery({ name: 'fulfillmentType', required: false })
  @ApiQuery({ name: 'page', required: false, description: '1-based page (enables paginated response with limit)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (max 100; use with page)' })
  @ApiQuery({
    name: 'placedOn',
    required: false,
    description: 'Calendar day YYYY-MM-DD — filter orders whose placedAt falls on that local day (server TZ)',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    description: 'If `today`, restrict placedAt to the server\'s current calendar day (ignored when placedOn is set)',
    enum: ['today'],
  })
  async getOrders(
    @Query('status') status?: OrderStatus,
    @Query('fulfillmentType') fulfillmentType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('placedOn') placedOn?: string,
    @Query('scope') scope?: string,
  ) {
    const p = page !== undefined && page !== '' ? Number(page) : undefined;
    const l = limit !== undefined && limit !== '' ? Number(limit) : undefined;
    return this.orderService.getOrders(status, fulfillmentType, p, l, placedOn, scope);
  }

  /** Today’s orders (server TZ) for the admin home dashboard — always paginated; never returns an unbounded array. */
  @Get('admin/dashboard-list')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin dashboard order list',
    description:
      'Orders placed today in the API server timezone, newest first. Response is always `{ items, total, page, limit, hasMore }`.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAdminDashboardOrders(@Query('page') page?: string, @Query('limit') limit?: string) {
    const p = page !== undefined && page !== '' ? Number(page) : 1;
    const l = limit !== undefined && limit !== '' ? Number(limit) : 20;
    const safePage = Number.isFinite(p) && p > 0 ? p : 1;
    const safeLimit = Number.isFinite(l) && l > 0 ? l : 20;
    return this.orderService.getAdminDashboardOrdersPaginated(safePage, safeLimit);
  }

  @Get('queue')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Roles('ADMIN', 'CASHIER', 'COURIER', 'KITCHEN')
  @ApiOperation({ summary: 'Role-scoped operations queue', description: 'Returns QueueOrder[] with computed SLA, actions, and kitchenEligible fields. Response is projected per role (KITCHEN/COURIER see stripped responses). Cache-Control: no-store.' })
  async getQueue(
    @Query('status') status?: string,
    @Query('fulfillmentType') fulfillmentType?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.orderService.getQueue(
      status,
      fulfillmentType,
      user,
      date,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  /** Server-Sent Events: `queue:dirty` JSON payloads + heartbeat (see `QueueResponseCacheService`). */
  @Sse('queue/stream')
  @SkipThrottle()
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN', 'CASHIER', 'COURIER', 'KITCHEN')
  queueStream(@Req() req: Request): Observable<MessageEvent> {
    return this.queueCache.queueDirtyStream$(req);
  }

  @Get('reconciliation/summary')
  @Roles('ADMIN', 'CASHIER')
  @ApiOperation({ summary: 'Daily payment reconciliation summary' })
  @ApiQuery({ name: 'date', required: false, description: 'ISO date string (YYYY-MM-DD). Defaults to today.' })
  async getReconciliationSummary(@Query('date') date?: string) {
    return this.orderService.getReconciliationSummary(date);
  }

  /** POS cart: estimate VAT + delivery fee (same rules as order creation for delivery). */
  @Get('delivery-quote')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Roles('ADMIN', 'CASHIER')
  async getDeliveryQuote(
    @Query('address') address?: string,
    @Query('subtotal') subtotal?: string,
  ) {
    return this.orderService.quotePosDeliveryPreview({
      address: String(address ?? ''),
      subtotal: Number(subtotal ?? 0),
    });
  }

  @Get('support/search')
  @Roles('ADMIN', 'CASHIER')
  async searchForSupport(@Query('q') q: string) {
    return this.orderService.searchOrdersForSupport(q);
  }

  @Get('support/:id')
  @Roles('ADMIN', 'CASHIER')
  async getSupportOrderDetails(@Param('id') id: string) {
    return this.orderService.getSupportOrderDetails(id);
  }

  @Get(':id/payment-events')
  @Roles('ADMIN', 'CASHIER')
  async getPaymentEvents(@Param('id') id: string) {
    return this.orderService.getOrderPaymentEvents(id);
  }

  @Get('activity')
  @Roles('ADMIN', 'CASHIER')
  async getGlobalActivity(
    @Query('take') take?: string,
    @Query('entityType') entityType?: string,
    @Query('app') app?: string,
    @Query('actorRole') actorRole?: string,
    @Query('eventType') eventType?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.orderService.getGlobalActivityFeed(
      take ? Number(take) : undefined,
      entityType,
      app,
      actorRole,
      eventType,
      q,
      from,
      to,
    );
  }

  @Get(':id/activity')
  @Roles('ADMIN', 'CASHIER')
  async getOrderActivity(@Param('id') id: string) {
    return this.orderService.getOrderActivityEvents(id);
  }

  @Get('track/:id')
  @Public()
  @ApiOperation({ summary: 'Public order tracking (no auth)', description: 'Customer self-service tracking. Optionally validate caller via ?phone= query param.' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async trackOrder(
    @Param('id') id: string,
    @Query('phone') phone?: string,
  ) {
    return this.orderService.trackOrderForClient(id, phone);
  }

  // SEC-001 — IDOR protection: non-admin callers can only read their own orders
  @Get(':id')
  async getOrderById(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const order = await this.orderService.getOrderById(id);
    const privileged = ['ADMIN', 'CASHIER', 'COURIER', 'KITCHEN'].includes(
      user.role,
    );
    const ownerUserId = String((order as Record<string, unknown>).placedByUserId ?? order.customerId ?? '');
    if (!privileged && ownerUserId !== user.sub) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'CASHIER', 'KITCHEN', 'COURIER')
  @ApiOperation({ summary: 'Advance order status', description: 'Validates transition via built-in state machine. PRD-001: voiding/refunding in_kitchen orders requires ADMIN role.' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @CurrentUser() user: RequestUser,
    @Body('courierId') courierId?: string,
    @Body('replay') replay?: boolean,
  ) {
    const order = await this.orderService.getOrderById(id);

    // PRD-001 — Orders in in_kitchen or ready status require ADMIN role elevation to void/refund
    if (['voided', 'refunded'].includes(status)) {
      if (['in_kitchen', 'ready'].includes(order.status) && user.role !== 'ADMIN') {
        throw new ForbiddenException(
          `Only ADMIN can ${status} orders that are already ${order.status}`,
        );
      }
    }

    return this.orderService.updateOrderStatus(id, status, user, courierId, replay);
  }

  @Patch(':id/courier')
  @Roles('ADMIN', 'CASHIER', 'COURIER')
  async assignCourier(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('courierId') courierId: string,
  ) {
    const effectiveCourierId = user.role === 'COURIER' ? (courierId || user.sub) : courierId;
    return this.orderService.assignCourier(id, effectiveCourierId, user);
  }

  @Patch(':id/delivery-attempt')
  @Roles('ADMIN', 'CASHIER', 'COURIER')
  @ApiOperation({ summary: 'Record a delivery attempt event (failed/retry note)' })
  async recordDeliveryAttempt(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('result') result: 'failed' | 'note',
    @Body('reason') reason?: string,
  ) {
    return this.orderService.recordDeliveryAttempt(id, user, { result, reason });
  }

  @Patch(':id/handover')
  @Roles('ADMIN', 'CASHIER', 'COURIER')
  @ApiOperation({ summary: 'Handover in-transit delivery to next courier or release back to ready' })
  async handoverDelivery(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('nextCourierId') nextCourierId?: string,
    @Body('reason') reason?: string,
  ) {
    return this.orderService.handoverDelivery(id, user, { nextCourierId, reason });
  }

  @Patch(':id/mark-cash-received')
  @Roles('ADMIN', 'CASHIER', 'COURIER')
  async markCashReceived(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('note') note?: string,
  ) {
    // Backward compatibility alias. Prefer :id/mark-payment-received with { method: 'cash' }.
    return this.orderService.markCashReceived(id, user, note);
  }

  @Patch(':id/mark-payment-received')
  @Roles('ADMIN', 'CASHIER', 'COURIER')
  @ApiOperation({ summary: 'Record manual payment collection (cash/card at pickup)' })
  async markPaymentReceived(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('method') method: 'cash' | 'card',
    @Body('note') note?: string,
    @Headers('x-supervisor-elevation') supervisorElevation?: string | string[],
  ) {
    const hdr = Array.isArray(supervisorElevation)
      ? supervisorElevation[0]
      : supervisorElevation;
    return this.orderService.markPaymentReceived(id, user, method, note, hdr);
  }

  @Patch(':id/support')
  @Roles('ADMIN', 'CASHIER')
  @ApiBody({ type: SupportOrderUpdateBodyDto })
  async updateSupportDetails(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Parameters<OrderService['updateOrderSupportDetails']>[2],
  ) {
    return this.orderService.updateOrderSupportDetails(id, user, body);
  }

  @Patch(':id/line-items')
  @Roles('ADMIN', 'CASHIER')
  @ApiOperation({
    summary: 'Replace order line items',
    description:
      'Production policy: cashier may edit lines while payment is pending, or when paid but still pre-kitchen (`placed`/`paid`). Paid delivery in `ready` is frozen. ADMIN may override locked orders with `adminOverrideReason`.',
  })
  @ApiBody({ type: ReplaceOrderLineItemsBodyDto })
  async replaceOrderLineItems(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: unknown,
  ) {
    return this.orderService.replaceOrderLineItems(id, user, body);
  }

  @Post(':id/email-receipt')
  @Roles('ADMIN', 'CASHIER')
  @ApiOperation({
    summary: 'Email HTML receipt',
    description:
      'Sends the receipt to the email on the linked Customer row. Use ?force=true to attempt again after a successful send.',
  })
  @ApiQuery({
    name: 'force',
    required: false,
    description: 'When true, bypass “already sent” dedupe (audit trail still records the attempt)',
  })
  async sendReceiptEmail(
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.invoiceEmailService.sendReceiptEmailManual(id, {
      force: force === '1' || force === 'true',
    });
  }
}
