import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { applyFiltersInMemory } from '../app/common/list-filter.util';
import { STAFF_ROLES, type StaffAuthUserView, type StaffRole } from '@wrap-roll/contracts';

export type { StaffAuthUserView, StaffRole };

export type StaffListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  role?: StaffRole;
  isActive?: boolean;
  sortBy?: 'email' | 'fullName' | 'role' | 'createdAt' | 'lastSignInAt';
  sortDir?: 'asc' | 'desc';
  filters?: {
    logic?: 'AND' | 'OR';
    rules?: Array<{
      field: string;
      op: string;
      value?: string | number | boolean;
      valueTo?: string | number;
    }>;
  };
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

@Injectable()
export class SupabaseService {
  private readonly _supabase: SupabaseClient | null;

  constructor() {
    console.log('--- SUPABASE SERVICE CONSTRUCTOR ---');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const allowMockAuth =
      process.env.NODE_ENV === 'test' || process.env.ALLOW_INSECURE_MOCK_AUTH === 'true';
    
    if (supabaseUrl && supabaseKey) {
      console.log('--- SUPABASE KEYS DETECTED: INITIALIZING CLIENT ---');
      this._supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
        },
      });
    } else {
      if (!allowMockAuth) {
        throw new Error(
          'Supabase auth admin is unavailable. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        );
      }
      console.warn('--- SUPABASE KEYS MISSING: AUTH LAYER IN TEST MOCK MODE ---');
      this._supabase = null;
    }
  }

  get supabase(): SupabaseClient {
    if (!this._supabase) {
      throw new Error('Supabase client is unavailable');
    }
    return this._supabase;
  }

  async verifyToken(token: string) {
    if (!this._supabase) {
      return null;
    }
    const { data: { user }, error } = await this._supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  }

  private mapStaffUser(raw: unknown): StaffAuthUserView | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const metadata =
      r.user_metadata && typeof r.user_metadata === 'object'
        ? (r.user_metadata as Record<string, unknown>)
        : {};
    if (!r.id || !r.email) return null;
    const role = String(metadata.role ?? '').toUpperCase();
    if (!STAFF_ROLES.includes(role as StaffRole)) return null;
    return {
      id: String(r.id),
      email: String(r.email),
      role: role as StaffRole,
      fullName: String(metadata.full_name ?? ''),
      phone: String(metadata.phone ?? ''),
      isActive: metadata.is_active !== false,
      createdAt: String(r.created_at ?? ''),
      lastSignInAt: r.last_sign_in_at ? String(r.last_sign_in_at) : null,
    };
  }

  async listStaffUsers(query: StaffListQuery = {}): Promise<PaginatedResponse<StaffAuthUserView>> {
    if (!this._supabase) {
      throw new Error('Supabase auth admin is unavailable (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
    }
    const { data, error } = await this._supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const search = String(query.search ?? '').trim().toLowerCase();
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir ?? 'desc';

    let rows = (data.users ?? [])
      .map((u) => this.mapStaffUser(u))
      .filter((u): u is StaffAuthUserView => Boolean(u))
      .sort((a, b) => a.email.localeCompare(b.email));

    if (query.role) {
      rows = rows.filter((r) => r.role === query.role);
    }
    if (typeof query.isActive === 'boolean') {
      rows = rows.filter((r) => r.isActive === query.isActive);
    }
    if (search) {
      rows = rows.filter(
        (r) =>
          r.email.toLowerCase().includes(search) ||
          r.fullName.toLowerCase().includes(search) ||
          r.role.toLowerCase().includes(search),
      );
    }
    rows = applyFiltersInMemory(rows, query.filters, {
      fullName: { kind: 'string' },
      email: { kind: 'string' },
      role: { kind: 'enum' },
      isActive: { kind: 'boolean' },
      createdAt: { kind: 'date' },
      lastSignInAt: { kind: 'date' },
    });

    rows.sort((a, b) => {
      const aVal =
        sortBy === 'email'
          ? a.email
          : sortBy === 'fullName'
            ? a.fullName
            : sortBy === 'role'
              ? a.role
              : sortBy === 'lastSignInAt'
                ? a.lastSignInAt ?? ''
                : a.createdAt;
      const bVal =
        sortBy === 'email'
          ? b.email
          : sortBy === 'fullName'
            ? b.fullName
            : sortBy === 'role'
              ? b.role
              : sortBy === 'lastSignInAt'
                ? b.lastSignInAt ?? ''
                : b.createdAt;
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const total = rows.length;
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, lastPage);
    const start = (safePage - 1) * limit;
    const items = rows.slice(start, start + limit);

    return {
      items,
      meta: {
        total,
        page: safePage,
        limit,
        lastPage,
        hasNext: safePage < lastPage,
        hasPrev: safePage > 1,
      },
    };
  }

  async createStaffUser(input: {
    email: string;
    password: string;
    role: StaffRole;
    fullName: string;
    phone?: string;
  }): Promise<StaffAuthUserView> {
    if (!this._supabase) {
      throw new Error('Supabase auth admin is unavailable');
    }
    const { data, error } = await this._supabase.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      user_metadata: {
        role: input.role,
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() ?? '',
        is_active: true,
      },
    });
    if (error || !data.user) throw new Error(error?.message || 'Create user failed');
    const mapped = this.mapStaffUser(data.user);
    if (!mapped) throw new Error('Created user is not a staff role');
    return mapped;
  }

  async updateStaffUser(
    userId: string,
    input: {
      role?: StaffRole;
      fullName?: string;
      phone?: string;
      isActive?: boolean;
      password?: string;
    },
  ): Promise<StaffAuthUserView> {
    if (!this._supabase) {
      throw new Error('Supabase auth admin is unavailable');
    }
    const { data: currentData, error: currentError } = await this._supabase.auth.admin.getUserById(userId);
    if (currentError || !currentData.user) {
      throw new Error(currentError?.message || 'User not found');
    }
    const currentMeta = currentData.user.user_metadata ?? {};
    const nextMeta = {
      ...currentMeta,
      ...(input.role ? { role: input.role } : {}),
      ...(input.fullName !== undefined ? { full_name: input.fullName.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    };
    const { data, error } = await this._supabase.auth.admin.updateUserById(userId, {
      ...(input.password ? { password: input.password } : {}),
      user_metadata: nextMeta,
    });
    if (error || !data.user) throw new Error(error?.message || 'Update user failed');
    const mapped = this.mapStaffUser(data.user);
    if (!mapped) throw new Error('Updated user is not a staff role');
    return mapped;
  }

  async getStaffUserById(userId: string): Promise<StaffAuthUserView | null> {
    if (!this._supabase) return null;
    const { data, error } = await this._supabase.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    return this.mapStaffUser(data.user);
  }

  /** Lookup staff users by email (Supabase Auth); linear scan — OK for infrequent supervisor PIN flows. */
  async findStaffUserByEmail(email: string): Promise<StaffAuthUserView | null> {
    if (!this._supabase) return null;
    const normalized = email.trim().toLowerCase();
    const { data, error } = await this._supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error || !data.users?.length) return null;
    const hit = data.users.find((u) => String(u.email ?? '').toLowerCase() === normalized);
    return hit ? this.mapStaffUser(hit) : null;
  }
}
