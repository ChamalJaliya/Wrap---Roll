import type { Prisma } from '@prisma/client';
import type { OutboxEnvelope as ContractOutboxEnvelope, OutboxStatus } from '@wrap-roll/contracts';

export type OutboxEnvelope = Omit<ContractOutboxEnvelope, 'payloadJson' | 'publishAfter'> & {
  payloadJson: Prisma.InputJsonValue;
  publishAfter?: Date;
};

export type OutboxEventRow = {
  id: string;
  eventType: string;
  eventVersion: number;
  entityType: string;
  entityId: string;
  correlationId: string | null;
  idempotencyKey: string | null;
  payloadJson: unknown;
  status: OutboxStatus;
  publishAfter: Date;
  attemptCount: number;
  lastError: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
