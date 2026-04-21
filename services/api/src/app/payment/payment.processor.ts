import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { OutboxRelayJobPayload } from '@wrap-roll/contracts';
import { BULLMQ_QUEUE } from '../queue/queue.constants';
import { PaymentService } from './payment.service';
import type { PaymentJobName } from './payment.constants';

@Processor(BULLMQ_QUEUE.paymentsOrchestration)
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(private readonly paymentService: PaymentService) {
    super();
  }

  override async process(job: Job<OutboxRelayJobPayload, void, PaymentJobName>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        msg: 'payment.job.start',
        queue: BULLMQ_QUEUE.paymentsOrchestration,
        name: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      }),
    );
    await this.paymentService.processQueueJob(job.name, job.data, job.attemptsMade);
  }
}
