import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { AdminCouponCreateBodyDto, AdminCouponUpdateBodyDto } from '../../openapi/zod-dtos';
import { CouponService } from './coupon.service';
import { Roles, SupabaseAuthGuard } from '../../auth';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';

@Controller('admin/coupons')
@ApiTags('admin/coupons')
@UseGuards(SupabaseAuthGuard)
@Roles('ADMIN')
export class AdminCouponController {
  constructor(private readonly couponService: CouponService) {}

  @Get()
  list() {
    return this.couponService.listAdmin();
  }

  @Post()
  @ApiBody({ type: AdminCouponCreateBodyDto })
  create(
    @Body()
    body: {
      code: string;
      discountPercent: number;
      minSubtotal?: number | null;
      firstOrderOnly?: boolean;
      isActive?: boolean;
      expiryDate?: string | null;
    },
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.couponService.createAdmin(body, actor!);
  }

  @Patch(':id')
  @ApiBody({ type: AdminCouponUpdateBodyDto })
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      discountPercent: number;
      minSubtotal: number | null;
      firstOrderOnly: boolean;
      isActive: boolean;
      expiryDate: string | null;
    }>,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.couponService.updateAdmin(id, body, actor!);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor?: RequestUser) {
    return this.couponService.deleteAdmin(id, actor!);
  }
}
