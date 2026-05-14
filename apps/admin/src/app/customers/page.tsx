'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, MapPin, Package, UserCheck, Users, UserRound } from 'lucide-react';
import api from '../../services/api';
import {
  Badge,
  Button,
  ClientDirectory,
  type ClientDirectoryRow,
  DataPanel,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  GridFilterField,
  Input,
  Label,
  MetricCard,
  PageStack,
  SharedDataGrid,
  SharedDataGridColumn,
  useClientDirectoryCatalog,
} from '@wrap-roll/shared-ui';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { adminPageContainerClass, adminPageRootClass } from '../../lib/admin-ui-contract';

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  supabaseUserId: string | null;
  createdAt: string;
  orderCount: number;
  addressCount: number;
  savedPaymentCount: number;
  defaultAddress: string | null;
  latestOrder: {
    id: string;
    status: string;
    placedAt: string;
    total: number;
  } | null;
};

type CustomerListResponse = {
  items: CustomerRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type CustomerDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  supabaseUserId: string | null;
  createdAt: string;
  addresses: Array<{
    id: string;
    label: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string | null;
    isDefault: boolean;
  }>;
  savedPayments: Array<{
    id: string;
    cardBrand: string;
    last4: string;
    isDefault: boolean;
  }>;
  orders: Array<{
    id: string;
    placedAt: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    total: number;
    fulfillmentType: string;
  }>;
  _count: {
    orders: number;
    addresses: number;
    savedPayments: number;
  };
};

type CustomerQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<CustomerQuery>({
    page: 1,
    pageSize: 20,
    search: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CustomerDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [catalogLetter, setCatalogLetter] = useState<string>('ALL');
  const [catalogType, setCatalogType] = useState<'all' | 'client' | 'guest'>('all');

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('limit', String(query.pageSize));
      if (query.search.trim()) params.set('search', query.search.trim());
      if (query.sortBy) params.set('sortBy', query.sortBy);
      if (query.sortDir) params.set('sortDir', query.sortDir);
      const res = await api.get<CustomerListResponse>(`/customer/admin/list?${params.toString()}`);
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      setRows(list);
      setTotal(Number(res.data?.meta?.total ?? list.length));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load customers');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.pageSize, query.search, query.sortBy, query.sortDir]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
    setDetailLoading(true);
    setError(null);
    try {
      const res = await api.get<CustomerDetail>(`/customer/admin/${id}`);
      setSelectedDetail(res.data);
      setEditName(String(res.data?.name ?? ''));
      setEditEmail(String(res.data?.email ?? ''));
      setEditPhone(String(res.data?.phone ?? ''));
    } catch (e: any) {
      setSelectedDetail(null);
      setError(e?.response?.data?.message || e?.message || 'Failed to load customer detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/customer/admin/${selectedId}`, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      });
      await openDetail(selectedId);
      await fetchCustomers();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const guestCount = useMemo(() => rows.filter((r) => !r.supabaseUserId).length, [rows]);
  const linkedCount = useMemo(() => rows.filter((r) => Boolean(r.supabaseUserId)).length, [rows]);
  const catalogSourceRows = useMemo<ClientDirectoryRow[]>(
    () =>
      rows.map((r) => ({
        ...r,
        latestOrderPlacedAt: r.latestOrder?.placedAt ?? null,
      })),
    [rows],
  );
  const { filteredRows: catalogRows, recentRows: recentCatalogRows } = useClientDirectoryCatalog(
    catalogSourceRows,
    { catalogType, catalogLetter },
  );

  const columns: SharedDataGridColumn<CustomerRow>[] = [
    {
      id: 'name',
      label: 'Customer',
      sortable: true,
      hideable: false,
      render: (r) => (
        <div className="space-y-0.5">
          <p className="font-semibold">{r.name || 'Guest'}</p>
          <p className="text-xs text-muted-foreground">{r.email || r.phone || 'No contact'}</p>
          {r.defaultAddress ? (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{r.defaultAddress}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'phone',
      label: 'Phone',
      sortable: true,
      render: (r) => r.phone || '-',
    },
    {
      id: 'orderCount',
      label: 'Orders',
      sortable: false,
      render: (r) => <span className="font-semibold">{r.orderCount}</span>,
    },
    {
      id: 'latestOrder',
      label: 'Latest Order',
      sortable: false,
      render: (r) =>
        r.latestOrder ? (
          <div className="space-y-0.5">
            <p className="font-mono text-xs">{r.latestOrder.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-muted-foreground">{new Date(r.latestOrder.placedAt).toLocaleString()}</p>
          </div>
        ) : (
          '-'
        ),
    },
    {
      id: 'supabaseUserId',
      label: 'Type',
      sortable: false,
      render: (r) => (
        <Badge variant={r.supabaseUserId ? 'success' : 'secondary'}>
          {r.supabaseUserId ? 'Client account' : 'Guest'}
        </Badge>
      ),
    },
  ];

  const filterFields: GridFilterField[] = [
    { id: 'name', label: 'Name', type: 'string' },
    { id: 'email', label: 'Email', type: 'string' },
    { id: 'phone', label: 'Phone', type: 'string' },
    { id: 'createdAt', label: 'Created', type: 'datetime' },
  ];

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <PageStack>
          <AdminPageHeader
            title="Customers"
            description="Manage non-staff users (guests + client accounts)."
            actions={
              <Button variant="outline" onClick={() => void fetchCustomers()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            }
          />

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <MetricCard
          label="Customers in current scope"
          value={rows.length}
          icon={Users}
          accent="#3b82f6"
          sub={total > rows.length ? `${total} matching filters` : undefined}
          loading={loading}
        />
        <MetricCard
          label="Client accounts"
          value={linkedCount}
          icon={UserCheck}
          accent="#22c55e"
          sub="With Supabase login"
          loading={loading}
        />
        <MetricCard
          label="Guests"
          value={guestCount}
          icon={UserRound}
          accent="#64748b"
          sub="No linked account"
          loading={loading}
        />
      </div>

      <DataPanel>
        <ClientDirectory
          title="Client catalog"
          query={query.search}
          onQueryChange={(value) => setQuery((prev) => ({ ...prev, page: 1, search: value }))}
          onSearch={() => void fetchCustomers()}
          loading={loading}
          rows={catalogRows.slice(0, 18) as ClientDirectoryRow[]}
          recentRows={recentCatalogRows as ClientDirectoryRow[]}
          catalogLetter={catalogLetter}
          onCatalogLetterChange={setCatalogLetter}
          catalogType={catalogType}
          onCatalogTypeChange={setCatalogType}
          emptyText="No customers match current catalog filters."
          onCardClick={(r) => void openDetail(r.id)}
        />
      </DataPanel>

      <DataPanel>
        <SharedDataGrid
          rows={rows}
          rowId={(r) => r.id}
          columns={columns}
          loading={loading}
          errorText={error}
          emptyText="No customers found."
          total={total}
          page={query.page}
          pageSize={query.pageSize}
          search={query.search}
          sortBy={query.sortBy}
          sortDir={query.sortDir}
          filterFields={filterFields}
          rowActions={(r) => (
            <Button variant="outline" size="sm" onClick={() => void openDetail(r.id)}>
              View
            </Button>
          )}
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
        />
      </DataPanel>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          showCloseButton
          className="gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl sm:max-w-3xl"
        >
          <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-muted/25 px-6 pb-4 pt-6 pr-14">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="font-display text-xl font-black tracking-tight">
                Customer profile {selectedDetail ? `• ${selectedDetail.name || 'Guest'}` : ''}
              </DialogTitle>
              <DialogDescription>
                View orders, saved addresses, and cards. Edit core contact fields below.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[min(85vh,720px)] overflow-y-auto px-6 py-6">
          {detailLoading || !selectedDetail ? (
            <p className="text-sm text-muted-foreground">Loading customer detail…</p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <Button onClick={() => void saveProfile()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save profile'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Total orders"
                  value={selectedDetail._count.orders}
                  icon={Package}
                  accent="#3b82f6"
                />
                <MetricCard
                  label="Address book entries"
                  value={selectedDetail._count.addresses}
                  icon={MapPin}
                  accent="#f97316"
                />
                <MetricCard
                  label="Saved cards"
                  value={selectedDetail._count.savedPayments}
                  icon={CreditCard}
                  accent="#a855f7"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DataPanel>
                  <h3 className="mb-2 text-sm font-bold">Addresses</h3>
                  <div className="space-y-2">
                    {selectedDetail.addresses.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No addresses saved.</p>
                    ) : (
                      selectedDetail.addresses.map((a) => (
                        <div key={a.id} className="rounded-lg border p-2 text-xs">
                          <p className="font-semibold">
                            {a.label} {a.isDefault ? '(default)' : ''}
                          </p>
                          <p>{[a.addressLine1, a.addressLine2, a.city, a.postalCode].filter(Boolean).join(', ')}</p>
                        </div>
                      ))
                    )}
                  </div>
                </DataPanel>

                <DataPanel>
                  <h3 className="mb-2 text-sm font-bold">Saved cards</h3>
                  <div className="space-y-2">
                    {selectedDetail.savedPayments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No saved cards.</p>
                    ) : (
                      selectedDetail.savedPayments.map((c) => (
                        <div key={c.id} className="rounded-lg border p-2 text-xs">
                          <p className="font-semibold">
                            {c.cardBrand} •••• {c.last4} {c.isDefault ? '(default)' : ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </DataPanel>
              </div>

              <DataPanel>
                <h3 className="mb-2 text-sm font-bold">Recent orders</h3>
                <div className="space-y-2">
                  {selectedDetail.orders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No orders yet.</p>
                  ) : (
                    selectedDetail.orders.map((o) => (
                      <div key={o.id} className="rounded-lg border p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono">{o.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-muted-foreground">{new Date(o.placedAt).toLocaleString()}</p>
                        </div>
                        <p>
                          {o.status} • {o.paymentStatus} • {o.paymentMethod} • Rs.{Number(o.total).toFixed(2)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </DataPanel>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
        </PageStack>
      </div>
    </div>
  );
}

