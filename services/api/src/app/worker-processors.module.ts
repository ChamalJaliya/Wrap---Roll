import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ActivityModule } from './activity/activity.module';
import { ActivityProcessor } from './activity/activity.processor';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryProcessor } from './inventory/inventory.processor';
import { NotificationModule } from './notification/notification.module';
import { NotificationProcessor } from './notification/notification.processor';
import { PaymentModule } from './payment/payment.module';
import { PaymentProcessor } from './payment/payment.processor';
import { PrintModule } from './print/print.module';
import { PrintProcessor } from './print/print.processor';

@Module({
  imports: [AuthModule, NotificationModule, PrintModule, ActivityModule, InventoryModule, PaymentModule],
  providers: [
    NotificationProcessor,
    PrintProcessor,
    ActivityProcessor,
    InventoryProcessor,
    PaymentProcessor,
  ],
})
export class WorkerProcessorsModule {}
