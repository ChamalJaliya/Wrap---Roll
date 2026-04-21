import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { OutboxRelayJobPayload } from '@wrap-roll/contracts';
import { BULLMQ_QUEUE } from '../queue/queue.constants';
import { ActivityService } from './activity.service';

@Processor(BULLMQ_QUEUE.activityEvents)
export class ActivityProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityProcessor.name);

  constructor(private readonly activityService: ActivityService) {
    super();
  }

  override async process(job: Job<OutboxRelayJobPayload>): Promise<void> {
    this.logger.log(
      JSON.stringify({
        msg: 'activity.job.start',
        queue: BULLMQ_QUEUE.activityEvents,
        name: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      }),
    );
    await this.activityService.processQueueJob(job.data, job.attemptsMade);
  }
}
