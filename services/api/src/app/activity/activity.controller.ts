import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard, Roles } from '../../auth';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { PrivateNoStoreVaryAuthInterceptor } from '../order/private-no-store-vary-auth.interceptor';
import { ActivityService } from './activity.service';

@Controller('activity')
@ApiTags('activity')
@UseGuards(SupabaseAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN', 'CASHIER')
  async list(
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('entityType') entityType?: string,
    @Query('app') app?: string,
    @Query('actorRole') actorRole?: string,
    @Query('eventType') eventType?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @CurrentUser() _user?: RequestUser,
  ) {
    return this.activityService.listGlobal({
      take: take ? Number(take) : undefined,
      cursor: cursor?.trim() || null,
      entityType,
      app,
      actorRole,
      eventType,
      q,
      from,
      to,
    });
  }

  @Get('orders/:orderId')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN', 'CASHIER')
  async orderActivity(@Param('orderId') orderId: string) {
    return this.activityService.listByOrderId(orderId);
  }
}
