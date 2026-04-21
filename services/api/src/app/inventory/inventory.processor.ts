import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { OutboxRelayJobPayload } from '@wrap-roll/contracts';
import { BULLMQ_QUEUE } from '../queue/queue.constants';
import { InventoryService } from './inventory.service';
import type { InventoryJobName } from './inventory.constants';

@Processor(BULLMQ_QUEUE.inventoryMovements)
export class InventoryProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryProcessor.name);

  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  override async process(job: Job<OutboxRelayJobPayload, void, InventoryJobName>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        msg: 'inventory.job.start',
        queue: BULLMQ_QUEUE.inventoryMovements,
        name: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      }),
    );
    await this.inventoryService.processQueueJob(job.name, job.data, job.attemptsMade);
  }
}
