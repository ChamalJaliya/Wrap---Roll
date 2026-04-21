import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { OUTBOX_EVENT_PREFIX, outboxEventStartsWith } from '@wrap-roll/contracts';
import { BULLMQ_QUEUE } from '../queue/queue.constants';
import { isBullMqEnabled } from '../queue/queue.config';
import { OutboxService } from './outbox.service';
import type { OutboxEventRow } from './outbox.types';

function outboxRelayEnabled(): boolean {
  if (!isBullMqEnabled()) return false;
  const raw = process.env.OUTBOX_RELAY_ENABLED;
  if (raw == null) return true;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return true;
}

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private readonly workerId = `outbox-relay-${randomUUID().slice(0, 8)}`;

  constructor(
    private readonly outboxService: OutboxService,
    @Optional() @InjectQueue(BULLMQ_QUEUE.paymentsOrchestration) private readonly paymentsQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.notificationsSms) private readonly notificationsQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.printReceipts) private readonly printQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.inventoryMovements) private readonly inventoryQueue?: Queue,
    @Optional() @InjectQueue(BULLMQ_QUEUE.activityEvents) private readonly activityQueue?: Queue,
  ) {}

  onModuleInit(): void {
    if (!outboxRelayEnabled()) {
      this.logger.log('Outbox relay disabled.');
      return;
    }
    const pollMs = Math.max(200, Number(process.env.OUTBOX_RELAY_POLL_MS ?? 1500) || 1500);
    this.logger.log(
      JSON.stringify({
        msg: 'outbox.relay.start',
        workerId: this.workerId,
        pollMs,
      }),
    );
    this.timer = setInterval(() => {
      void this.tick();
    }, pollMs);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private routeQueue(eventType: string): Queue | undefined {
    if (outboxEventStartsWith(eventType, OUTBOX_EVENT_PREFIX.payment)) return this.paymentsQueue;
    if (outboxEventStartsWith(eventType, OUTBOX_EVENT_PREFIX.notification)) return this.notificationsQueue;
    if (outboxEventStartsWith(eventType, OUTBOX_EVENT_PREFIX.print)) return this.printQueue;
    if (outboxEventStartsWith(eventType, OUTBOX_EVENT_PREFIX.inventory)) return this.inventoryQueue;
    return this.activityQueue;
  }

  private async publishOne(event: OutboxEventRow): Promise<void> {
    const queue = this.routeQueue(event.eventType);
    if (!queue) {
      throw new Error(`No queue available for eventType=${event.eventType}`);
    }
    // BullMQ custom IDs cannot contain ":" on newer versions.
    const rawJobId = event.idempotencyKey || `outbox:${event.id}`;
    const jobId = rawJobId.replace(/[^a-zA-Z0-9_-]/g, '_');
    await queue.add(
      event.eventType,
      {
        outboxId: event.id,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        entityType: event.entityType,
        entityId: event.entityId,
        correlationId: event.correlationId,
        payload: event.payloadJson,
        createdAt: event.createdAt.toISOString(),
      },
      {
        jobId,
      },
    );
  }

  private async tick(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const batchSize = Math.min(100, Math.max(1, Number(process.env.OUTBOX_RELAY_BATCH_SIZE ?? 20) || 20));
      const deadLetterThreshold = Math.max(
        1,
        Number(process.env.OUTBOX_RELAY_DEAD_LETTER_ATTEMPTS ?? 10) || 10,
      );
      const claimed = await this.outboxService.claimPendingBatch({
        workerId: this.workerId,
        take: batchSize,
      });
      if (claimed.length === 0) return;
      for (const event of claimed) {
        try {
          await this.publishOne(event);
          await this.outboxService.markPublished(event.id);
        } catch (error) {
          await this.outboxService.markFailed({
            id: event.id,
            error: error instanceof Error ? error.message : String(error),
            deadLetterThreshold,
          });
        }
      }
    } finally {
      this.inFlight = false;
    }
  }
}
