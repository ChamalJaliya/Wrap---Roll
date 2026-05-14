'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChefHat, Shield, Truck, UserCheck, Users, Wallet } from 'lucide-react';
import api from '../../services/api';
import { type StaffRole } from '@wrap-roll/contracts';
import {
  AvatarCell,
  Badge,
  Button,
  DataPanel,
  Input,
  Label,
  MetricCard,
  NativeSelect,
  PageStack,
  SharedDataGrid,
  SharedDataGridColumn,
  GridFilterGroup,
  GridFilterField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@wrap-roll/shared-ui';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { adminPageContainerClass, adminPageRootClass } from '../../lib/admin-ui-contract';

type StaffUser = {
  id: string;
  email: string;
  role: StaffRole;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

type StaffAuditLog = {
  id: string;
  actorEmail: string;
  targetEmail: string;
  action: string;
  detailsJson?: Record<string, unknown>;
  createdAt: string;
};

type StaffListResponse = {
  items: StaffUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type StaffQuery = {
  page: number;
  pageSize: number;
  search: string;
  role?: StaffRole;
  isActive?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: GridFilterGroup;
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'CASHIER' as StaffRole,
    fullName: '',
    phone: '',
  });
  const [roleEdits, setRoleEdits] = useState<Record<string, StaffRole>>({});
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([]);
  const [query, setQuery] = useState<StaffQuery>({
    page: 1,
    pageSize: 20,
    search: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const activeCount = useMemo(() => staff.filter((s) => s.isActive).length, [staff]);
  const [catalogLetter, setCatalogLetter] = useState<string>('ALL');
  const byRole = useMemo(() => {
    return {
      CASHIER: staff.filter((s) => s.role === 'CASHIER').length,
      KITCHEN: staff.filter((s) => s.role === 'KITCHEN').length,
      COURIER: staff.filter((s) => s.role === 'COURIER').length,
      ADMIN: staff.filter((s) => s.role === 'ADMIN').length,
    };
  }, [staff]);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const staffCatalog = useMemo(() => {
    return staff.filter((s) => {
      if (catalogLetter === 'ALL') return true;
      const initial = String(s.fullName || s.email || '').trim().charAt(0).toUpperCase();
      return initial === catalogLetter;
    });
  }, [staff, catalogLetter]);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('limit', String(query.pageSize));
      if (query.search.trim()) params.set('search', query.search.trim());
      if (query.role) params.set('role', query.role);
      if (typeof query.isActive === 'boolean') params.set('isActive', String(query.isActive));
      if (query.sortBy) params.set('sortBy', query.sortBy);
      if (query.sortDir) params.set('sortDir', query.sortDir);
      if (query.filters?.rules?.length) {
        params.set('filters', JSON.stringify(query.filters));
      }

      const response = await api.get<StaffListResponse>(`/staff/users?${params.toString()}`);
      setStaff(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.meta?.total ?? 0));
      const auditResponse = await api.get('/staff/audit-logs?limit=30');
      setAuditLogs(Array.isArray(auditResponse.data) ? auditResponse.data : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to load staff';
      setError(msg);
      setStaff([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.pageSize, query.search, query.role, query.isActive, query.sortBy, query.sortDir, query.filters]);

  const createStaffUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!newUser.email.trim() || !newUser.password.trim() || !newUser.fullName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/staff/users', {
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password.trim(),
        role: newUser.role,
        fullName: newUser.fullName.trim(),
        phone: newUser.phone.trim() || undefined,
      });
      setNewUser({
        email: '',
        password: '',
        role: 'CASHIER',
        fullName: '',
        phone: '',
      });
      await fetchStaff();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to create staff user';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item: StaffUser) => {
    setError(null);
    try {
      await api.patch(`/staff/users/${item.id}`, { isActive: !item.isActive });
      setStaff((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isActive: !row.isActive } : row)),
      );
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to update staff status';
      setError(msg);
    }
  };

  const saveRole = async (item: StaffUser) => {
    const nextRole = roleEdits[item.id];
    if (!nextRole || nextRole === item.role) return;
    setError(null);
    try {
      await api.patch(`/staff/users/${item.id}`, { role: nextRole });
      setStaff((prev) => prev.map((row) => (row.id === item.id ? { ...row, role: nextRole } : row)));
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to update user role';
      setError(msg);
    }
  };

  const resetPassword = async (item: StaffUser) => {
    const tempPassword = window.prompt(`Set a new password for ${item.email}`, 'pass123');
    if (!tempPassword) return;
    setError(null);
    try {
      await api.patch(`/staff/users/${item.id}`, { password: tempPassword });
      await fetchStaff();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to reset password';
      setError(msg);
    }
  };

  const applyBulk = async (
    action: 'setActive' | 'setRole',
    users: StaffUser[],
    payload: { isActive?: boolean; role?: StaffRole },
  ) => {
    if (users.length === 0) return;
    setError(null);
    try {
      await api.post('/staff/users/bulk', {
        userIds: users.map((u) => u.id),
        action,
        ...payload,
      });
      await fetchStaff();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Failed to apply bulk action';
      setError(msg);
    }
  };

  const columns: SharedDataGridColumn<StaffUser>[] = [
    {
      id: 'fullName',
      label: 'Name',
      sortable: true,
      hideable: false,
      render: (row) => <AvatarCell name={row.fullName} subtitle={row.email} />,
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
      render: (row) => row.email,
    },
    {
      id: 'role',
      label: 'Role',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <NativeSelect
            label=""
            value={roleEdits[row.id] ?? row.role}
            onChange={(e) =>
              setRoleEdits((prev) => ({
                ...prev,
                [row.id]: e.target.value as StaffRole,
              }))
            }
          >
            <option value="ADMIN">ADMIN</option>
            <option value="CASHIER">CASHIER</option>
            <option value="KITCHEN">KITCHEN</option>
            <option value="COURIER">COURIER</option>
          </NativeSelect>
          <Button size="sm" variant="outline" onClick={() => saveRole(row)}>
            Save
          </Button>
        </div>
      ),
    },
    {
      id: 'phone',
      label: 'Phone',
      sortable: false,
      render: (row) => row.phone || '-',
    },
    {
      id: 'isActive',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'secondary'}>
          {row.isActive ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      ),
    },
    {
      id: 'lastSignInAt',
      label: 'Last Sign In',
      sortable: true,
      render: (row) => (row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString() : 'Never'),
    },
  ];
  const filterFields: GridFilterField[] = [
    { id: 'fullName', label: 'Name', type: 'string' },
    { id: 'email', label: 'Email', type: 'string' },
    {
      id: 'role',
      label: 'Role',
      type: 'enum',
      options: [
        { label: 'Admin', value: 'ADMIN' },
        { label: 'Cashier', value: 'CASHIER' },
        { label: 'Kitchen', value: 'KITCHEN' },
        { label: 'Courier', value: 'COURIER' },
      ],
    },
    { id: 'isActive', label: 'Active', type: 'boolean' },
    { id: 'createdAt', label: 'Created At', type: 'datetime' },
    { id: 'lastSignInAt', label: 'Last Sign In', type: 'datetime' },
  ];
  const activeFilterBadges = useMemo(() => {
    const badges: { id: string; label: string; onClear: () => void }[] = [];
    if (query.role) {
      badges.push({
        id: 'role',
        label: `Role: ${query.role}`,
        onClear: () => setQuery((prev) => ({ ...prev, page: 1, role: undefined })),
      });
    }
    if (typeof query.isActive === 'boolean') {
      badges.push({
        id: 'status',
        label: `Status: ${query.isActive ? 'Active' : 'Inactive'}`,
        onClear: () => setQuery((prev) => ({ ...prev, page: 1, isActive: undefined })),
      });
    }
    return badges;
  }, [query.role, query.isActive]);

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <PageStack>
          <AdminPageHeader
            title="Staff Management"
            description="Provision and manage cashier, kitchen, courier, and admin access."
            actions={
              <Button variant="outline" onClick={fetchStaff} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            }
          />

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Total operational users"
          value={staff.length}
          icon={Users}
          accent="#3b82f6"
          sub={total > staff.length ? `${total} matching filters` : undefined}
          loading={loading}
        />
        <MetricCard
          label="Active users"
          value={activeCount}
          icon={UserCheck}
          accent="#22c55e"
          sub="Active on this page"
          loading={loading}
        />
      </div>

      <DataPanel>
        <h3 className="mb-4 text-lg font-bold">Create operational user</h3>
        <form
          onSubmit={createStaffUser}
          className="flex flex-col gap-6 [&_input:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&_input:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))]"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-full-name">Full name</Label>
              <Input
                id="staff-full-name"
                className="h-10"
                placeholder="Full name"
                autoComplete="name"
                value={newUser.fullName}
                onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                className="h-10"
                type="email"
                placeholder="user@wrapnroll.com"
                autoComplete="email"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                className="h-10"
                type="password"
                placeholder="Temporary password"
                autoComplete="new-password"
                value={newUser.password}
                onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <NativeSelect
                id="staff-role"
                className="h-10 min-h-10 py-2"
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, role: e.target.value as StaffRole }))
                }
              >
                <option value="CASHIER">Cashier</option>
                <option value="KITCHEN">Kitchen (Chef)</option>
                <option value="COURIER">Delivery (Courier)</option>
                <option value="ADMIN">Admin</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="staff-phone">Phone (optional)</Label>
              <Input
                id="staff-phone"
                className="h-10"
                type="tel"
                placeholder="+94 7X XXX XXXX"
                autoComplete="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button type="submit" className="h-10 min-w-[11rem]" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create user'}
            </Button>
          </div>
        </form>
      </DataPanel>

      <DataPanel>
        <h3 className="mb-4 text-lg font-bold">Role overview</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard size="sm" label="Admin" value={byRole.ADMIN} icon={Shield} accent="#a855f7" />
          <MetricCard size="sm" label="Cashier" value={byRole.CASHIER} icon={Wallet} accent="#3b82f6" />
          <MetricCard size="sm" label="Kitchen" value={byRole.KITCHEN} icon={ChefHat} accent="#eab308" />
          <MetricCard size="sm" label="Courier" value={byRole.COURIER} icon={Truck} accent="#06b6d4" />
        </div>
      </DataPanel>

      <DataPanel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Staff catalog</h3>
          <p className="text-xs text-muted-foreground">Quick browse by alphabet</p>
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          <button
            type="button"
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${catalogLetter === 'ALL' ? 'bg-primary text-white' : 'bg-white text-muted-foreground'}`}
            onClick={() => setCatalogLetter('ALL')}
          >
            ALL
          </button>
          {alphabet.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${catalogLetter === ch ? 'bg-primary text-white' : 'bg-white text-muted-foreground'}`}
              onClick={() => setCatalogLetter(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {staffCatalog.slice(0, 18).map((u) => (
            <div key={`staff-cat-${u.id}`} className="rounded-lg border p-3">
              <p className="font-semibold">{u.fullName}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="secondary">{u.role}</Badge>
                <Badge variant={u.isActive ? 'success' : 'secondary'}>
                  {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>
            </div>
          ))}
          {staffCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              No staff match the selected letter.
            </p>
          ) : null}
        </div>
      </DataPanel>

      <DataPanel>
        <h3 className="mb-4 text-lg font-bold">Operational users</h3>
        <SharedDataGrid
          rows={staff}
          rowId={(row) => row.id}
          columns={columns}
          loading={loading}
          errorText={error}
          emptyText="No staff users found."
          total={total}
          page={query.page}
          pageSize={query.pageSize}
          search={query.search}
          sortBy={query.sortBy}
          sortDir={query.sortDir}
          presetKey="admin-staff-grid"
          onQueryChange={(next) =>
            setQuery((prev) => ({
              ...prev,
              page: next.page ?? prev.page,
              pageSize: next.pageSize ?? prev.pageSize,
              search: next.search ?? prev.search,
              sortBy: Object.prototype.hasOwnProperty.call(next, 'sortBy') ? next.sortBy : prev.sortBy,
              sortDir: Object.prototype.hasOwnProperty.call(next, 'sortDir') ? next.sortDir : prev.sortDir,
            }))
          }
          activeFilterBadges={activeFilterBadges}
          filterFields={filterFields}
          filters={query.filters}
          onFiltersChange={(next) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              filters: next,
            }))
          }
          rowActions={(item) => (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => resetPassword(item)}>
                Reset Password
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleActive(item)}>
                {item.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          )}
          bulkActions={[
            {
              id: 'activate',
              label: 'Activate Selected',
              onClick: async (rows) => applyBulk('setActive', rows, { isActive: true }),
            },
            {
              id: 'deactivate',
              label: 'Deactivate Selected',
              variant: 'destructive',
              onClick: async (rows) => applyBulk('setActive', rows, { isActive: false }),
            },
            {
              id: 'set-role',
              label: 'Set Role...',
              onClick: async (rows) => {
                const role = window.prompt('Enter role: ADMIN, CASHIER, KITCHEN, COURIER', 'CASHIER');
                if (!role) return;
                const normalized = role.trim().toUpperCase() as StaffRole;
                if (!['ADMIN', 'CASHIER', 'KITCHEN', 'COURIER'].includes(normalized)) {
                  setError('Invalid role');
                  return;
                }
                await applyBulk('setRole', rows, { role: normalized });
              },
            },
          ]}
        />
      </DataPanel>

      <DataPanel>
        <h3 className="mb-4 text-lg font-bold">Staff audit trail</h3>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Time</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No audit events yet.
                </TableCell>
              </TableRow>
            ) : (
              auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{log.actorEmail}</TableCell>
                  <TableCell><Badge>{log.action}</Badge></TableCell>
                  <TableCell>{log.targetEmail}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataPanel>
        </PageStack>
      </div>
    </div>
  );
}
