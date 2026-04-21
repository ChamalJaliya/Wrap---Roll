import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../../auth/current-user.decorator';
import { trackOpsActivity } from '../common/ops-activity';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Validate coupon code against subtotal and optional customer history.
   */
  async validateCoupon(
    code: string,
    subtotal: number,
    customerId?: string,
    customerPhone?: string,
  ) {
    const normalized = String(code ?? '')
      .trim()
      .toUpperCase();
    if (!normalized) {
      return { discountAmount: 0, valid: false, message: 'Invalid coupon code' };
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normalized },
    });

    if (!coupon) {
      return { discountAmount: 0, valid: false, message: 'Invalid coupon code' };
    }

    if (!coupon.isActive) {
      return { discountAmount: 0, valid: false, message: 'Coupon is currently inactive' };
    }

    if (coupon.expiryDate && coupon.expiryDate < new Date()) {
      return { discountAmount: 0, valid: false, message: 'Coupon has expired' };
    }

    const minSub = coupon.minSubtotal != null ? Number(coupon.minSubtotal) : null;
    if (minSub != null && subtotal <= minSub) {
      return {
        discountAmount: 0,
        valid: false,
        message: `Order subtotal must be greater than ${minSub} for this coupon`,
      };
    }

    if (coupon.firstOrderOnly) {
      if (!customerId && !customerPhone) {
        return {
          discountAmount: 0,
          valid: false,
          message: 'Sign in or provide a phone number to use this coupon',
        };
      }
      const previousOrderCount = await this.prisma.order.count({
        where: {
          OR: [{ customerId: customerId || undefined }, { customerPhone: customerPhone || undefined }],
          status: { not: 'cancelled' },
        },
      });
      if (previousOrderCount > 0) {
        return {
          discountAmount: 0,
          valid: false,
          message: 'This coupon is only available for first-time orders',
        };
      }
    }

    const pct = Number(coupon.discountPercent);
    let discountAmount = subtotal * pct;
    const maxAllowed = subtotal * 0.5;

    if (discountAmount > maxAllowed) {
      this.logger.warn(`Cap violation for ${normalized}: calculated ${discountAmount}, capped at ${maxAllowed}`);
      discountAmount = maxAllowed;
    }

    return {
      discountAmount: Math.round(discountAmount * 100) / 100,
      valid: true,
      message: 'Coupon applied successfully',
    };
  }

  async validateDiscountCode(code: string, subtotal: number) {
    const res = await this.validateCoupon(code, subtotal);
    return { discountAmount: res.discountAmount };
  }

  async listAdmin() {
    return this.prisma.coupon.findMany({ orderBy: { code: 'asc' } });
  }

  async createAdmin(body: {
    code: string;
    discountPercent: number;
    minSubtotal?: number | null;
    firstOrderOnly?: boolean;
    isActive?: boolean;
    expiryDate?: string | null;
  }, actor: RequestUser) {
    const code = String(body.code ?? '')
      .trim()
      .toUpperCase();
    if (!code) throw new BadRequestException('Code is required');
    const discountPercent = Number(body.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 1) {
      throw new BadRequestException('discountPercent must be between 0 and 1');
    }
    const created = await this.prisma.coupon.create({
      data: {
        code,
        discountPercent,
        minSubtotal:
          body.minSubtotal != null && body.minSubtotal !== undefined
            ? new Prisma.Decimal(String(body.minSubtotal))
            : null,
        firstOrderOnly: Boolean(body.firstOrderOnly),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        expiryDate:
          body.expiryDate && String(body.expiryDate).trim().length > 0
            ? new Date(body.expiryDate)
            : null,
      },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'coupon',
      entityId: created.id,
      eventType: 'coupon.created',
      summary: `Coupon ${created.code} created`,
      actor,
      metadataJson: {
        code: created.code,
        isActive: created.isActive,
      },
    });
    return created;
  }

  async updateAdmin(
    id: string,
    body: Partial<{
      discountPercent: number;
      minSubtotal: number | null;
      firstOrderOnly: boolean;
      isActive: boolean;
      expiryDate: string | null;
    }>,
    actor: RequestUser,
  ) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(body.discountPercent !== undefined
          ? {
              discountPercent: (() => {
                const n = Number(body.discountPercent);
                if (!Number.isFinite(n) || n < 0 || n > 1) {
                  throw new BadRequestException('discountPercent must be between 0 and 1');
                }
                return n;
              })(),
            }
          : {}),
        ...(body.minSubtotal !== undefined
          ? {
              minSubtotal:
                body.minSubtotal === null
                  ? null
                  : new Prisma.Decimal(String(body.minSubtotal)),
            }
          : {}),
        ...(body.firstOrderOnly !== undefined ? { firstOrderOnly: Boolean(body.firstOrderOnly) } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.expiryDate !== undefined
          ? {
              expiryDate:
                body.expiryDate && String(body.expiryDate).trim().length > 0
                  ? new Date(body.expiryDate)
                  : null,
            }
          : {}),
      },
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'coupon',
      entityId: updated.id,
      eventType: 'coupon.updated',
      summary: `Coupon ${updated.code} updated`,
      actor,
      metadataJson: {
        changed: Object.keys(body),
        isActive: updated.isActive,
      },
    });
    return updated;
  }

  async deleteAdmin(id: string, actor: RequestUser) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.delete({ where: { id } });
    await trackOpsActivity(this.prisma, {
      entityType: 'coupon',
      entityId: id,
      eventType: 'coupon.deleted',
      summary: `Coupon ${existing.code} deleted`,
      actor,
      metadataJson: {
        code: existing.code,
      },
    });
    return { ok: true };
  }
}
