import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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

  @Get('count-before')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN')
  async countBefore(@Query('before') before?: string) {
    const raw = before?.trim();
    if (!raw) throw new BadRequestException('before query parameter is required');
    const cutoff = new Date(raw);
    if (Number.isNaN(cutoff.getTime())) throw new BadRequestException('Invalid before datetime');
    const count = await this.activityService.countBefore(cutoff);
    return { count };
  }

  @Post('purge')
  @UseInterceptors(PrivateNoStoreVaryAuthInterceptor)
  @Roles('ADMIN')
  async purge(@Body() body: { before?: string }) {
    const raw = body?.before?.trim();
    if (!raw) throw new BadRequestException('before is required');
    const cutoff = new Date(raw);
    if (Number.isNaN(cutoff.getTime())) throw new BadRequestException('Invalid before datetime');
    return this.activityService.purgeBefore(cutoff);
  }

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
