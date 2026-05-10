import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule, SupabaseAuthGuard, RolesGuard } from '../auth';
import { CouponModule } from './coupon/coupon.module';
import { MenuModule } from './menu/menu.module';
import { StaffModule } from './staff/staff.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { CustomerModule } from './customer/customer.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { PrintModule } from './print/print.module';

import { NotificationModule } from './notification/notification.module';
import { InventoryModule } from './inventory/inventory.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SettingsModule } from './settings/settings.module';
import { LocationModule } from './location/location.module';
import { ActivityModule } from './activity/activity.module';
import { QueueModule } from './queue/queue.module';
import { OutboxModule } from './outbox/outbox.module';

@Module({
  imports: [
    AuthModule,
    ActivityModule,
    CouponModule,
    MenuModule,
    StaffModule,
    SupervisorModule,
    CustomerModule,
    OrderModule,
    PaymentModule,
    PrintModule,
    NotificationModule,
    InventoryModule,
    AnalyticsModule,
    PrismaModule,
    SettingsModule,
    LocationModule,
    QueueModule.register(),
    OutboxModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
