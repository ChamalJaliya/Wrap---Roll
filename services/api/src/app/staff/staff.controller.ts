import { Controller, Get, Patch, Param, Body, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import {
  StaffBulkUpdateBodyDto,
  StaffCourierStatusBodyDto,
  StaffCreateCourierBodyDto,
  StaffCreateUserBodyDto,
  StaffUpdateUserBodyDto,
} from '../../openapi/zod-dtos';
import { ListFilterGroup } from '../common/list-filter.util';
import { StaffService } from './staff.service';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard, SupabaseAuthGuard } from '../../auth';
import { StaffRole } from '../../auth';

@Controller('staff')
@ApiTags('staff')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('users')
  @Roles('ADMIN')
  async getStaffUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: StaffRole,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: 'email' | 'fullName' | 'role' | 'createdAt' | 'lastSignInAt',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
    @Query('filters') filters?: string | Record<string, unknown>,
  ) {
    let parsedFilters: unknown;
    if (filters) {
      if (typeof filters === 'string') {
        try {
          parsedFilters = JSON.parse(filters);
        } catch {
          parsedFilters = undefined;
        }
      } else if (typeof filters === 'object') {
        parsedFilters = filters;
      }
    }
    return this.staffService.getStaffUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      role,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      sortBy,
      sortDir,
      filters: parsedFilters as ListFilterGroup | undefined,
    });
  }

  @Get('audit-logs')
  @Roles('ADMIN')
  async getAuditLogs(@Query('limit') limit?: string) {
    return this.staffService.getAuditLogs(limit ? Number(limit) : undefined);
  }

  @Post('users')
  @Roles('ADMIN')
  @ApiBody({ type: StaffCreateUserBodyDto })
  async createStaffUser(@Body() body: StaffCreateUserBodyDto, @CurrentUser() actor?: RequestUser) {
    return this.staffService.createStaffUser(
      {
        email: body.email,
        password: body.password,
        role: body.role,
        fullName: body.fullName,
        phone: body.phone,
      },
      actor!,
    );
  }

  @Patch('users/:id')
  @Roles('ADMIN')
  @ApiBody({ type: StaffUpdateUserBodyDto })
  async updateStaffUser(
    @Param('id') id: string,
    @Body() body: StaffUpdateUserBodyDto,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.staffService.updateStaffUser(
      id,
      {
        role: body.role,
        fullName: body.fullName,
        phone: body.phone,
        isActive: body.isActive,
        password: body.password,
      },
      actor!,
    );
  }

  @Post('users/bulk')
  @Roles('ADMIN')
  @ApiBody({ type: StaffBulkUpdateBodyDto })
  async bulkUpdateStaffUsers(
    @Body() body: StaffBulkUpdateBodyDto,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.staffService.bulkUpdateStaffUsers(actor!, {
      userIds: body.userIds,
      action: body.action,
      isActive: body.isActive,
      role: body.role as StaffRole | undefined,
    });
  }

  @Get('couriers')
  @Roles('ADMIN')
  async getCouriers() {
    return this.staffService.getCouriers();
  }

  @Post('couriers')
  @Roles('ADMIN')
  @ApiBody({ type: StaffCreateCourierBodyDto })
  async createCourier(@Body() body: StaffCreateCourierBodyDto, @CurrentUser() actor?: RequestUser) {
    return this.staffService.createCourier({ name: body.name, phone: body.phone }, actor!);
  }

  @Get('couriers/queue')
  @Roles('ADMIN')
  async getCourierQueue() {
    return this.staffService.getCourierQueue();
  }

  @Patch('couriers/:id/status')
  @Roles('ADMIN')
  @ApiBody({ type: StaffCourierStatusBodyDto })
  async toggleCourierStatus(
    @Param('id') id: string,
    @Body() body: StaffCourierStatusBodyDto,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.staffService.toggleCourierStatus(id, body.isActive, actor!);
  }
}
