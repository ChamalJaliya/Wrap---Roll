import type { Prisma } from '@prisma/client';
import { SHOPPER_ROLE } from '@wrap-roll/contracts';
import type { RequestUser } from '../../auth/current-user.decorator';

type OpsActivityApp = 'client' | 'cashier' | 'kitchen' | 'delivery' | 'admin' | 'system';

function appFromRole(role?: string | null): OpsActivityApp {
  const normalized = String(role ?? '').toUpperCase();
  if (normalized === 'CASHIER') return 'cashier';
  if (normalized === 'KITCHEN') return 'kitchen';
  if (normalized === 'COURIER') return 'delivery';
  if (normalized === SHOPPER_ROLE) return 'client';
  if (normalized === 'ADMIN') return 'admin';
  return 'system';
}

type OpsActivitySidecar = {
  opsActivityEvent: {
    create(args: {
      data: {
        app: string;
        entityType: string;
        entityId: string;
        eventType: string;
        summary: string;
        actorUserId?: string | null;
        actorName?: string | null;
        actorRole?: string | null;
        actorEmail?: string | null;
        metadataJson?: Prisma.InputJsonValue | Prisma.DecimalJsLike | null;
      };
    }): Promise<unknown>;
  };
};

export async function trackOpsActivity(
  client: unknown,
  args: {
    entityType: string;
    entityId: string;
    eventType: string;
    summary: string;
    actor?: RequestUser | null;
    app?: OpsActivityApp;
    metadataJson?: Prisma.InputJsonValue | null;
  },
) {
  const sidecar = client as OpsActivitySidecar;
  await sidecar.opsActivityEvent.create({
    data: {
      app: args.app ?? appFromRole(args.actor?.role),
      entityType: args.entityType,
      entityId: args.entityId,
      eventType: args.eventType,
      summary: args.summary,
      actorUserId: args.actor?.sub ?? null,
      actorName: args.actor?.fullName ?? null,
      actorRole: args.actor?.role ?? null,
      actorEmail: args.actor?.email ?? null,
      metadataJson: args.metadataJson ?? null,
    },
  });
}
