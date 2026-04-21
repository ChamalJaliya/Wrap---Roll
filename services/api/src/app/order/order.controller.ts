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
import { CreateOrderBodyDto, SupportOrderUpdateBodyDto } from '../../openapi/zod-dtos';
import { OrderService } from './order.service';
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
    @CurrentUser() user?: RequestUser,
  ) {
    return this.orderService.createOrder(body, idempotencyKey, user);
  }

  // API-001 — status moved from @Body to @Query
  @Get()
  @Roles('ADMIN', 'CASHIER', 'COURIER', 'KITCHEN')
  @ApiOperation({ summary: 'List orders', description: 'Filter by status and fulfillmentType. Staff roles only.' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by order status' })
  @ApiQuery({ name: 'fulfillmentType', required: false })
  async getOrders(
    @Query('status') status?: OrderStatus,
    @Query('fulfillmentType') fulfillmentType?: string,
  ) {
    return this.orderService.getOrders(status, fulfillmentType);
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
  ) {
    return this.orderService.markPaymentReceived(id, user, method, note);
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
}
