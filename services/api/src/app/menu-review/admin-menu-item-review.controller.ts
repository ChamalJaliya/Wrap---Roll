import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, SupabaseAuthGuard, type RequestUser } from '../../auth';
import { AdminPatchMenuItemReviewBodyDto, CreateMenuItemReviewReplyBodyDto } from '../../openapi/zod-dtos';
import { MenuReviewService } from './menu-review.service';
import { AdminPatchMenuItemReviewBodySchema, type MenuItemReviewVisibility } from '@wrap-roll/contracts';

@Controller('admin/menu-item-reviews')
@ApiTags('admin/menu-item-reviews')
@UseGuards(SupabaseAuthGuard)
@Roles('ADMIN')
export class AdminMenuItemReviewController {
  constructor(private readonly menuReviewService: MenuReviewService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'visibility',
    required: false,
    enum: ['pending', 'public', 'hidden'],
  })
  @ApiQuery({ name: 'menuItemId', required: false })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('visibility') visibility?: MenuItemReviewVisibility,
    @Query('menuItemId') menuItemId?: string,
  ) {
    const p = page !== undefined && page !== '' ? Number(page) : 1;
    const l = limit !== undefined && limit !== '' ? Number(limit) : 20;
    return this.menuReviewService.listAdmin({
      page: Number.isFinite(p) ? p : 1,
      limit: Number.isFinite(l) ? l : 20,
      visibility,
      menuItemId: menuItemId?.trim() || undefined,
    });
  }

  @Patch(':id')
  @ApiBody({ type: AdminPatchMenuItemReviewBodyDto })
  patch(@Param('id') id: string, @Body() body: unknown) {
    const parsed = AdminPatchMenuItemReviewBodySchema.parse(body);
    return this.menuReviewService.patchAdminReview(id, parsed);
  }

  @Post(':id/replies')
  @HttpCode(201)
  @ApiBody({ type: CreateMenuItemReviewReplyBodyDto })
  addReply(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: RequestUser) {
    return this.menuReviewService.addStaffReply({
      reviewId: id,
      staffSub: user.sub,
      authorLabel: user.fullName ?? user.email ?? 'Team',
      body,
    });
  }
}
