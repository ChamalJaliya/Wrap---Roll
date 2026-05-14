import {
  Body,
  Controller,
  Patch,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import {
  CustomerAddressBodyDto,
  CustomerAdminPatchBodyDto,
  CustomerProfileUpdateBodyDto,
  SavedPaymentTokenBodyDto,
  CreateMenuItemReviewBodyDto,
  CreateMenuItemReviewReplyBodyDto,
} from '../../openapi/zod-dtos';
import { CustomerService } from './customer.service';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { Roles } from '../../auth/roles.decorator';
import { CustomerAddressSchema, SavedPaymentTokenSchema } from '@wrap-roll/contracts';
import { MenuReviewService } from '../menu-review/menu-review.service';
import type { Order, OrderItem } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('customer')
@ApiTags('customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly menuReviewService: MenuReviewService,
  ) {}

  /** Idempotent: ensure one Prisma row is linked to this Supabase session (no order history payload). */
  @Post('sync')
  @HttpCode(200)
  @Roles('CLIENT', 'ADMIN')
  async sync(@CurrentUser() user: RequestUser) {
    if (!user?.email) {
      throw new NotFoundException(
        'Customer profile requires an email on your auth account',
      );
    }
    const c = await this.customerService.requireCustomerRowForAuth(user);
    return {
      id: c.id,
      email: c.email,
      name: c.name,
      phone: c.phone,
    };
  }

  @Get('profile')
  @Roles('CLIENT', 'ADMIN')
  async getProfile(@CurrentUser() user: RequestUser) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return this.customerService.getCustomerHistory(customer.id);
  }

  @Get('history')
  @Roles('CLIENT', 'ADMIN')
  async getHistory(@CurrentUser() user: RequestUser) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    const full = await this.customerService.getCustomerHistory(customer.id);
    const orders = (full?.orders ?? []) as (Order & { items: OrderItem[] })[];
    return this.menuReviewService.attachDishReviewHintsToOrders(customer.id, orders);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('orders/:orderId/menu-items/:menuItemId/reviews')
  @HttpCode(201)
  @Roles('CLIENT', 'ADMIN')
  @ApiBody({ type: CreateMenuItemReviewBodyDto })
  async createMenuItemReview(
    @CurrentUser() user: RequestUser,
    @Param('orderId') orderId: string,
    @Param('menuItemId') menuItemId: string,
    @Body() body: unknown,
  ) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return this.menuReviewService.createReview({
      actorCustomerId: customer.id,
      orderId,
      menuItemId,
      body,
    });
  }

  /** Public menu review thread — reply (JWT + Customer row). Path under `/customer` avoids `menu/*` route clashes. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('menu-item-reviews/:reviewId/replies')
  @HttpCode(201)
  @Roles('CLIENT', 'ADMIN')
  @ApiBody({ type: CreateMenuItemReviewReplyBodyDto })
  async addMenuItemReviewReply(
    @CurrentUser() user: RequestUser,
    @Param('reviewId') reviewId: string,
    @Body() body: unknown,
  ) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return this.menuReviewService.addCustomerReply({
      actorCustomerId: customer.id,
      reviewId,
      body,
    });
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('menu-item-reviews/:reviewId/reactions/helpful')
  @HttpCode(200)
  @Roles('CLIENT', 'ADMIN')
  async toggleMenuItemReviewHelpful(@CurrentUser() user: RequestUser, @Param('reviewId') reviewId: string) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return this.menuReviewService.toggleReviewHelpful({
      actorCustomerId: customer.id,
      reviewId,
    });
  }

  @Put('profile')
  @Roles('CLIENT', 'ADMIN')
  @ApiBody({ type: CustomerProfileUpdateBodyDto })
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: { name?: string; phone?: string },
  ) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return this.customerService.updateProfile(
      customer.id,
      body.name,
      body.phone,
    );
  }

  // ── Address Book ───────────────────────────────────────────────────────────

  @Get('address-book')
  @Roles('CLIENT', 'ADMIN')
  async getAddressBook(@CurrentUser() user: RequestUser) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return await this.customerService.getAddressBook(customer.id);
  }

  @Put('address')
  @Roles('CLIENT', 'ADMIN')
  @ApiBody({ type: CustomerAddressBodyDto })
  async saveAddress(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    const parsed = CustomerAddressSchema.parse(body);
    return await this.customerService.saveAddress(customer.id, parsed);
  }

  // ── Saved Payments ─────────────────────────────────────────────────────────

  @Get('saved-cards')
  @Roles('CLIENT', 'ADMIN')
  async getSavedPayments(@CurrentUser() user: RequestUser) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    return await this.customerService.getSavedPayments(customer.id);
  }

  @Put('card')
  @Roles('CLIENT', 'ADMIN')
  @ApiBody({ type: SavedPaymentTokenBodyDto })
  async savePaymentToken(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    if (!user?.email) {
      throw new NotFoundException('Customer profile requires an email on your auth account');
    }
    const customer = await this.customerService.requireCustomerRowForAuth(user);
    const parsed = SavedPaymentTokenSchema.parse(body);
    return await this.customerService.savePaymentToken(customer.id, parsed);
  }

  /** Staff intake helper: lookup known customer + addresses by phone for phone-order workflow. */
  @Get('intake-by-phone')
  @Roles('ADMIN', 'CASHIER')
  async intakeByPhone(@Query('phone') phone?: string) {
    return this.customerService.lookupIntakeByPhone(String(phone ?? ''));
  }

  // ── Admin Customer Management ──────────────────────────────────────────────
  @Get('admin/list')
  @Roles('ADMIN', 'CASHIER')
  async listForAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'name' | 'email' | 'phone',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.customerService.listCustomersAdmin({
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      search: search ?? '',
      sortBy,
      sortDir,
    });
  }

  @Get('admin/:id')
  @Roles('ADMIN', 'CASHIER')
  async getForAdmin(@Param('id') id: string) {
    const row = await this.customerService.getCustomerAdmin(id);
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  @Patch('admin/:id')
  @Roles('ADMIN')
  @ApiBody({ type: CustomerAdminPatchBodyDto })
  async patchForAdmin(
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string | null; email?: string | null },
  ) {
    return this.customerService.updateCustomerAdmin(id, body ?? {});
  }
}
