'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  Package,
  Settings2,
  ChefHat,
  Blend,
} from 'lucide-react';
import {
  AvailabilityBadge,
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
  SharedDataGrid,
  SharedDataGridColumn,
  Textarea,
} from '@wrap-roll/shared-ui';
import type { MenuRecipeLineInput, ModifierGroupInput } from '@wrap-roll/contracts';
import { ModifierBuilder } from '../../components/menu/ModifierBuilder';
import { RecipeBuilder } from '../../components/menu/RecipeBuilder';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import {
  adminPageContainerClass,
  adminPageDenseStackClass,
  adminPageRootClass,
  adminSectionEyebrowClass,
} from '../../lib/admin-ui-contract';
import {
  ModifierDeltaBuilder,
  type ModifierIngredientDelta,
} from '../../components/menu/ModifierDeltaBuilder';
import {
  MenuItemPhotoEditor,
  type MenuItemPhotoEditorHandle,
} from '../../components/menu/MenuItemPhotoEditor';

/** Tighter panels inside the menu modal only (avoid shared adminElevatedPanelClass p-8). */
const menuModalPanelClass =
  'space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5';

interface MenuItem {
  itemId: string;
  name: string;
  description?: string;
  basePrice: number;
  prepTimeMinutes: number;
  imageUrl?: string;
  categoryId: string;
  categoryName: string;
  availability: 'available' | 'sold_out' | 'limited';
  modifierGroups: ModifierGroupInput[];
}

type MenuListResponse = {
  items: MenuItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type MenuCategory = {
  id: string;
  name: string;
  slug: string;
};

type MenuQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: GridFilterGroup;
};

type MenuRecipeResponse = {
  menuItemId: string;
  lines: Array<{
    ingredientId: string;
    quantityUsed: number;
    ingredient: {
      id: string;
      name: string;
      unit: string;
      currentStock: number;
      lowStockThreshold: number;
    };
  }>;
};

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
};

/** Dedupe by id — later entries win (fresher stock from search vs recipe snapshot). */
function mergeIngredientOptions(prev: IngredientOption[], next: IngredientOption[]): IngredientOption[] {
  if (next.length === 0) return prev;
  const map = new Map<string, IngredientOption>();
  for (const i of prev) map.set(i.id, i);
  for (const i of next) map.set(i.id, i);
  return Array.from(map.values());
}

