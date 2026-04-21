import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ValidateCouponBodyDto } from '../../openapi/zod-dtos';
import { CouponService } from './coupon.service';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard, Public } from '../../auth';

@Controller('coupon')
@ApiTags('coupon')
@UseGuards(SupabaseAuthGuard)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 10000 } })
  @Post('validate')
  @ApiBody({ type: ValidateCouponBodyDto })
  validate(
    @Body() body: { code: string; subtotal: number; customerPhone?: string },
  ) {
    return this.couponService.validateCoupon(
      body.code,
      body.subtotal,
      undefined,
      body.customerPhone?.trim() || undefined,
    );
  }
}
