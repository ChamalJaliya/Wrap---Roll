import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OUTBOX_STATUS } from '@wrap-roll/contracts';
import { PrismaService } from '../prisma/prisma.service';
import type { OutboxEnvelope, OutboxEventRow } from './outbox.types';

type OutboxDelegate = {
  create(args: { data: Record<string, unknown> }): Promise<OutboxEventRow>;
  findMany(args: Record<string, unknown>): Promise<OutboxEventRow[]>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<OutboxEventRow>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
};

type OutboxCapableClient = {
  outboxEvent: OutboxDelegate;
};

function asOutboxDelegate(client: unknown): OutboxDelegate {
  return (client as OutboxCapableClient).outboxEvent;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  private toCreateData(envelope: OutboxEnvelope): Record<string, unknown> {
    const idempotencyKey = envelope.idempotencyKey?.trim() || null;
    const correlationId = envelope.correlationId?.trim() || null;
    return {
      eventType: envelope.eventType,
      eventVersion: Math.max(1, Number(envelope.eventVersion ?? 1)),
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      correlationId,
      idempotencyKey,
      payloadJson: envelope.payloadJson,
      publishAfter: envelope.publishAfter ?? new Date(),
      status: OUTBOX_STATUS.pending,
    };
  }

  async append(envelope: OutboxEnvelope): Promise<OutboxEventRow> {
    return asOutboxDelegate(this.prisma).create({
      data: this.toCreateData(envelope),
    });
  }

  async appendUsingTx(tx: Prisma.TransactionClient, envelope: OutboxEnvelope): Promise<OutboxEventRow> {
    return asOutboxDelegate(tx).create({
      data: this.toCreateData(envelope),
    });
  }

  async claimPendingBatch(args: {
    workerId: string;
    take: number;
  }): Promise<OutboxEventRow[]> {
    const take = Math.min(200, Math.max(1, Math.floor(args.take)));
    const candidates = await asOutboxDelegate(this.prisma).findMany({
      where: {
        status: { in: [OUTBOX_STATUS.pending, OUTBOX_STATUS.failed] },
        publishAfter: { lte: new Date() },
      },
      orderBy: [{ createdAt: 'asc' }],
      take,
    });
    if (candidates.length === 0) return [];

    const claimed: OutboxEventRow[] = [];
    for (const event of candidates) {
      try {
        const res = await asOutboxDelegate(this.prisma).updateMany({
          where: {
            id: event.id,
            status: event.status,
          },
          data: {
            status: OUTBOX_STATUS.processing,
            lockedAt: new Date(),
            lockedBy: args.workerId,
            attemptCount: { increment: 1 },
            lastError: null,
          },
        });
        if (res.count !== 1) continue;

        const latest = await asOutboxDelegate(this.prisma).findMany({
          where: { id: event.id },
          take: 1,
        });
        if (latest[0]) claimed.push(latest[0]);
      } catch (error) {
        this.logger.warn(
          `Failed claiming outbox event ${event.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return claimed;
  }

  async markPublished(id: string): Promise<void> {
    await asOutboxDelegate(this.prisma).update({
      where: { id },
      data: {
        status: OUTBOX_STATUS.published,
        publishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async markFailed(args: {
    id: string;
    error: string;
    deadLetterThreshold: number;
  }): Promise<void> {
    const eventRows = await asOutboxDelegate(this.prisma).findMany({
      where: { id: args.id },
      take: 1,
    });
    const event = eventRows[0];
    if (!event) return;
    const nextStatus =
      event.attemptCount >= Math.max(1, args.deadLetterThreshold)
        ? OUTBOX_STATUS.deadLetter
        : OUTBOX_STATUS.failed;
    await asOutboxDelegate(this.prisma).update({
      where: { id: args.id },
      data: {
        status: nextStatus,
        lockedAt: null,
        lockedBy: null,
        lastError: args.error.slice(0, 4000),
      },
    });
  }
}
