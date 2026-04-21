'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  Package,
  RefreshCw,
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
  PageHeader,
  SharedDataGrid,
  SharedDataGridColumn,
  Textarea,
} from '@wrap-roll/shared-ui';
import type { MenuRecipeLineInput, ModifierGroupInput } from '@wrap-roll/contracts';
import { ModifierBuilder } from '../../components/menu/ModifierBuilder';
import { RecipeBuilder } from '../../components/menu/RecipeBuilder';
import {
  ModifierDeltaBuilder,
  type ModifierIngredientDelta,
} from '../../components/menu/ModifierDeltaBuilder';
import {
  MenuItemPhotoEditor,
  type MenuItemPhotoEditorHandle,
} from '../../components/menu/MenuItemPhotoEditor';

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
  const [activeRecipeMenuId, setActiveRecipeMenuId] = useState<string | null>(null);
  const [workspaceRecipeLines, setWorkspaceRecipeLines] = useState<MenuRecipeLineInput[]>([]);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [editorSection, setEditorSection] = useState<'details' | 'modifiers' | 'recipe' | 'impacts'>('details');
  const [menuPhotoError, setMenuPhotoError] = useState<string | null>(null);
  const photoEditorRef = useRef<MenuItemPhotoEditorHandle>(null);
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
    fetchIngredients();
    fetchCategories();
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

  const fetchIngredients = async () => {
    try {
      const response = await api.get('/inventory?page=1&limit=500');
      const source = Array.isArray(response.data) ? response.data : response.data?.items ?? [];
      setIngredients(
        source.map((item: any) => ({
          id: String(item.id),
          name: String(item.name),
          unit: String(item.unit),
          currentStock: Number(item.currentStock),
          lowStockThreshold: Number(item.lowStockThreshold),
        })),
      );
    } catch {
      setIngredients([]);
    }
  };

  const fetchRecipe = async (menuItemId: string) => {
    const response = await api.get<MenuRecipeResponse>(`/menu/${menuItemId}/recipe`);
    return response.data.lines.map((line) => ({
      ingredientId: line.ingredientId,
      quantityUsed: Number(line.quantityUsed),
    }));
  };

  const fetchModifierDeltas = async (menuItemId: string) => {
    const response = await api.get<{ deltas: Array<{ optionId: string; ingredientId: string; quantityDelta: string }> }>(
      `/menu/${menuItemId}/modifier-deltas`,
    );
    return (response.data?.deltas ?? []).map((d) => ({
      optionId: d.optionId,
      ingredientId: d.ingredientId,
      quantityDelta: Number(d.quantityDelta),
    }));
  };

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
  };

  const openEditModal = async (item: MenuItem) => {
    setMenuPhotoError(null);
    setEditingItem(item);
    const groups = Array.isArray(item.modifierGroups) ? item.modifierGroups : [];
    setModifierGroups(groups);
    setJsonDraft(JSON.stringify(groups, null, 2));
    setJsonMode(false);
    setJsonError(null);
    setEditorSection('details');
    try {
      const lines = await fetchRecipe(item.itemId);
      setRecipeLines(lines);
    } catch {
      setRecipeLines([]);
    }
    try {
      const deltas = await fetchModifierDeltas(item.itemId);
      setModifierDeltas(deltas);
    } catch {
      setModifierDeltas([]);
    }
    setIsModalOpen(true);
  };

  const openWorkspaceRecipe = async (menuItemId: string) => {
    setActiveRecipeMenuId(menuItemId);
    try {
      const lines = await fetchRecipe(menuItemId);
      setWorkspaceRecipeLines(lines);
    } catch {
      setWorkspaceRecipeLines([]);
    }
  };

  const saveWorkspaceRecipe = async () => {
    if (!activeRecipeMenuId) return;
    setSavingRecipe(true);
    try {
      await api.put(`/menu/${activeRecipeMenuId}/recipe`, { lines: workspaceRecipeLines });
      await fetchItems();
    } finally {
      setSavingRecipe(false);
    }
  };

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
          <Button size="sm" variant="outline" onClick={() => openWorkspaceRecipe(item.itemId)}>
            Manage Recipe
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Control"
        description="Manage your catalog, prices, and modifier groups."
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

      <DataPanel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">Advanced Recipe Workspace</h3>
          <Button
            variant="outline"
            onClick={() => activeRecipeMenuId && openWorkspaceRecipe(activeRecipeMenuId)}
            disabled={!activeRecipeMenuId}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="mb-3">
          <Label htmlFor="recipe-workspace-menu">Select menu item</Label>
          <select
            id="recipe-workspace-menu"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={activeRecipeMenuId ?? ''}
            onChange={async (e) => {
              const value = e.target.value || null;
              setActiveRecipeMenuId(value);
              if (value) {
                await openWorkspaceRecipe(value);
              } else {
                setWorkspaceRecipeLines([]);
              }
            }}
          >
            <option value="">Choose menu item...</option>
            {items.map((item) => (
              <option key={item.itemId} value={item.itemId}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {activeRecipeMenuId ? (
          <div className="space-y-3">
            <RecipeBuilder
              ingredients={ingredients}
              lines={workspaceRecipeLines}
              onChange={setWorkspaceRecipeLines}
            />
            <Button onClick={saveWorkspaceRecipe} disabled={savingRecipe}>
              {savingRecipe ? 'Saving...' : 'Save Recipe Lines'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a menu item to manage ingredient quantity relations.
          </p>
        )}
      </DataPanel>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingItem(null);
            setJsonError(null);
            setEditorSection('details');
            setMenuPhotoError(null);
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[92vh] w-full max-w-[min(1024px,calc(100vw-2rem))] flex-col overflow-hidden border-0 bg-white p-0 shadow-[0_32px_120px_-40px_rgba(15,23,42,0.42)] sm:max-w-[min(1024px,calc(100vw-2rem))]"
        >
          <DialogHeader className="border-b border-neutral-100 bg-gradient-to-r from-primary/[0.08] via-white to-primary/[0.04] px-8 py-6 text-left sm:px-10 sm:py-7">
            <DialogTitle className="font-display text-2xl font-black tracking-tight text-neutral-900">
              {editingItem?.itemId ? 'Edit Menu Item' : 'Add New Menu Item'}
            </DialogTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Structured editor for details, modifiers, recipes and ingredient impacts
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5 md:flex-nowrap md:gap-3">
              <Button type="button" size="default" variant={editorSection === 'details' ? 'default' : 'outline'} onClick={() => setEditorSection('details')}>
                <Package className="mr-1.5 h-4 w-4" /> Details
              </Button>
              <Button type="button" size="default" variant={editorSection === 'modifiers' ? 'default' : 'outline'} onClick={() => setEditorSection('modifiers')}>
                <Settings2 className="mr-1.5 h-4 w-4" /> Modifiers
              </Button>
              <Button type="button" size="default" variant={editorSection === 'recipe' ? 'default' : 'outline'} onClick={() => setEditorSection('recipe')}>
                <ChefHat className="mr-1.5 h-4 w-4" /> Recipe
              </Button>
              <Button type="button" size="default" variant={editorSection === 'impacts' ? 'default' : 'outline'} onClick={() => setEditorSection('impacts')}>
                <Blend className="mr-1.5 h-4 w-4" /> Ingredient Impacts
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateOrUpdate} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50/40 px-8 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto w-full max-w-none space-y-8">
                {menuPhotoError ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                    {menuPhotoError}
                  </p>
                ) : null}
                <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Core details</h4>
                  <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="menu-item-name">Item Name</Label>
                      <Input
                        id="menu-item-name"
                        required
                        className="h-11 bg-muted/40"
                        value={editingItem?.name || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="menu-item-category">Category</Label>
                      <select
                        id="menu-item-category"
                        required
                        className="h-11 rounded-md border bg-background px-3 text-sm"
                        value={editingItem?.categoryId || ''}
                        onChange={(e) => {
                          const categoryId = e.target.value;
                          const categoryName = categories.find((category) => category.id === categoryId)?.name ?? '';
                          setEditingItem({ ...editingItem, categoryId, categoryName });
                        }}
                      >
                        <option value="">Select a category...</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-7 flex flex-col gap-2">
                    <Label htmlFor="menu-item-description">Description</Label>
                    <Textarea
                      id="menu-item-description"
                      rows={3}
                      className="min-h-[5.5rem] resize-y bg-muted/40"
                      value={editingItem?.description || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    />
                  </div>
                  <div className="mt-7 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="menu-item-price">Base Price</Label>
                      <Input
                        id="menu-item-price"
                        type="number"
                        step="0.01"
                        required
                        className="h-11 bg-muted/40"
                        value={editingItem?.basePrice || 0}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, basePrice: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="menu-item-prep-time">Prep Time (min)</Label>
                      <Input
                        id="menu-item-prep-time"
                        type="number"
                        min={0}
                        required
                        className="h-11 bg-muted/40"
                        value={editingItem?.prepTimeMinutes ?? 0}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, prepTimeMinutes: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-2 md:col-span-2 xl:col-span-1">
                      <Label>Availability</Label>
                      <select
                        className="h-11 rounded-md border bg-background px-3 text-sm"
                        value={editingItem?.availability || 'available'}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            availability: e.target.value as MenuItem['availability'],
                          })
                        }
                      >
                        <option value="available">Available</option>
                        <option value="sold_out">Sold Out</option>
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

                {editorSection === 'modifiers' ? (
                  <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Modifier authoring</h4>
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
                          className="min-h-[220px] bg-muted/40 font-mono text-sm"
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
                  <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Recipe builder</h4>
                    <RecipeBuilder ingredients={ingredients} lines={recipeLines} onChange={setRecipeLines} />
                  </div>
                ) : null}

                {editorSection === 'impacts' ? (
                  <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">Modifier to ingredient impacts</h4>
                    <p className="text-xs text-muted-foreground">
                      These deltas are applied on top of the base recipe when a modifier option is selected.
                    </p>
                    <ModifierDeltaBuilder
                      modifierGroups={modifierGroups}
                      ingredients={ingredients}
                      value={modifierDeltas}
                      onChange={setModifierDeltas}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t bg-white px-8 py-5 sm:px-10 sm:justify-between">
              <div className="text-xs font-medium text-muted-foreground">
                Section: <span className="font-semibold capitalize text-foreground">{editorSection}</span>
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
  );
}
