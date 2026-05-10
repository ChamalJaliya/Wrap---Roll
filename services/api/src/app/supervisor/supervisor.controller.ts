import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard, SupabaseAuthGuard } from '../../auth';
import { SupervisorService } from './supervisor.service';
import { SupervisorElevationGuard } from './supervisor-elevation.guard';
import { RequireSupervisorElevation } from './supervisor-scope.decorator';
import { SUPERVISOR_ELEVATION_HEADER } from './supervisor-elevation.constants';

@Controller('supervisor')
@ApiTags('supervisor')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class SupervisorController {
  constructor(private readonly supervisorService: SupervisorService) {}

  /**
   * Cashier (or any staff) session requests short-lived elevation by proving an ADMIN's email + PIN.
   */
  @Post('challenge')
  @Roles('ADMIN', 'CASHIER', 'KITCHEN', 'COURIER')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['supervisorEmail', 'pin'],
      properties: {
        supervisorEmail: { type: 'string' },
        pin: { type: 'string' },
        scope: { type: 'string', default: 'privileged_operations' },
      },
    },
  })
  async challenge(
    @CurrentUser() user: RequestUser,
    @Body() body: { supervisorEmail: string; pin: string; scope?: string },
  ) {
    return this.supervisorService.challenge(user, body);
  }

  /**
   * Example protected route: requires `x-supervisor-elevation` from a recent challenge.
   * Add new privileged operations the same way (guards + audit inside handlers).
   */
  @Post('privileged/ping')
  @Roles('ADMIN', 'CASHIER')
  @UseGuards(SupervisorElevationGuard)
  @RequireSupervisorElevation('privileged_operations')
  @ApiHeader({ name: SUPERVISOR_ELEVATION_HEADER, required: true })
  async privilegedPing(@CurrentUser() user: RequestUser) {
    return {
      ok: true,
      message: 'Supervisor elevation accepted (demo). Wire real privileged actions here.',
      cashier: { sub: user.sub, email: user.email, role: user.role },
    };
  }

  /** Admin: set or rotate the supervisor PIN for an ADMIN staff user (stored as scrypt hash). */
  @Patch('pins/:staffUserId')
  @Roles('ADMIN')
  @ApiBody({
    schema: { type: 'object', required: ['pin'], properties: { pin: { type: 'string' } } },
  })
  async setPin(
    @Param('staffUserId') staffUserId: string,
    @Body() body: { pin: string },
    @CurrentUser() actor: RequestUser,
  ) {
    return this.supervisorService.setSupervisorPin(actor, staffUserId, body.pin);
  }
}
