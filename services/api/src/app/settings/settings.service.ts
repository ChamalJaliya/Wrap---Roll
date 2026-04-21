import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PublicBusinessSettings as PublicBusinessSettingsContract } from '@wrap-roll/contracts';
import { normalizeCheckoutVatRate } from '@wrap-roll/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePaymentConfig } from './payment-config';
import { computeOperationalCalendarDate } from './operational-calendar-date';
import { evaluatePublicOrderAcceptance, normalizeOperationsCalendar } from './operations-calendar-rules';
import { RequestUser } from '../../auth/current-user.decorator';
import { trackOpsActivity } from '../common/ops-activity';

const SINGLETON_ID = 'singleton';
const DEFAULT_DELIVERY_ORIGIN = {
  feeMode: 'distance',
  originLat: 6.93194,
  originLng: 79.84778,
};
type BusinessSettingsRow = {
  id: string;
  timezone: string;
  openingTimeMinutes: number;
  closingTimeMinutes: number;
  scheduleSameDayOnly: boolean;
  minLeadTimeMinutes: number;
  businessName: string;
  contactEmail: string;
  replyToEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  checkoutVatRate?: Prisma.Decimal | number | string | null;
  deliveryJson?: Prisma.JsonValue | null;
  paymentJson?: Prisma.JsonValue | null;
  operationsCalendarJson?: Prisma.JsonValue | null;
};

export type PublicBusinessSettings = PublicBusinessSettingsContract;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(): Promise<BusinessSettingsRow> {
    const existing = await this.prisma.businessSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing as unknown as BusinessSettingsRow;
    const created = await this.prisma.businessSettings.create({
      data: {
        id: SINGLETON_ID,
        deliveryJson: {
          enabled: true,
          feeFlat: 0,
          orderCutoffBeforeCloseMinutes: 60,
          ...DEFAULT_DELIVERY_ORIGIN,
          distanceBands: [
            { maxKm: 3, fee: 200 },
            { maxKm: null, fee: 400 },
          ],
        },
      },
    });
    return created as unknown as BusinessSettingsRow;
  }

  async getPublic(): Promise<PublicBusinessSettings> {
    const s = await this.getOrCreate();
    const now = new Date();
    const opsCal = normalizeOperationsCalendar(s.operationsCalendarJson ?? null);
    const acceptance = evaluatePublicOrderAcceptance({
      now,
      timezone: s.timezone,
      openingTimeMinutes: s.openingTimeMinutes,
      closingTimeMinutes: s.closingTimeMinutes,
      deliveryJson: s.deliveryJson ?? null,
      operationsCalendarJson: opsCal,
    });
    return {
      timezone: s.timezone,
      openingTimeMinutes: s.openingTimeMinutes,
      closingTimeMinutes: s.closingTimeMinutes,
      scheduleSameDayOnly: s.scheduleSameDayOnly,
      minLeadTimeMinutes: s.minLeadTimeMinutes,
      operationalCalendarDate: computeOperationalCalendarDate({
        now,
        timeZone: s.timezone,
        openingTimeMinutes: s.openingTimeMinutes,
        closingTimeMinutes: s.closingTimeMinutes,
      }),
      businessName: s.businessName,
      contactEmail: s.contactEmail,
      replyToEmail: s.replyToEmail,
      contactPhone: s.contactPhone,
      addressLine1: s.addressLine1,
      addressLine2: s.addressLine2,
      checkoutVatRate: normalizeCheckoutVatRate(s.checkoutVatRate ?? 0.15),
      deliveryJson: s.deliveryJson ?? null,
      paymentJson: s.paymentJson ?? null,
      operationsCalendarJson: opsCal,
      paymentConfig: normalizePaymentConfig(s.paymentJson ?? null),
      acceptingOrders: acceptance.accepting,
      closureReason: acceptance.closureReason,
    };
  }

  async updateAdmin(input: Partial<PublicBusinessSettings>, actor: RequestUser) {
    await this.getOrCreate();
    const data: Prisma.BusinessSettingsUpdateInput = {};
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.openingTimeMinutes !== undefined) {
      data.openingTimeMinutes = Number(input.openingTimeMinutes);
    }
    if (input.closingTimeMinutes !== undefined) {
      data.closingTimeMinutes = Number(input.closingTimeMinutes);
    }
    if (input.scheduleSameDayOnly !== undefined) {
      data.scheduleSameDayOnly = Boolean(input.scheduleSameDayOnly);
    }
    if (input.minLeadTimeMinutes !== undefined) {
      data.minLeadTimeMinutes = Number(input.minLeadTimeMinutes);
    }
    if (input.businessName !== undefined) data.businessName = input.businessName;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.replyToEmail !== undefined) data.replyToEmail = input.replyToEmail;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone;
    if (input.addressLine1 !== undefined) data.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) data.addressLine2 = input.addressLine2;
    if (input.checkoutVatRate !== undefined && input.checkoutVatRate !== null) {
      // Prisma adapter typings can lag and omit newer model fields in `BusinessSettingsUpdateInput`.
      // Write via indexable shape while still sending a valid Decimal runtime value.
      (data as Record<string, unknown>).checkoutVatRate = new Prisma.Decimal(
        String(normalizeCheckoutVatRate(input.checkoutVatRate)),
      );
    }
    if (input.deliveryJson !== undefined) {
      data.deliveryJson = input.deliveryJson as Prisma.InputJsonValue;
    }
    if (input.paymentJson !== undefined) {
      data.paymentJson = input.paymentJson as Prisma.InputJsonValue;
    }
    if (input.operationsCalendarJson !== undefined) {
      data.operationsCalendarJson = input.operationsCalendarJson as Prisma.InputJsonValue;
    }
    const updated = await this.prisma.businessSettings.update({
      where: { id: SINGLETON_ID },
      data,
    });
    await trackOpsActivity(this.prisma, {
      entityType: 'settings',
      entityId: SINGLETON_ID,
      eventType: 'settings.updated',
      summary: 'Business settings updated',
      actor,
      metadataJson: {
        changed: Object.keys(data),
      },
    });
    return updated;
  }
}

