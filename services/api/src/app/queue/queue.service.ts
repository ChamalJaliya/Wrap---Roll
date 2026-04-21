import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { BULLMQ_QUEUE } from './queue.constants';
import { isBullMqEnabled, queuePrefix } from './queue.config';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Optional() @InjectQueue(BULLMQ_QUEUE.paymentsOrchestration) private readonly paymentsQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.notificationsSms) private readonly notificationsQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.printReceipts) private readonly printQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.inventoryMovements) private readonly inventoryQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.activityEvents) private readonly activityQueue?: Queue,
  ) {}

  queueRefs(): Array<{ name: string; ref?: Queue }> {
    return [
      { name: BULLMQ_QUEUE.paymentsOrchestration, ref: this.paymentsQueue },
      { name: BULLMQ_QUEUE.notificationsSms, ref: this.notificationsQueue },
      { name: BULLMQ_QUEUE.printReceipts, ref: this.printQueue },
      { name: BULLMQ_QUEUE.inventoryMovements, ref: this.inventoryQueue },
      { name: BULLMQ_QUEUE.activityEvents, ref: this.activityQueue },
    ];
  }

  logBootstrapContext(target: 'api' | 'worker'): void {
    this.logger.log(
      JSON.stringify({
        msg: 'bullmq.bootstrap',
        target,
        enabled: isBullMqEnabled(),
        prefix: queuePrefix(),
      }),
    );
  }

  async health() {
    const enabled = isBullMqEnabled();
    const queues = this.queueRefs();

    if (!enabled) {
      return {
        enabled: false,
        prefix: queuePrefix(),
        queues: queues.map((queue) => ({ name: queue.name, ready: false, reason: 'disabled' })),
      };
    }

    const snapshots = await Promise.all(
      queues.map(async ({ name, ref }) => {
        if (!ref) {
          return { name, ready: false, reason: 'queue_not_registered' as const };
        }
        try {
          const counts = await ref.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
          return {
            name,
            ready: true,
            counts,
          };
        } catch (error) {
          return {
            name,
            ready: false,
            reason: 'metrics_unavailable' as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    return {
      enabled: true,
      prefix: queuePrefix(),
      queues: snapshots,
    };
  }
}
