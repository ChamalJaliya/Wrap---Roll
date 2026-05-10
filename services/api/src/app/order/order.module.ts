import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrivateNoStoreVaryAuthInterceptor } from './private-no-store-vary-auth.interceptor';
import { QueueResponseCacheService } from './queue-response-cache.service';
import { StaffModule } from '../staff/staff.module';
import { CouponModule } from '../coupon/coupon.module';
import { CustomerModule } from '../customer/customer.module';
import { LocationModule } from '../location/location.module';
import { ActivityModule } from '../activity/activity.module';
import { SupervisorModule } from '../supervisor/supervisor.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    StaffModule,
    CouponModule,
    SupervisorModule,
    CustomerModule,
    LocationModule,
    ActivityModule,
    NotificationModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, PrivateNoStoreVaryAuthInterceptor, QueueResponseCacheService],
  exports: [OrderService, QueueResponseCacheService],
})
export class OrderModule {}
