import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { OutboxRelayJobPayload } from '@wrap-roll/contracts';
import { BULLMQ_QUEUE } from '../queue/queue.constants';
import { NotificationService } from './notification.service';
import type { NotificationJobName } from './notification.constants';

@Processor(BULLMQ_QUEUE.notificationsSms)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  override async process(job: Job<OutboxRelayJobPayload, void, NotificationJobName>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        msg: 'notification.job.start',
        queue: BULLMQ_QUEUE.notificationsSms,
        name: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      }),
    );
    await this.notificationService.processQueueJob(job.name, job.data, job.attemptsMade);
  }
}
