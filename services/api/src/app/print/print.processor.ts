import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { OutboxRelayJobPayload, PrintJobName } from '@wrap-roll/contracts';
import { BULLMQ_QUEUE } from '../queue/queue.constants';
import { PrintService } from './print.service';

@Processor(BULLMQ_QUEUE.printReceipts)
export class PrintProcessor extends WorkerHost {
  private readonly logger = new Logger(PrintProcessor.name);

  constructor(private readonly printService: PrintService) {
    super();
  }

  override async process(job: Job<OutboxRelayJobPayload, void, PrintJobName>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        msg: 'print.job.start',
        queue: BULLMQ_QUEUE.printReceipts,
        name: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      }),
    );
    await this.printService.processQueueJob(job.name, job.data, job.attemptsMade);
  }
}
