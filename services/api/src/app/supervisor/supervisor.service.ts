import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../../auth/supabase.service';
import type { RequestUser } from '../../auth/current-user.decorator';
import { hashSupervisorPin, verifySupervisorPin } from './supervisor-pin.crypto';

const ELEVATION_TTL_MS = 3 * 60 * 1000;
const MIN_PIN_LENGTH = 6;
const DEFAULT_SCOPE = 'privileged_operations';

/** Runtime delegates exist after `prisma generate`; widen when IDE client typings lag behind schema. */
type PrismaWithSupervisorTables = PrismaService &
  Record<
    'staffSupervisorPin' | 'supervisorElevationSession' | 'supervisorElevationAudit',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- delegate surface matches generated Prisma client
    any
  >;

@Injectable()
export class SupervisorService {
  private readonly logger = new Logger(SupervisorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * `PrismaService` extends `PrismaClient` at runtime; cast ensures supervisor tables are visible when
   * generated typings are stale in the workspace.
   */
  private get db(): PrismaWithSupervisorTables {
    return this.prisma as PrismaWithSupervisorTables;
  }

  async setSupervisorPin(actor: RequestUser, staffUserId: string, plainPin: string): Promise<{ ok: true }> {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can set supervisor PINs.');
    }
    const pin = typeof plainPin === 'string' ? plainPin.trim() : '';
    if (pin.length < MIN_PIN_LENGTH) {
      throw new BadRequestException(`PIN must be at least ${MIN_PIN_LENGTH} characters.`);
    }
    const target = await this.supabaseService.getStaffUserById(staffUserId.trim());
    if (!target) {
      throw new BadRequestException('Staff user not found.');
    }
    if (target.role !== 'ADMIN') {
      throw new BadRequestException('Supervisor PIN can only be assigned to ADMIN accounts.');
    }
    const pinHash = await hashSupervisorPin(pin);
    await this.db.staffSupervisorPin.upsert({
      where: { staffUserId: target.id },
      create: { staffUserId: target.id, pinHash },
      update: { pinHash },
    });
    await this.db.supervisorElevationAudit.create({
      data: {
        cashierUserId: actor.sub,
        cashierEmail: actor.email,
        supervisorUserId: target.id,
        supervisorEmail: target.email,
        action: 'SUPERVISOR_PIN_SET',
        scope: null,
        success: true,
        detailJson: {},
      },
    });
    this.logger.log(`Supervisor PIN set for staff ${target.id} by ${actor.sub}`);
    return { ok: true };
  }

  async challenge(
    cashier: RequestUser,
    body: { supervisorEmail: string; pin: string; scope?: string },
  ): Promise<{ elevationToken: string; expiresAt: string; scope: string }> {
    const email = typeof body.supervisorEmail === 'string' ? body.supervisorEmail.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    const scope =
      typeof body.scope === 'string' && body.scope.trim().length > 0
        ? body.scope.trim()
        : DEFAULT_SCOPE;

    if (!email || !pin) {
      await this.auditFailure(cashier, null, null, scope, 'CHALLENGE_DENIED', 'missing_fields');
      throw new BadRequestException('Supervisor email and PIN are required.');
    }

    const supervisor = await this.supabaseService.findStaffUserByEmail(email);
    if (!supervisor || supervisor.role !== 'ADMIN') {
      await this.auditFailure(cashier, null, email, scope, 'CHALLENGE_DENIED', 'invalid_supervisor');
      // Same client-facing message as bad PIN — avoids supervisor account enumeration.
      throw new BadRequestException('Supervisor authentication failed.');
    }

    const row = await this.db.staffSupervisorPin.findUnique({
      where: { staffUserId: supervisor.id },
    });
    if (!row) {
      await this.auditFailure(cashier, supervisor.id, email, scope, 'CHALLENGE_DENIED', 'no_pin_set');
      throw new BadRequestException('Supervisor authentication failed.');
    }

    const pinOk = await verifySupervisorPin(pin, row.pinHash);
    if (!pinOk) {
      await this.auditFailure(cashier, supervisor.id, email, scope, 'CHALLENGE_DENIED', 'bad_pin');
      throw new BadRequestException('Supervisor authentication failed.');
    }

    const elevationToken = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + ELEVATION_TTL_MS);

    await this.db.supervisorElevationSession.create({
      data: {
        elevationToken,
        cashierUserId: cashier.sub,
        supervisorUserId: supervisor.id,
        scope,
        expiresAt,
      },
    });

    await this.db.supervisorElevationAudit.create({
      data: {
        cashierUserId: cashier.sub,
        cashierEmail: cashier.email,
        supervisorUserId: supervisor.id,
        supervisorEmail: supervisor.email,
        action: 'SUPERVISOR_CHALLENGE_OK',
        scope,
        success: true,
        detailJson: {},
      },
    });

    this.logger.log(
      `Supervisor elevation issued cashier=${cashier.sub} supervisor=${supervisor.id} scope=${scope}`,
    );

    return {
      elevationToken,
      expiresAt: expiresAt.toISOString(),
      scope,
    };
  }

  async validateElevationSession(
    elevationToken: string,
    cashierUserId: string,
    requiredScope: string,
  ): Promise<boolean> {
    const row = await this.db.supervisorElevationSession.findUnique({
      where: { elevationToken },
    });
    if (!row) return false;
    if (row.cashierUserId !== cashierUserId) return false;
    if (row.expiresAt.getTime() <= Date.now()) return false;
    if (row.consumedAt != null) return false;
    if (row.scope !== requiredScope) return false;
    return true;
  }

  private async auditFailure(
    cashier: RequestUser,
    supervisorUserId: string | null,
    supervisorEmail: string | null,
    scope: string,
    action: string,
    reason: string,
  ): Promise<void> {
    await this.db.supervisorElevationAudit.create({
      data: {
        cashierUserId: cashier.sub,
        cashierEmail: cashier.email,
        supervisorUserId,
        supervisorEmail,
        action,
        scope,
        success: false,
        detailJson: { reason },
      },
    });
  }
}
