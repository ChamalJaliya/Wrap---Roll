import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Courier } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResponse, StaffAuthUserView, StaffListQuery, StaffRole, SupabaseService } from '../../auth';
import { RequestUser } from '../../auth/current-user.decorator';
import { trackOpsActivity } from '../common/ops-activity';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  private async audit(
    actor: RequestUser,
    targetUserId: string,
    targetEmail: string,
    action: string,
    details?: Record<string, unknown>,
  ) {
    await this.prisma.staffAuditLog.create({
      data: {
        actorUserId: actor.sub,
        actorEmail: actor.email,
        targetUserId,
        targetEmail,
        action,
        detailsJson: (details as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async getStaffUsers(query: StaffListQuery): Promise<PaginatedResponse<StaffAuthUserView>> {
    return this.supabaseService.listStaffUsers(query);
  }

  async bulkUpdateStaffUsers(
    actor: RequestUser,
    input: {
      userIds: string[];
      action: 'setActive' | 'setRole';
      isActive?: boolean;
      role?: StaffRole;
    },
  ): Promise<{ updated: StaffAuthUserView[]; failed: { userId: string; reason: string }[] }> {
    const updated: StaffAuthUserView[] = [];
    const failed: { userId: string; reason: string }[] = [];

    for (const userId of input.userIds) {
      try {
        const next =
          input.action === 'setRole'
            ? await this.supabaseService.updateStaffUser(userId, { role: input.role })
            : await this.supabaseService.updateStaffUser(userId, { isActive: input.isActive });

        updated.push(next);
        await this.audit(actor, next.id, next.email, 'STAFF_USER_BULK_UPDATED', {
          action: input.action,
          role: input.role,
          isActive: input.isActive,
        });
      } catch (error) {
        failed.push({
          userId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { updated, failed };
  }

  async createStaffUser(input: {
    email: string;
    password: string;
    role: StaffRole;
    fullName: string;
    phone?: string;
  }, actor: RequestUser): Promise<StaffAuthUserView> {
    const created = await this.supabaseService.createStaffUser(input);
    await this.audit(actor, created.id, created.email, 'STAFF_USER_CREATED', {
      role: created.role,
      fullName: created.fullName,
      phone: created.phone,
      isActive: created.isActive,
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'staff_user',
      entityId: created.id,
      eventType: 'staff.user_created',
      summary: `Staff user created (${created.role})`,
      actor,
      metadataJson: {
        role: created.role,
        isActive: created.isActive,
      },
    });
    return created;
  }

  async updateStaffUser(
    id: string,
    input: {
      role?: StaffRole;
      fullName?: string;
      phone?: string;
      isActive?: boolean;
      password?: string;
    },
    actor: RequestUser,
  ): Promise<StaffAuthUserView> {
    const updated = await this.supabaseService.updateStaffUser(id, input);
    await this.audit(actor, updated.id, updated.email, 'STAFF_USER_UPDATED', {
      role: updated.role,
      fullName: updated.fullName,
      phone: updated.phone,
      isActive: updated.isActive,
      passwordReset: Boolean(input.password),
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'staff_user',
      entityId: updated.id,
      eventType: 'staff.user_updated',
      summary: 'Staff user updated',
      actor,
      metadataJson: {
        role: updated.role,
        isActive: updated.isActive,
        passwordReset: Boolean(input.password),
      },
    });
    return updated;
  }

  async getAuditLogs(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return this.prisma.staffAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }

  async getCouriers(): Promise<Courier[]> {
    return this.prisma.courier.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getCourierQueue(): Promise<Courier[]> {
    return this.prisma.courier.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCourier(input: { name: string; phone: string }, actor: RequestUser): Promise<Courier> {
    const created = await this.prisma.courier.create({
      data: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        isActive: true,
      },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'courier',
      entityId: created.id,
      eventType: 'staff.courier_created',
      summary: 'Courier created',
      actor,
      metadataJson: {
        name: created.name,
        isActive: created.isActive,
      },
    });
    return created;
  }

  async toggleCourierStatus(id: string, isActive: boolean, actor: RequestUser): Promise<Courier> {
    const courier = await this.prisma.courier.findUnique({ where: { id } });
    if (!courier) {
      throw new NotFoundException('Courier not found');
    }
    const updated = await this.prisma.courier.update({
      where: { id },
      data: { isActive },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'courier',
      entityId: updated.id,
      eventType: 'staff.courier_status_changed',
      summary: `Courier ${isActive ? 'activated' : 'deactivated'}`,
      actor,
      metadataJson: {
        name: updated.name,
        isActive: updated.isActive,
      },
    });
    return updated;
  }

  async validateCourier(id: string): Promise<Courier> {
    const courier = await this.prisma.courier.findUnique({ where: { id } });
    if (!courier) {
      throw new NotFoundException(`Courier with ID ${id} not found`);
    }
    if (!courier.isActive) {
      throw new ForbiddenException(`Courier ${courier.name} is currently inactive`);
    }
    return courier;
  }
}
