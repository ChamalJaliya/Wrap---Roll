import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { type CustomerAddress, type SavedPaymentToken } from '@wrap-roll/contracts';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  private asNullableNumber(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private mapAddressRow<
    T extends {
      id: string;
      label: string;
      addressLine1: string;
      addressLine2?: string | null;
      city: string;
      postalCode?: string | null;
      isDefault: boolean;
      createdAt?: Date;
      updatedAt?: Date;
      customerId?: string;
    },
  >(row: T): T & { latitude: number | null; longitude: number | null } {
    const record = row as unknown as Record<string, unknown>;
    return {
      ...row,
      latitude: this.asNullableNumber(record.latitude),
      longitude: this.asNullableNumber(record.longitude),
    };
  }

  normalizeEmail(raw?: string | null): string | null {
    if (raw == null || typeof raw !== 'string') return null;
    const s = raw.trim().toLowerCase();
    return s.length > 0 ? s : null;
  }

  /** Strip spaces; keep digits and leading + for dial strings */
  normalizePhone(raw?: string | null): string | null {
    if (raw == null || typeof raw !== 'string') return null;
    const s = raw.replace(/\s+/g, '').trim();
    if (!s) return null;
    return s;
  }

  /** Digits-only form for matching (duplicate guard, phone verification). */
  normalizePhoneDigits(raw?: string | null): string | null {
    const n = this.normalizePhone(raw);
    if (!n) return null;
    const digits = n.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
  }

  /**
   * Idempotent: links exactly one Prisma Customer to this Supabase user.
   * Merges existing guest rows by email or phone; rejects if identifiers belong to another account.
   */
  async syncCustomerFromAuth(input: {
    supabaseUserId: string;
    email: string;
    fullName?: string;
    phone?: string | null;
  }) {
    const emailNorm = input.email.toLowerCase().trim();
    if (!emailNorm) {
      throw new ConflictException('Email is required to sync storefront profile');
    }

    const phoneNorm = this.normalizePhone(input.phone);
    const name = (
      input.fullName?.trim() ||
      emailNorm.split('@')[0] ||
      'Customer'
    ).slice(0, 200);

    const bySub = await this.prisma.customer.findUnique({
      where: { supabaseUserId: input.supabaseUserId },
    });
    if (bySub) {
      return this.prisma.customer.update({
        where: { id: bySub.id },
        data: {
          email: emailNorm,
          name,
          ...(phoneNorm ? { phone: phoneNorm } : {}),
        },
      });
    }

    const byEmail = await this.prisma.customer.findUnique({
      where: { email: emailNorm },
    });
    if (byEmail) {
      if (
        byEmail.supabaseUserId &&
        byEmail.supabaseUserId !== input.supabaseUserId
      ) {
        throw new ConflictException(
          'This email is already linked to another login account.',
        );
      }
      return this.prisma.customer.update({
        where: { id: byEmail.id },
        data: {
          supabaseUserId: input.supabaseUserId,
          name,
          ...(phoneNorm ? { phone: phoneNorm } : {}),
        },
      });
    }

    if (phoneNorm) {
      const byPhone = await this.prisma.customer.findUnique({
        where: { phone: phoneNorm },
      });
      if (byPhone) {
        if (
          byPhone.supabaseUserId &&
          byPhone.supabaseUserId !== input.supabaseUserId
        ) {
          throw new ConflictException(
            'This phone number is already linked to another account.',
          );
        }
        return this.prisma.customer.update({
          where: { id: byPhone.id },
          data: {
            supabaseUserId: input.supabaseUserId,
            email: emailNorm,
            name,
          },
        });
      }
    }

    try {
      return await this.prisma.customer.create({
        data: {
          supabaseUserId: input.supabaseUserId,
          email: emailNorm,
          phone: phoneNorm,
          name,
        },
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        throw new ConflictException(
          'Email or phone is already in use by another account.',
        );
      }
      throw e;
    }
  }

  async requireCustomerRowForAuth(user: {
    sub: string;
    email: string;
    fullName?: string;
    phone?: string;
  }) {
    return this.syncCustomerFromAuth({
      supabaseUserId: user.sub,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
    });
  }

  /**
   * Guest / POS checkout: one row per phone; anonymous orders use null phone (many rows allowed).
   * Optional `email` is merged when safe (unique); never overwrites an existing different email.
   */
  async findOrCreateGuestByPhone(
    name: string,
    phone?: string | null,
    email?: string | null,
  ) {
    const phoneNorm = this.normalizePhone(phone);
    const emailNorm = this.normalizeEmail(email);

    if (!phoneNorm) {
      if (emailNorm) {
        const byEmail = await this.prisma.customer.findUnique({
          where: { email: emailNorm },
        });
        if (byEmail) {
          if (name && byEmail.name !== name) {
            return this.prisma.customer.update({
              where: { id: byEmail.id },
              data: { name },
            });
          }
          return byEmail;
        }
      }
      try {
        return await this.prisma.customer.create({
          data: {
            name: name || 'Guest',
            ...(emailNorm ? { email: emailNorm } : {}),
          },
        });
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === 'P2002' && emailNorm) {
          const retry = await this.prisma.customer.findUnique({
            where: { email: emailNorm },
          });
          if (retry) return retry;
        }
        throw e;
      }
    }

    const existing = await this.prisma.customer.findUnique({
      where: { phone: phoneNorm },
    });
    if (existing) {
      const data: { name?: string; email?: string } = {};
      if (name && existing.name !== name) data.name = name;
      if (emailNorm && !existing.email) {
        const clash = await this.prisma.customer.findFirst({
          where: { email: emailNorm, NOT: { id: existing.id } },
          select: { id: true },
        });
        if (!clash) data.email = emailNorm;
      }
      if (Object.keys(data).length) {
        try {
          return await this.prisma.customer.update({
            where: { id: existing.id },
            data,
          });
        } catch (e: unknown) {
          const code = (e as { code?: string })?.code;
          if (code === 'P2002') return existing;
          throw e;
        }
      }
      return existing;
    }

    if (emailNorm) {
      const byEmail = await this.prisma.customer.findUnique({
        where: { email: emailNorm },
      });
      if (byEmail) {
        return this.prisma.customer.update({
          where: { id: byEmail.id },
          data: {
            name: name || byEmail.name || 'Guest',
            phone: phoneNorm,
          },
        });
      }
    }

    try {
      return await this.prisma.customer.create({
        data: {
          name: name || 'Guest',
          phone: phoneNorm,
          ...(emailNorm ? { email: emailNorm } : {}),
        },
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002' && emailNorm) {
        return this.prisma.customer.create({
          data: {
            name: name || 'Guest',
            phone: phoneNorm,
          },
        });
      }
      throw e;
    }
  }

  /** @deprecated Prefer findOrCreateGuestByPhone for checkout */
  async findOrCreateCustomer(phone?: string, name?: string) {
    return this.findOrCreateGuestByPhone(name || 'Guest', phone, undefined);
  }

  async getCustomerHistory(id: string) {
    return await this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: true,
          },
          orderBy: {
            placedAt: 'desc',
          },
        },
      },
    });
  }

  async updateProfile(id: string, name?: string, phone?: string) {
    const phoneNorm =
      phone !== undefined ? this.normalizePhone(phone) : undefined;

    if (phoneNorm) {
      const clash = await this.prisma.customer.findFirst({
        where: { phone: phoneNorm, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException(
          'This phone number is already used on another account.',
        );
      }
    }

    const data: { name?: string; phone?: string | null } = {};
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phoneNorm;

    return await this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  // ── Address Book ───────────────────────────────────────────────────────────

  async getAddressBook(customerId: string) {
    const rows = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: { isDefault: 'desc' },
    });
    return rows.map((a) => this.mapAddressRow(a));
  }

  async saveAddress(customerId: string, data: CustomerAddress) {
    const { id, isDefault, ...rest } = data;
    const latitude = this.asNullableNumber(rest.latitude);
    const longitude = this.asNullableNumber(rest.longitude);
    const payload = {
      ...rest,
      latitude,
      longitude,
      geocodeSource: rest.geocodeSource ?? null,
      geocodeAccuracy: rest.geocodeAccuracy ?? null,
      isDefault,
    };

    if (isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (id) {
      const updated = await this.prisma.customerAddress.update({
        where: { id },
        data: payload,
      });
      return this.mapAddressRow(updated);
    }

    const created = await this.prisma.customerAddress.create({
      data: {
        ...payload,
        customerId,
      },
    });
    return this.mapAddressRow(created);
  }

  // ── Masked Vault (Saved Payments) ──────────────────────────────────────────

  async getSavedPayments(customerId: string) {
    return await this.prisma.savedPaymentToken.findMany({
      where: { customerId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async savePaymentToken(
    customerId: string,
    data: SavedPaymentToken,
  ) {
    if (data.isDefault) {
      await this.prisma.savedPaymentToken.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    if (data.id) {
      const existing = await this.prisma.savedPaymentToken.findFirst({
        where: { id: data.id, customerId },
        select: { id: true },
      });
      if (!existing) {
        throw new ConflictException('Saved card not found for this customer.');
      }
      return await this.prisma.savedPaymentToken.update({
        where: { id: data.id },
        data: {
          token: data.token,
          cardBrand: data.cardBrand,
          last4: data.last4,
          isDefault: data.isDefault || false,
        },
      });
    }

    return await this.prisma.savedPaymentToken.create({
      data: {
        token: data.token,
        cardBrand: data.cardBrand,
        last4: data.last4,
        isDefault: data.isDefault || false,
        customerId,
      },
    });
  }

  async lookupIntakeByPhone(phone: string) {
    const digits = this.normalizePhoneDigits(phone);
    if (!digits || digits.length < 7) {
      return { found: false as const };
    }

    const customers = await this.prisma.customer.findMany({
      where: { phone: { contains: digits } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const customer =
      customers.find((c) => this.normalizePhoneDigits(c.phone) === digits) ?? customers[0] ?? null;

    const latestOrderByPhone = await this.prisma.order.findFirst({
      where: { customerPhone: { contains: digits } },
      orderBy: { placedAt: 'desc' },
      select: { deliveryAddress: true, placedAt: true },
    });

    if (!customer) {
      return {
        found: false as const,
        inferredAddress: latestOrderByPhone?.deliveryAddress ?? null,
      };
    }

    const addresses = await this.getAddressBook(customer.id);
    const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
    return {
      found: true as const,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        type: customer.supabaseUserId ? 'client' : 'guest',
      },
      addresses: addresses.map((a) => ({
        id: a.id,
        label: a.label,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2,
        city: a.city,
        postalCode: a.postalCode,
        latitude: this.asNullableNumber(a.latitude),
        longitude: this.asNullableNumber(a.longitude),
        isDefault: a.isDefault,
      })),
      suggestedAddress:
        [defaultAddress?.addressLine1, defaultAddress?.addressLine2, defaultAddress?.city]
          .filter(Boolean)
          .join(', ') || latestOrderByPhone?.deliveryAddress || null,
    };
  }

  async listCustomersAdmin(input: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'createdAt' | 'name' | 'email' | 'phone';
    sortDir?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(input.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(input.limit ?? 20)));
    const skip = (page - 1) * limit;
    const search = String(input.search ?? '').trim();
    const sortBy = input.sortBy ?? 'createdAt';
    const sortDir = input.sortDir ?? 'desc';

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortDir },
        include: {
          _count: { select: { orders: true, addresses: true, savedPayments: true } },
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              addressLine1: true,
              addressLine2: true,
              city: true,
              postalCode: true,
              isDefault: true,
            },
          },
          orders: {
            orderBy: { placedAt: 'desc' },
            take: 1,
            select: { id: true, status: true, placedAt: true, total: true },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        supabaseUserId: c.supabaseUserId,
        createdAt: c.createdAt,
        orderCount: c._count.orders,
        addressCount: c._count.addresses,
        savedPaymentCount: c._count.savedPayments,
        defaultAddress: c.addresses[0]
          ? [c.addresses[0].addressLine1, c.addresses[0].addressLine2, c.addresses[0].city, c.addresses[0].postalCode]
              .filter(Boolean)
              .join(', ')
          : null,
        latestOrder: c.orders[0]
          ? {
              id: c.orders[0].id,
              status: c.orders[0].status,
              placedAt: c.orders[0].placedAt,
              total: c.orders[0].total,
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.max(1, Math.ceil(total / limit)),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async getCustomerAdmin(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        savedPayments: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        orders: {
          orderBy: { placedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            placedAt: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            total: true,
            fulfillmentType: true,
          },
        },
        _count: { select: { orders: true, addresses: true, savedPayments: true } },
      },
    });
  }

  async updateCustomerAdmin(
    id: string,
    patch: { name?: string; phone?: string | null; email?: string | null },
  ) {
    const phoneNorm =
      patch.phone !== undefined ? this.normalizePhone(patch.phone) : undefined;
    const emailNorm =
      patch.email !== undefined ? this.normalizeEmail(patch.email) : undefined;
    const nameNorm = patch.name !== undefined ? patch.name.trim() : undefined;

    if (phoneNorm) {
      const clash = await this.prisma.customer.findFirst({
        where: { phone: phoneNorm, NOT: { id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('This phone number is already used by another customer.');
      }
    }
    if (emailNorm) {
      const clash = await this.prisma.customer.findFirst({
        where: { email: emailNorm, NOT: { id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('This email is already used by another customer.');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...(nameNorm !== undefined ? { name: nameNorm || 'Guest' } : {}),
        ...(patch.phone !== undefined ? { phone: phoneNorm } : {}),
        ...(patch.email !== undefined ? { email: emailNorm } : {}),
      },
    });
  }
}
