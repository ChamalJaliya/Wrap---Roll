import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles, SupabaseAuthGuard } from '../../auth';
import { QueueService } from './queue.service';

@Controller('queue/infra')
@ApiTags('queue')
@UseGuards(SupabaseAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('health')
  @Roles('ADMIN')
  async health() {
    return this.queueService.health();
  }
}
