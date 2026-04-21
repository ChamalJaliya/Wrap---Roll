'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import {
  Plus,
  Package,
  AlertTriangle,
  RefreshCw,
  Edit2,
  ArchiveRestore,
  Trash2,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import {
  Badge,
  Button,
  DataPanel,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  GridFilterField,
  GridFilterGroup,
  IconButton,
  Input,
  Label,
  MetricCard,
  PageHeader,
  SharedDataGrid,
  SharedDataGridColumn,
} from '@wrap-roll/shared-ui';

interface Ingredient {
  id: string;
  name: string;
  currentStock: number;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  createdAt?: string;
}

type IngredientFormState = {
  name: string;
  unit: 'g' | 'ml' | 'pcs';
  lowStockThreshold: number;
};

type MovementType = 'restock' | 'waste' | 'adjust';

type MovementFormState = {
  type: MovementType;
  quantity: number;
  quantityDelta: number;
  unitCost: number;
  note: string;
};

type InventoryMovement = {
  id: string;
  movementType: 'PURCHASE' | 'CONSUME' | 'WASTE' | 'ADJUSTMENT' | 'RETURN';
  quantityDelta: number;
  unitCost: number | null;
  resultingQty: number;
  resultingAvgCost: number;
  occurredAt: string;
  note: string | null;
};

type OverheadEntry = {
  id: string;
  costType: 'GAS' | 'WATER' | 'ELECTRICITY' | 'LABOR' | 'RENT' | 'OTHER';
  amount: number;
  periodStart: string;
  periodEnd: string;
  allocationScope: 'GLOBAL' | 'KITCHEN' | 'DELIVERY';
  note: string | null;
};

type OverheadFormState = {
  costType: OverheadEntry['costType'];
  amount: number;
  periodStart: string;
  periodEnd: string;
  allocationScope: OverheadEntry['allocationScope'];
  note: string;
};