export default function MenuManagement() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupInput[]>([]);
  const [recipeLines, setRecipeLines] = useState<MenuRecipeLineInput[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [modifierDeltas, setModifierDeltas] = useState<ModifierIngredientDelta[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('[]');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editorSection, setEditorSection] = useState<'details' | 'modifiers' | 'recipe' | 'impacts'>('details');
  const [menuPhotoError, setMenuPhotoError] = useState<string | null>(null);
  const photoEditorRef = useRef<MenuItemPhotoEditorHandle>(null);
  /** Bumps when starting a new edit/create load so stale async recipe responses are ignored. */
  const editLoadSessionRef = useRef(0);
  const [query, setQuery] = useState<MenuQuery>({
    page: 1,
    pageSize: 20,
    search: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
  });

  const filterFields: GridFilterField[] = useMemo(
    () => [
      { id: 'name', label: 'Name', type: 'string' },
      { id: 'description', label: 'Description', type: 'string' },
      {
        id: 'categoryId',
        label: 'Category',
        type: 'enum',
        options: categories.map((category) => ({ label: category.name, value: category.id })),
      },
      { id: 'basePrice', label: 'Base Price', type: 'number' },
      { id: 'prepTimeMinutes', label: 'Prep Time (min)', type: 'number' },
      {
        id: 'availability',
        label: 'Availability',
        type: 'enum',
        options: [
          { label: 'Available', value: 'available' },
          { label: 'Sold Out', value: 'sold_out' },
          { label: 'Limited', value: 'limited' },
        ],
      },
    ],
    [categories],
  );

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.pageSize, query.search, query.sortBy, query.sortDir, query.filters]);

  useEffect(() => {
    void fetchCategories();
  }, []);

  const fetchItems = async () => {
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

      const response = await api.get<MenuListResponse>(`/menu?${params.toString()}`);
      setItems(response.data.items);
      setTotal(response.data.meta.total);
    } catch (error: unknown) {
      console.error('Failed to fetch menu items', error);
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Request failed';
      setFetchError(
        msg === 'Network Error'
          ? 'Could not reach the API. Start the Nest server (port 4000) and restart the admin dev server.'
          : msg,
      );
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get<MenuCategory[]>('/menu/categories');
      setCategories(response.data);
    } catch {
      setCategories([]);
    }
  };

  const createCategory = async () => {
    const name = categoryDraft.trim();
    if (!name) return;
    setCategoryBusy(true);
    try {
      await api.post('/menu/categories', { name });
      setCategoryDraft('');
      await fetchCategories();
    } catch {
      setFetchError('Failed to create category.');
    } finally {
      setCategoryBusy(false);
    }
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId) return;
    const name = editingCategoryName.trim();
    if (!name) return;
    setCategoryBusy(true);
    try {
      await api.patch(`/menu/categories/${editingCategoryId}`, { name });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      await fetchCategories();
      await fetchItems();
    } catch {
      setFetchError('Failed to update category.');
    } finally {
      setCategoryBusy(false);
    }
  };

  const deleteCategory = async (category: MenuCategory) => {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    setCategoryBusy(true);
    try {
      await api.delete(`/menu/categories/${category.id}`);
      await fetchCategories();
      await fetchItems();
    } catch {
      setFetchError('Failed to delete category. Category may still be in use.');
    } finally {
      setCategoryBusy(false);
    }
  };

  /** Debounced server search for ingredient pickers (async; no full client-side import). */
  const searchIngredientOptions = useCallback(async (query: string): Promise<IngredientOption[]> => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    params.set('limit', '50');
    params.set('page', '1');
    params.set('sortBy', 'name');
    params.set('sortDir', 'asc');
    const response = await api.get<{
      items?: unknown[];
    }>(`/inventory?${params.toString()}`);
    const body = response.data;
    const raw = Array.isArray(body) ? body : body?.items ?? [];
    const rows = Array.isArray(raw) ? raw : [];
    return (rows as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      name: String(item.name),
      unit: String(item.unit),
      currentStock: Number(item.currentStock),
      lowStockThreshold: Number(item.lowStockThreshold),
    }));
  }, []);

  /** One lightweight page — primes labels / modifier defaults; not paginating the entire inventory. */
  const primeIngredientCatalog = useCallback(async (session?: number) => {
    try {
      const rows = await searchIngredientOptions('');
      if (session !== undefined && editLoadSessionRef.current !== session) return;
      setIngredients((prev) => mergeIngredientOptions(prev, rows));
    } catch {
      /* keep existing cache */
    }
  }, [searchIngredientOptions]);

  const fetchRecipe = useCallback(
    async (
      menuItemId: string,
    ): Promise<{ lines: MenuRecipeLineInput[]; ingredientSnapshots: IngredientOption[] }> => {
      const { data } = await api.get<MenuRecipeResponse>(`/menu/${encodeURIComponent(menuItemId)}/recipe`);
      const rows = Array.isArray(data?.lines) ? data.lines : [];
      const lines: MenuRecipeLineInput[] = rows.map((line) => ({
        ingredientId: String(line.ingredientId),
        quantityUsed: Number(line.quantityUsed ?? 0),
      }));
      const ingredientSnapshots: IngredientOption[] = [];
      const seen = new Set<string>();
      for (const line of rows) {
        const ing = line.ingredient;
        if (!ing) continue;
        const id = String(ing.id);
        if (seen.has(id)) continue;
        seen.add(id);
        ingredientSnapshots.push({
          id,
          name: String(ing.name),
          unit: String(ing.unit),
          currentStock: Number(ing.currentStock),
          lowStockThreshold: Number(ing.lowStockThreshold),
        });
      }
      return { lines, ingredientSnapshots };
    },
    [],
  );

  const fetchModifierDeltas = useCallback(async (menuItemId: string) => {
    const response = await api.get<{ deltas: Array<{ optionId: string; ingredientId: string; quantityDelta: string }> }>(
      `/menu/${encodeURIComponent(menuItemId)}/modifier-deltas`,
    );
    return (response.data?.deltas ?? []).map((d) => ({
      optionId: d.optionId,
      ingredientId: d.ingredientId,
      quantityDelta: Number(d.quantityDelta),
    }));
  }, []);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (jsonMode && jsonError) {
      setFetchError('Fix modifier JSON before saving.');
      return;
    }

    try {
      const basePayload = {
        name: editingItem.name?.trim() ?? '',
        categoryId: editingItem.categoryId ?? '',
        description: editingItem.description?.trim() || undefined,
        basePrice: Number(editingItem.basePrice ?? 0),
        prepTimeMinutes: Number(editingItem.prepTimeMinutes ?? 0),
        availability: editingItem.availability ?? 'available',
        modifierGroups,
      };

      const photoResult = photoEditorRef.current?.prepareSave();
      if (photoResult && 'error' in photoResult) {
        setMenuPhotoError(photoResult.error);
        return;
      }
      setMenuPhotoError(null);
      const imageUrlForApi =
        photoResult && 'imageUrl' in photoResult
          ? photoResult.imageUrl
          : (editingItem.imageUrl?.trim() ?? null);

      if (editingItem.itemId) {
        await api.patch(`/menu/${editingItem.itemId}`, {
          ...basePayload,
          imageUrl: imageUrlForApi,
        });
        await api.put(`/menu/${editingItem.itemId}/recipe`, { lines: recipeLines });
        await api.put(`/menu/${editingItem.itemId}/modifier-deltas`, { deltas: modifierDeltas });
      } else {
        const postPayload =
          imageUrlForApi !== null ? { ...basePayload, imageUrl: imageUrlForApi } : basePayload;
        const created = await api.post<MenuItem>('/menu', postPayload);
        if (created.data?.itemId) {
          await api.put(`/menu/${created.data.itemId}/recipe`, { lines: recipeLines });
          await api.put(`/menu/${created.data.itemId}/modifier-deltas`, { deltas: modifierDeltas });
        }
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setModifierGroups([]);
      setRecipeLines([]);
      setModifierDeltas([]);
      setJsonMode(false);
      setJsonDraft('[]');
      setJsonError(null);
      fetchItems();
    } catch (error) {
      console.error('Failed to save menu item', error);
      setFetchError('Failed to save menu item. Check required fields and recipe lines.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.delete(`/menu/${id}`);
      fetchItems();
    } catch (error) {
      console.error('Failed to delete menu item', error);
    }
  };

  const openCreateModal = () => {
    const session = ++editLoadSessionRef.current;
    setIngredients([]);
    setEditingItem({
      name: '',
      categoryId: categories[0]?.id ?? '',
      categoryName: categories[0]?.name ?? '',
      description: '',
      basePrice: 0,
      prepTimeMinutes: 0,
      availability: 'available',
    });
    setModifierGroups([]);
    setRecipeLines([]);
    setModifierDeltas([]);
    setJsonMode(false);
    setJsonDraft('[]');
    setJsonError(null);
    setEditorSection('details');
    setMenuPhotoError(null);
    setIsModalOpen(true);
    void primeIngredientCatalog(session);
  };

  const openEditModal = useCallback(
    async (item: MenuItem, options?: { initialSection?: 'details' | 'modifiers' | 'recipe' | 'impacts' }) => {
      const session = ++editLoadSessionRef.current;
      setIngredients([]);
      setMenuPhotoError(null);
      setEditingItem(item);
      const groups = Array.isArray(item.modifierGroups) ? item.modifierGroups : [];
      setModifierGroups(groups);
      setJsonDraft(JSON.stringify(groups, null, 2));
      setJsonMode(false);
      setJsonError(null);
      try {
        const { lines, ingredientSnapshots } = await fetchRecipe(item.itemId);
        if (editLoadSessionRef.current !== session) return;
        setRecipeLines(lines);
        setIngredients((prev) => mergeIngredientOptions(prev, ingredientSnapshots));
      } catch {
        if (editLoadSessionRef.current !== session) return;
        setRecipeLines([]);
      }
      try {
        const deltas = await fetchModifierDeltas(item.itemId);
        if (editLoadSessionRef.current !== session) return;
        setModifierDeltas(deltas);
      } catch {
        if (editLoadSessionRef.current !== session) return;
        setModifierDeltas([]);
      }
      if (editLoadSessionRef.current !== session) return;
      await primeIngredientCatalog(session);
      if (editLoadSessionRef.current !== session) return;
      setEditorSection(options?.initialSection ?? 'details');
      setIsModalOpen(true);
    },
    [fetchRecipe, fetchModifierDeltas, primeIngredientCatalog],
  );

  const columns: SharedDataGridColumn<MenuItem>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Item',
        sortable: true,
        hideable: false,
        render: (item) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-muted-foreground">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{item.name}</p>
              <p className="truncate text-xs text-muted-foreground">{item.description || '-'}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'categoryName',
        label: 'Category',
        sortable: true,
        render: (item) => <Badge>{item.categoryName}</Badge>,
      },
      {
        id: 'basePrice',
        label: 'Base Price',
        sortable: true,
        render: (item) => `Rs. ${Number(item.basePrice ?? 0).toLocaleString()}`,
      },
      {
        id: 'prepTimeMinutes',
        label: 'Prep',
        sortable: true,
        render: (item) => `${item.prepTimeMinutes} min`,
      },
      {
        id: 'availability',
        label: 'Availability',
        sortable: true,
        render: (item) => <AvailabilityBadge status={item.availability} />,
      },
      {
        id: 'recipe',
        label: 'Recipe',
        sortable: false,
        render: (item) => (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => void openEditModal(item, { initialSection: 'recipe' })}
          >
            Recipe
          </Button>
        ),
      },
    ],
    [openEditModal],
  );

  return (
    <div className={adminPageRootClass}>
      <div className={adminPageContainerClass}>
        <div className={adminPageDenseStackClass}>
          <AdminPageHeader
            title="Menu Control"
            description="Catalog, pricing, modifiers, recipes, and ingredient impacts — edit any item to manage its recipe on the Recipe tab."
            actions={
              <Button onClick={openCreateModal} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add New Item
              </Button>
            }
          />

      <DataPanel>
        <div className="mb-4 space-y-3 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">Category Management</h3>
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              value={categoryDraft}
              onChange={(e) => setCategoryDraft(e.target.value)}
            />
            <Button type="button" onClick={createCategory} disabled={categoryBusy || !categoryDraft.trim()}>
              Add Category
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {categories.map((category) => {
              const isEditing = editingCategoryId === category.id;
              return (
                <div key={category.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  {isEditing ? (
                    <Input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium">{category.name}</span>
                  )}
                  {isEditing ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveCategoryEdit}
                      disabled={categoryBusy || !editingCategoryName.trim()}
                    >
                      Save
                    </Button>
                  ) : (
                    <IconButton
                      type="button"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingCategoryName(category.name);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </IconButton>
                  )}
                  <IconButton
                    type="button"
                    variant="destructive"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => deleteCategory(category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              );
            })}
          </div>
        </div>
        {fetchError ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {fetchError}
          </p>
        ) : null}
        <SharedDataGrid
          rows={items}
          rowId={(item) => item.itemId}
          columns={columns}
          loading={loading}
          errorText={fetchError}
          emptyText="No menu items found."
          total={total}
          page={query.page}
          pageSize={query.pageSize}
          search={query.search}
          sortBy={query.sortBy}
          sortDir={query.sortDir}
          presetKey="admin-menu-grid"
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
            <div className="flex items-center justify-end gap-2">
              <IconButton
                type="button"
                aria-label={`Edit ${item.name}`}
                onClick={() => openEditModal(item)}
              >
                <Edit2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                type="button"
                variant="destructive"
                aria-label={`Delete ${item.name}`}
                onClick={() => handleDelete(item.itemId)}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          )}
          selectionMode="none"
        />
      </DataPanel>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            editLoadSessionRef.current += 1;
            setEditingItem(null);
            setJsonError(null);
            setEditorSection('details');
            setMenuPhotoError(null);
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(88vh,900px)] w-full max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden gap-0 rounded-xl border border-border bg-card p-0 shadow-xl sm:max-w-2xl"
        >
          <DialogHeader className="border-b border-border bg-muted/25 px-5 py-3.5 text-left sm:px-6">
            <DialogTitle className="pr-10 text-lg font-bold tracking-tight">
              {editingItem?.itemId ? 'Edit menu item' : 'New menu item'}
            </DialogTitle>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              One section at a time — switch tabs to edit each part
            </p>
            <div
              className="mt-3.5 flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Menu item editor sections"
            >
              <Button
                type="button"
                size="sm"
                variant={editorSection === 'details' ? 'default' : 'outline'}
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={() => setEditorSection('details')}
              >
                <Package className="h-3.5 w-3.5" /> Details
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editorSection === 'modifiers' ? 'default' : 'outline'}
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={() => setEditorSection('modifiers')}
              >
                <Settings2 className="h-3.5 w-3.5" /> Modifiers
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editorSection === 'recipe' ? 'default' : 'outline'}
                className="h-8 gap-1 px-2.5 text-xs"
                onClick={() => setEditorSection('recipe')}
              >
                <ChefHat className="h-3.5 w-3.5" /> Recipe
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editorSection === 'impacts' ? 'default' : 'outline'}
                className="h-8 gap-1 px-2.5 text-xs"
                title="Ingredient deltas when a modifier option is chosen"
                onClick={() => setEditorSection('impacts')}
              >
                <Blend className="h-3.5 w-3.5" /> Impacts
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateOrUpdate} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-5">
              <div className="mx-auto w-full space-y-4">
                {menuPhotoError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {menuPhotoError}
                  </p>
                ) : null}

                {editorSection === 'details' ? (
                  <div className={menuModalPanelClass}>
                    <h4 className={adminSectionEyebrowClass}>Details</h4>
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="menu-item-name">Item name</Label>
                        <Input
                          id="menu-item-name"
                          required
                          className="h-9 bg-muted/50"
                          value={editingItem?.name || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="menu-item-category">Category</Label>
                        <select
                          id="menu-item-category"
                          required
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={editingItem?.categoryId || ''}
                          onChange={(e) => {
                            const categoryId = e.target.value;
                            const categoryName = categories.find((category) => category.id === categoryId)?.name ?? '';
                            setEditingItem({ ...editingItem, categoryId, categoryName });
                          }}
                        >
                          <option value="">Select…</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-1.5">
                      <Label htmlFor="menu-item-description">Description</Label>
                      <Textarea
                        id="menu-item-description"
                        rows={2}
                        className="min-h-[4rem] resize-y bg-muted/50"
                        value={editingItem?.description || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="flex max-w-full flex-col gap-1.5 sm:max-w-[11rem]">
                        <Label htmlFor="menu-item-price">Base price</Label>
                        <Input
                          id="menu-item-price"
                          type="number"
                          step="0.01"
                          required
                          className="h-9 bg-muted/50"
                          value={editingItem?.basePrice || 0}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, basePrice: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                      <div className="flex max-w-full flex-col gap-1.5 sm:max-w-[11rem]">
                        <Label htmlFor="menu-item-prep-time">Prep (min)</Label>
                        <Input
                          id="menu-item-prep-time"
                          type="number"
                          min={0}
                          required
                          className="h-9 bg-muted/50"
                          value={editingItem?.prepTimeMinutes ?? 0}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, prepTimeMinutes: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Availability</Label>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={editingItem?.availability || 'available'}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              availability: e.target.value as MenuItem['availability'],
                            })
                          }
                        >
                          <option value="available">Available</option>
                          <option value="sold_out">Sold out</option>
                          <option value="limited">Limited</option>
                        </select>
                      </div>
                    </div>
                    <MenuItemPhotoEditor
                      ref={photoEditorRef}
                      imageUrl={editingItem?.imageUrl}
                      onChange={(url) =>
                        setEditingItem((prev) => (prev ? { ...prev, imageUrl: url } : null))
                      }
                      onClientError={setMenuPhotoError}
                    />
                  </div>
                ) : null}

                {editorSection === 'modifiers' ? (
                  <div className={menuModalPanelClass}>
                    <div className="flex items-center justify-between">
                      <h4 className={adminSectionEyebrowClass}>Modifier authoring</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (jsonMode) {
                            try {
                              const parsed = JSON.parse(jsonDraft);
                              if (!Array.isArray(parsed)) {
                                setJsonError('Modifier JSON must be an array');
                                return;
                              }
                              setModifierGroups(parsed);
                              setJsonError(null);
                            } catch {
                              setJsonError('Invalid JSON');
                              return;
                            }
                          } else {
                            setJsonDraft(JSON.stringify(modifierGroups, null, 2));
                          }
                          setJsonMode((prev) => !prev);
                        }}
                      >
                        {jsonMode ? 'Use visual builder' : 'Use JSON mode'}
                      </Button>
                    </div>
                    {jsonMode ? (
                      <div className="space-y-2">
                        <Textarea
                          aria-label="Modifier groups as JSON"
                          value={jsonDraft}
                          onChange={(e) => {
                            setJsonDraft(e.target.value);
                            try {
                              const parsed = JSON.parse(e.target.value);
                              if (!Array.isArray(parsed)) {
                                setJsonError('Modifier JSON must be an array');
                                return;
                              }
                              setModifierGroups(parsed);
                              setJsonError(null);
                            } catch {
                              setJsonError('Invalid JSON');
                            }
                          }}
                          className="min-h-[160px] bg-muted/40 font-mono text-sm sm:min-h-[180px]"
                        />
                        {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
                      </div>
                    ) : (
                      <ModifierBuilder
                        value={modifierGroups}
                        onChange={(next) => {
                          setModifierGroups(next);
                          setJsonDraft(JSON.stringify(next, null, 2));
                        }}
                      />
                    )}
                  </div>
                ) : null}

                {editorSection === 'recipe' ? (
                  <div className={menuModalPanelClass}>
                    <h4 className={adminSectionEyebrowClass}>Recipe builder</h4>
                    <RecipeBuilder
                      ingredients={ingredients}
                      fetchIngredientOptions={searchIngredientOptions}
                      lines={recipeLines}
                      onChange={setRecipeLines}
                    />
                  </div>
                ) : null}

                {editorSection === 'impacts' ? (
                  <div className={menuModalPanelClass}>
                    <h4 className={adminSectionEyebrowClass}>Modifier to ingredient impacts</h4>
                    <p className="text-xs text-muted-foreground">
                      These deltas are applied on top of the base recipe when a modifier option is selected.
                    </p>
                    <ModifierDeltaBuilder
                      modifierGroups={modifierGroups}
                      ingredients={ingredients}
                      fetchIngredientOptions={searchIngredientOptions}
                      value={modifierDeltas}
                      onChange={setModifierDeltas}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t border-border bg-card px-4 py-3 sm:px-5 sm:justify-between">
              <div className="hidden text-xs text-muted-foreground sm:block">
                <span className="capitalize">{editorSection}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-2">
                  <Save className="h-4 w-4" />{' '}
                  {editingItem?.itemId ? 'Update Item' : 'Create Item'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
