import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Public, Roles, SupabaseAuthGuard } from '../../auth';
import { UpdateAdminSettingsBodyDto } from '../../openapi/zod-dtos';
import { SettingsService } from './settings.service';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';

@Controller()
@ApiTags('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Public-safe subset used by storefront + marketing pages. */
  @Get('settings')
  @Public()
  async getPublicSettings() {
    return this.settingsService.getPublic();
  }

  /** Admin-only: full settings payload (JSON fields included). */
  @Get('admin/settings')
  @UseGuards(SupabaseAuthGuard)
  @Roles('ADMIN')
  async getAdminSettings() {
    return this.settingsService.getOrCreate();
  }

  @Put('admin/settings')
  @UseGuards(SupabaseAuthGuard)
  @Roles('ADMIN')
  @ApiBody({ type: UpdateAdminSettingsBodyDto })
  async updateAdminSettings(@Body() body: unknown, @CurrentUser() actor?: RequestUser) {
    return this.settingsService.updateAdmin(body ?? {}, actor!);
  }
}

