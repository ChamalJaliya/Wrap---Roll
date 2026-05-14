import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { AdminCouponController } from './admin-coupon.controller';
import { AdminMenuItemReviewController } from '../menu-review/admin-menu-item-review.controller';
import { CouponService } from './coupon.service';
import { MenuReviewModule } from '../menu-review/menu-review.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MenuReviewModule],
  controllers: [CouponController, AdminCouponController, AdminMenuItemReviewController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
