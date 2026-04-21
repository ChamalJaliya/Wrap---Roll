import { Controller, Get, Param, Patch, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard, Roles } from '../../auth';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { PrivateNoStoreVaryAuthInterceptor } from '../order/private-no-store-vary-auth.interceptor';
import { NotificationApiService } from './notification-api.service';

@Controller('notifications')
@ApiTags('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationController {
  constructor(private readonly notificationApi: NotificationApiService) {}

  /** Customer SMS / outbound delivery audit (admin). */
  @Get('deliveries')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN')
  async listDeliveries(
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('orderId') orderId?: string,
  ) {
    return this.notificationApi.listDeliveries({
      take: take ? Number(take) : undefined,
      cursor: cursor?.trim() || null,
      orderId: orderId?.trim() || null,
    });
  }

  /** Staff in-app inbox (all authenticated staff roles). */
  @Get('inbox')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN', 'CASHIER', 'KITCHEN', 'COURIER')
  async inbox(
    @CurrentUser() user: RequestUser,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationApi.listInbox(user.sub, {
      take: take ? Number(take) : undefined,
      cursor: cursor?.trim() || null,
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
    });
  }

  @Patch('inbox/:id/read')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN', 'CASHIER', 'KITCHEN', 'COURIER')
  async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notificationApi.markInboxRead(user.sub, id);
  }

  @Patch('inbox/read-all')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN', 'CASHIER', 'KITCHEN', 'COURIER')
  async markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationApi.markInboxReadAll(user.sub);
  }
}