type InventoryListResponse = {
  items: Ingredient[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type InventoryQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: GridFilterGroup;
};

export default function InventoryDashboard() {
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<IngredientFormState>({
    name: '',
    unit: 'g',
    lowStockThreshold: 0,
  });
  const [movementForm, setMovementForm] = useState<MovementFormState>({
    type: 'restock',
    quantity: 0,
    quantityDelta: 0,
    unitCost: 0,
    note: '',
  });
  const [movementHistory, setMovementHistory] = useState<InventoryMovement[]>([]);
  const [overheadEntries, setOverheadEntries] = useState<OverheadEntry[]>([]);
  const [overheadForm, setOverheadForm] = useState<OverheadFormState>({
    costType: 'ELECTRICITY',
    amount: 0,
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    allocationScope: 'GLOBAL',
    note: '',
  });
  const [query, setQuery] = useState<InventoryQuery>({
    page: 1,
    pageSize: 20,
    search: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const filterFields: GridFilterField[] = [
    { id: 'name', label: 'Name', type: 'string' },
    { id: 'currentStock', label: 'Current Stock', type: 'number' },
    { id: 'lowStockThreshold', label: 'Threshold', type: 'number' },
    { id: 'unit', label: 'Unit', type: 'string' },
    { id: 'costPerUnit', label: 'Cost Per Unit', type: 'number' },
    { id: 'createdAt', label: 'Created At', type: 'datetime' },
  ];

  useEffect(() => {
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.pageSize, query.search, query.sortBy, query.sortDir, query.filters]);

  useEffect(() => {
    fetchOverheadEntries();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('limit', String(query.pageSize));
      if (query.search.trim()) params.set('search', query.search.trim());
      if (query.sortBy) params.set('sortBy', query.sortBy);
      if (query.sortDir) params.set('sortDir', query.sortDir);
      if (query.filters?.rules?.length) params.set('filters', JSON.stringify(query.filters));

      const response = await api.get<InventoryListResponse>(`/inventory?${params.toString()}`);
      setInventory(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.meta?.total ?? 0));
    } catch (error: unknown) {
      console.error('Failed to fetch inventory', error);
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Request failed';
      setFetchError(
        msg === 'Network Error'
          ? 'Could not reach the API. Start the Nest server (port 4000) and restart the admin dev server.'
          : msg,
      );
      setInventory([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };
  const lowCount = inventory.filter((i) => i.currentStock <= i.lowStockThreshold).length;
  const columns: SharedDataGridColumn<Ingredient>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Ingredient',
        sortable: true,
        hideable: false,
        render: (item) => {
          const isLow = item.currentStock <= item.lowStockThreshold;
          return (
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isLow ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}
              >
                <Package className="h-4 w-4" />
              </div>
              <span className="font-semibold">{item.name}</span>
            </div>
          );
        },
      },
      {
        id: 'currentStock',
        label: 'Current Stock',
        sortable: true,
        render: (item) => (
          <>
            {item.currentStock}{' '}
            <span className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
              {item.unit}
            </span>
          </>
        ),
      },
      {
        id: 'lowStockThreshold',
        label: 'Threshold',
        sortable: true,
        render: (item) => (
          <span className="text-muted-foreground">
            {item.lowStockThreshold} {item.unit}
          </span>
        ),
      },
      {
        id: 'costPerUnit',
        label: 'Avg Cost/Unit',
        sortable: true,
        render: (item) => `Rs. ${Number(item.costPerUnit).toFixed(2)}`,
      },
      {
        id: 'stockValue',
        label: 'Stock Value',
        sortable: false,
        render: (item) => `Rs. ${(Number(item.currentStock) * Number(item.costPerUnit)).toFixed(2)}`,
      },
      {
        id: 'status',
        label: 'Status',
        sortable: false,
        render: (item) =>
          item.currentStock <= item.lowStockThreshold ? (
            <Badge variant="destructive" className="flex w-fit items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> LOW STOCK
            </Badge>
          ) : (
            <Badge variant="success" className="flex w-fit items-center gap-1.5 text-xs font-medium">
              NORMAL
            </Badge>
          ),
      },
    ],
    [],
  );

  const openCreateModal = () => {
    setEditingIngredientId(null);
    setForm({
      name: '',
      unit: 'g',
      lowStockThreshold: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (ingredient: Ingredient) => {
    setEditingIngredientId(ingredient.id);
    setForm({
      name: ingredient.name,
      unit: ingredient.unit as IngredientFormState['unit'],
      lowStockThreshold: Number(ingredient.lowStockThreshold),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFetchError(null);
    try {
      if (editingIngredientId) {
        await api.patch(`/inventory/${editingIngredientId}`, form);
      } else {
        await api.post('/inventory', {
          ...form,
          currentStock: 0,
          costPerUnit: 0,
        });
      }
      setIsModalOpen(false);
      await fetchInventory();
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Failed to save ingredient.';
      setFetchError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchMovementHistory = async (ingredientId: string) => {
    try {
      const response = await api.get<InventoryMovement[]>(`/inventory/${ingredientId}/movements?limit=30`);
      setMovementHistory(response.data);
    } catch {
      setMovementHistory([]);
    }
  };

  const fetchOverheadEntries = async () => {
    try {
      const response = await api.get<OverheadEntry[]>('/inventory/overhead/list');
      setOverheadEntries(response.data);
    } catch {
      setOverheadEntries([]);
    }
  };

  const openMovementModal = async (ingredient: Ingredient, type: MovementType) => {
    setSelectedIngredient(ingredient);
    setMovementForm({
      type,
      quantity: 0,
      quantityDelta: 0,
      unitCost: Number(ingredient.costPerUnit),
      note: '',
    });
    setIsMovementModalOpen(true);
    await fetchMovementHistory(ingredient.id);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    setIsSaving(true);
    setFetchError(null);
    try {
      if (movementForm.type === 'restock') {
        await api.post('/inventory/restock', {
          ingredientId: selectedIngredient.id,
          quantity: Number(movementForm.quantity),
          unitCost: Number(movementForm.unitCost),
          note: movementForm.note || undefined,
        });
      } else if (movementForm.type === 'waste') {
        await api.post('/inventory/waste', {
          ingredientId: selectedIngredient.id,
          quantity: Number(movementForm.quantity),
          note: movementForm.note || undefined,
        });
      } else {
        await api.post('/inventory/adjust', {
          ingredientId: selectedIngredient.id,
          quantityDelta: Number(movementForm.quantityDelta),
          note: movementForm.note || undefined,
        });
      }
      setIsMovementModalOpen(false);
      await fetchInventory();
      await fetchMovementHistory(selectedIngredient.id);
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Failed to save movement.';
      setFetchError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOverhead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFetchError(null);
    try {
      await api.post('/inventory/overhead', {
        ...overheadForm,
        periodStart: new Date(overheadForm.periodStart).toISOString(),
        periodEnd: new Date(overheadForm.periodEnd).toISOString(),
        note: overheadForm.note || undefined,
      });
      setOverheadForm((prev) => ({
        ...prev,
        amount: 0,
        note: '',
      }));
      await fetchOverheadEntries();
    } catch (error: unknown) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Failed to save overhead entry.';
      setFetchError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (ingredient: Ingredient) => {
    if (!confirm(`Delete ingredient "${ingredient.name}"?`)) return;
    try {
      await api.delete(`/inventory/${ingredient.id}`);
      await fetchInventory();
    } catch {
      setFetchError('Failed to delete ingredient.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Control"
        description="Monitor stock, moving average costs, and inventory operations."
        actions={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchInventory}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{' '}
              Refresh
            </Button>
            <Button className="flex items-center gap-2" onClick={openCreateModal}>
              <Plus className="h-4 w-4" /> Add Ingredient
            </Button>
          </div>
        }
      />

      {fetchError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {fetchError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <MetricCard
          label="Total Ingredients"
          value={total}
          icon={Package}
          accent="#3b82f6"
          loading={loading}
        />
        <MetricCard
          label="Low stock alerts"
          value={<span className="text-destructive">{lowCount}</span>}
          icon={AlertTriangle}
          accent="#ef4444"
          sub={lowCount > 0 ? 'Below reorder threshold' : 'All SKUs above threshold'}
          loading={loading}
        />
        <MetricCard
          label="Healthy SKUs"
          value={Math.max(0, total - lowCount)}
          icon={CheckCircle2}
          accent="#22c55e"
          loading={loading}
        />
      </div>

      <DataPanel>
        <SharedDataGrid
          rows={inventory}
          rowId={(item) => item.id}
          columns={columns}
          loading={loading}
          errorText={fetchError}
          emptyText="No ingredients found."
          total={total}
          page={query.page}
          pageSize={query.pageSize}
          search={query.search}
          sortBy={query.sortBy}
          sortDir={query.sortDir}
          presetKey="admin-inventory-grid"
          filterFields={filterFields}
          filters={query.filters}
          onFiltersChange={(next) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              filters: next,
            }))
          }
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
          rowActions={(item) => (
            <div className="flex items-center gap-2">
              <IconButton
                type="button"
                variant="muted"
                aria-label={`Edit metadata for ${item.name}`}
                onClick={() => openEditModal(item)}
              >
                <Edit2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant="muted"
                aria-label={`Restock ${item.name}`}
                onClick={() => openMovementModal(item, 'restock')}
              >
                <ArchiveRestore className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant="muted"
                aria-label={`Waste ${item.name}`}
                onClick={() => openMovementModal(item, 'waste')}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant="muted"
                aria-label={`Adjust ${item.name}`}
                onClick={() => openMovementModal(item, 'adjust')}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </IconButton>
              <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(item)}>
                Delete
              </Button>
            </div>
          )}
          selectionMode="none"
        />
      </DataPanel>

      <DataPanel>
        <h3 className="mb-3 text-sm font-semibold">Overhead Costs</h3>
        <form className="mb-4 grid gap-3 md:grid-cols-3" onSubmit={handleSaveOverhead}>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={overheadForm.costType}
            onChange={(e) => setOverheadForm((prev) => ({ ...prev, costType: e.target.value as OverheadEntry['costType'] }))}
          >
            <option value="GAS">Gas</option>
            <option value="WATER">Water</option>
            <option value="ELECTRICITY">Electricity</option>
            <option value="LABOR">Labor</option>
            <option value="RENT">Rent</option>
            <option value="OTHER">Other</option>
          </select>
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="Amount"
            value={overheadForm.amount}
            onChange={(e) => setOverheadForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={overheadForm.allocationScope}
            onChange={(e) =>
              setOverheadForm((prev) => ({ ...prev, allocationScope: e.target.value as OverheadEntry['allocationScope'] }))
            }
          >
            <option value="GLOBAL">Global</option>
            <option value="KITCHEN">Kitchen</option>
            <option value="DELIVERY">Delivery</option>
          </select>
          <Input
            type="date"
            value={overheadForm.periodStart}
            onChange={(e) => setOverheadForm((prev) => ({ ...prev, periodStart: e.target.value }))}
          />
          <Input
            type="date"
            value={overheadForm.periodEnd}
            onChange={(e) => setOverheadForm((prev) => ({ ...prev, periodEnd: e.target.value }))}
          />
          <Input
            placeholder="Note"
            value={overheadForm.note}
            onChange={(e) => setOverheadForm((prev) => ({ ...prev, note: e.target.value }))}
          />
          <div className="md:col-span-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Add Overhead Entry'}
            </Button>
          </div>
        </form>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Amount</th>
                <th className="px-3 py-2 text-left">Scope</th>
                <th className="px-3 py-2 text-left">Period</th>
                <th className="px-3 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {overheadEntries.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-3 py-2">{entry.costType}</td>
                  <td className="px-3 py-2">Rs. {Number(entry.amount).toFixed(2)}</td>
                  <td className="px-3 py-2">{entry.allocationScope}</td>
                  <td className="px-3 py-2">
                    {new Date(entry.periodStart).toLocaleDateString()} - {new Date(entry.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{entry.note || '-'}</td>
                </tr>
              ))}
              {overheadEntries.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                    No overhead entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataPanel>

      <DataPanel>
        <h3 className="mb-3 text-sm font-semibold">Recent Inventory Movements</h3>
        {selectedIngredient ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Showing movement ledger for <strong>{selectedIngredient.name}</strong>
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Qty Delta</th>
                    <th className="px-3 py-2 text-left">Unit Cost</th>
                    <th className="px-3 py-2 text-left">Result Qty</th>
                    <th className="px-3 py-2 text-left">Avg Cost</th>
                    <th className="px-3 py-2 text-left">At</th>
                  </tr>
                </thead>
                <tbody>
                  {movementHistory.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2">{m.movementType}</td>
                      <td className="px-3 py-2">{Number(m.quantityDelta).toFixed(2)}</td>
                      <td className="px-3 py-2">{m.unitCost == null ? '-' : `Rs. ${Number(m.unitCost).toFixed(2)}`}</td>
                      <td className="px-3 py-2">{Number(m.resultingQty).toFixed(2)}</td>
                      <td className="px-3 py-2">Rs. {Number(m.resultingAvgCost).toFixed(2)}</td>
                      <td className="px-3 py-2">{new Date(m.occurredAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {movementHistory.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-muted-foreground" colSpan={6}>
                        No movement records found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Use restock/waste/adjust actions to inspect movement history.</p>
        )}
      </DataPanel>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIngredientId ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-name">Name</Label>
                <Input
                  id="ingredient-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-unit">Unit</Label>
                <select
                  id="ingredient-unit"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, unit: e.target.value as IngredientFormState['unit'] }))
                  }
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-low">Low Stock Threshold</Label>
                <Input
                  id="ingredient-low"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm((prev) => ({ ...prev, lowStockThreshold: Number(e.target.value) }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingIngredientId ? 'Update Ingredient' : 'Create Ingredient'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {movementForm.type === 'restock'
                ? 'Restock Ingredient'
                : movementForm.type === 'waste'
                  ? 'Record Waste'
                  : 'Adjust Stock'}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveMovement}>
            <div className="space-y-1.5">
              <Label>Ingredient</Label>
              <Input value={selectedIngredient?.name ?? ''} disabled />
            </div>
            {movementForm.type === 'adjust' ? (
              <div className="space-y-1.5">
                <Label htmlFor="movement-quantity-delta">Quantity Delta (+/-)</Label>
                <Input
                  id="movement-quantity-delta"
                  type="number"
                  step="0.01"
                  required
                  value={movementForm.quantityDelta}
                  onChange={(e) => setMovementForm((prev) => ({ ...prev, quantityDelta: Number(e.target.value) }))}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="movement-quantity">Quantity</Label>
                <Input
                  id="movement-quantity"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                />
              </div>
            )}
            {movementForm.type === 'restock' ? (
              <div className="space-y-1.5">
                <Label htmlFor="movement-unit-cost">Purchase Unit Cost</Label>
                <Input
                  id="movement-unit-cost"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={movementForm.unitCost}
                  onChange={(e) => setMovementForm((prev) => ({ ...prev, unitCost: Number(e.target.value) }))}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="movement-note">Note</Label>
              <Input
                id="movement-note"
                value={movementForm.note}
                onChange={(e) => setMovementForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
