import './load-env';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { txPaymentSidecarLoose } from './app/prisma/prisma-sidecar-loose';

async function main() {
  const isApply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const paidButPending = await prisma.order.findMany({
      where: {
        status: 'paid',
        NOT: { paymentStatus: 'completed' },
      },
      select: { id: true, paymentMethod: true, paymentStatus: true },
    });

    const refundedButNotMarked = await prisma.order.findMany({
      where: {
        status: 'refunded',
        NOT: { paymentStatus: 'refunded' },
      },
      select: { id: true, paymentMethod: true, paymentStatus: true },
    });

    if (!isApply) {
      // eslint-disable-next-line no-console
      console.log('Dry run only. No database writes were performed.');
      // eslint-disable-next-line no-console
      console.log(
        `Would update: completed=${paidButPending.length} refunded=${refundedButNotMarked.length}`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `Run with --apply to persist changes, e.g. "tsx services/api/src/backfill-payment-integrity.ts --apply"`,
      );
      return;
    }

    for (const o of paidButPending) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: o.id },
          data: { paymentStatus: 'completed' },
        });
        await txPaymentSidecarLoose(tx).paymentEvent.create({
          data: {
            id: randomUUID(),
            orderId: o.id,
            eventType: 'payment_backfill_completed',
            paymentMethod: o.paymentMethod,
            actorRole: 'SYSTEM',
            note: `backfill_migration from ${o.paymentStatus}`,
          },
        });
      });
    }

    for (const o of refundedButNotMarked) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: o.id },
          data: { paymentStatus: 'refunded' },
        });
        await txPaymentSidecarLoose(tx).paymentEvent.create({
          data: {
            id: randomUUID(),
            orderId: o.id,
            eventType: 'payment_backfill_refunded',
            paymentMethod: o.paymentMethod,
            actorRole: 'SYSTEM',
            note: `backfill_migration from ${o.paymentStatus}`,
          },
        });
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `Backfill applied. completed=${paidButPending.length} refunded=${refundedButNotMarked.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
