import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationService } from './notification.service';
import { NotificationApiService } from './notification-api.service';
import { NotificationController } from './notification.controller';
import { InvoiceEmailService } from './invoice-email.service';
import { LogSmsProvider, SupabaseEdgeSmsProvider } from './providers/sms.provider';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    InvoiceEmailService,
    NotificationApiService,
    {
      provide: 'SMS_PROVIDER',
      useClass: process.env.NODE_ENV === 'production' ? SupabaseEdgeSmsProvider : LogSmsProvider,
    },
  ],
  exports: [NotificationService, NotificationApiService, InvoiceEmailService],
})
export class NotificationModule {}
