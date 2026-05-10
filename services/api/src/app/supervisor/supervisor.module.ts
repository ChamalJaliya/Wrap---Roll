import { Module } from '@nestjs/common';
import { SupervisorController } from './supervisor.controller';
import { SupervisorService } from './supervisor.service';
import { SupervisorElevationGuard } from './supervisor-elevation.guard';

@Module({
  controllers: [SupervisorController],
  providers: [SupervisorService, SupervisorElevationGuard],
  exports: [SupervisorService, SupervisorElevationGuard],
})
export class SupervisorModule {}
