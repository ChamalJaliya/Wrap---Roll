'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Columns3, Filter, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from './ui/button';
import { SearchInput } from './SearchInput';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { cn } from '../lib/utils';

export type GridSortDir = 'asc' | 'desc';
export type GridFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date' | 'datetime';
export type GridFilterOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'is_true'
  | 'is_false'
  | 'before'
  | 'after';

export type GridFilterField = {
  id: string;
  label: string;
  type: GridFieldType;
  options?: { label: string; value: string }[];
};

export type GridFilterRule = {
  id: string;
  field: string;
  op: GridFilterOperator;
  value?: string | number | boolean;
  valueTo?: string | number;
};

export type GridFilterGroup = {
  logic: 'AND' | 'OR';
  rules: GridFilterRule[];
};

export type GridPresetState = {
  visibleColumns: string[];
  sortBy?: string;
  sortDir?: GridSortDir;
  pageSize: number;
  search: string;
  filters?: GridFilterGroup;
};

type GridPresetFile = {
  version: 1;
  presets: Record<string, GridPresetState>;
  defaultPreset?: string;
};

export type SharedDataGridColumn<T> = {
  id: string;
  label: string;
  sortable?: boolean;
  hideable?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
};

export type SharedDataGridBulkAction<T> = {
  id: string;
  label: string;
  onClick: (rows: T[]) => Promise<void> | void;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
};

export type SharedDataGridFilterBadge = {
  id: string;
  label: string;
  onClear: () => void;
};

export type SharedDataGridProps<T> = {
  rows: T[];
  rowId: (row: T) => string;
  columns: SharedDataGridColumn<T>[];
  loading?: boolean;
  emptyText?: string;
  errorText?: string | null;
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  search?: string;
  sortBy?: string;
  sortDir?: GridSortDir;
  onQueryChange: (next: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortDir?: GridSortDir;
  }) => void;
  filtersSlot?: ReactNode;
  activeFilterBadges?: SharedDataGridFilterBadge[];
  filterFields?: GridFilterField[];
  filters?: GridFilterGroup;
  onFiltersChange?: (next?: GridFilterGroup) => void;
  rowActions?: (row: T) => ReactNode;
  bulkActions?: SharedDataGridBulkAction<T>[];
  selectionMode?: 'none' | 'single' | 'multiple';
  presetKey?: string;
};

const PRESET_VERSION = 1;

function loadPresetFile(storageKey: string): GridPresetFile {
  if (typeof window === 'undefined') return { version: PRESET_VERSION, presets: {} };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { version: PRESET_VERSION, presets: {} };
    const parsed = JSON.parse(raw) as GridPresetFile;
    if (parsed.version !== PRESET_VERSION || !parsed.presets) {
      return { version: PRESET_VERSION, presets: {} };
    }
    return parsed;
  } catch {
    return { version: PRESET_VERSION, presets: {} };
  }
}

function savePresetFile(storageKey: string, data: GridPresetFile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function SharedDataGrid<T>({
  rows,
  rowId,
  columns,
  loading = false,
  emptyText = 'No data found.',
  errorText,
  total,
  page,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  search = '',
  sortBy,
  sortDir,
  onQueryChange,
  filtersSlot,
  activeFilterBadges = [],
  filterFields = [],
  filters,
  onFiltersChange,
  rowActions,
  bulkActions = [],
  selectionMode = 'multiple',
  presetKey,
}: SharedDataGridProps<T>) {
  const [searchValue, setSearchValue] = useState(search);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(columns.map((c) => c.id));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<GridFilterGroup>({ logic: 'AND', rules: [] });

  const storageKey = presetKey ? `wrap-roll:grid-presets:${presetKey}` : null;

  useEffect(() => setSearchValue(search), [search]);
  useEffect(() => {
    const allIds = columns.map((c) => c.id);
    setVisibleColumnIds((prev) => prev.filter((id) => allIds.includes(id)));
  }, [columns]);
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => rowId(r) === id)));
  }, [rows, rowId]);
  useEffect(() => {
    setDraftFilters(filters ?? { logic: 'AND', rules: [] });
  }, [filters]);

  useEffect(() => {
    if (!storageKey) return;
    const presetFile = loadPresetFile(storageKey);
    const toApply = presetFile.defaultPreset ? presetFile.presets[presetFile.defaultPreset] : null;
    if (!toApply) return;
    setActivePreset(presetFile.defaultPreset ?? null);
    setVisibleColumnIds(toApply.visibleColumns);
    onQueryChange({
      page: 1,
      pageSize: toApply.pageSize,
      search: toApply.search,
      sortBy: toApply.sortBy,
      sortDir: toApply.sortDir,
    });
    onFiltersChange?.(toApply.filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const visibleColumns = useMemo(
    () => columns.filter((col) => visibleColumnIds.includes(col.id)),
    [columns, visibleColumnIds],
  );
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(rowId(r))),
    [rows, selectedIds, rowId],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelectedOnPage = rows.length > 0 && rows.every((r) => selectedIds.includes(rowId(r)));

  const toggleSelection = (id: string) => {
    if (selectionMode === 'none') return;
    if (selectionMode === 'single') {
      setSelectedIds((prev) => (prev[0] === id ? [] : [id]));
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllOnPage = () => {
    if (selectionMode !== 'multiple') return;
    if (allSelectedOnPage) {
      const pageIds = new Set(rows.map((r) => rowId(r)));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    const next = new Set(selectedIds);
    rows.forEach((r) => next.add(rowId(r)));
    setSelectedIds([...next]);
  };

  const toggleSort = (columnId: string) => {
    if (sortBy !== columnId) {
      onQueryChange({ page: 1, sortBy: columnId, sortDir: 'asc' });
      return;
    }
    if (sortDir === 'asc') {
      onQueryChange({ page: 1, sortBy: columnId, sortDir: 'desc' });
      return;
    }
    onQueryChange({ page: 1, sortBy: undefined, sortDir: undefined });
  };

  const presetState: GridPresetState = {
    visibleColumns: visibleColumnIds,
    sortBy,
    sortDir,
    pageSize,
    search,
    filters,
  };

  const savePreset = () => {
    if (!storageKey) return;
    const name = window.prompt('Preset name');
    if (!name) return;
    const key = name.trim();
    if (!key) return;
    const file = loadPresetFile(storageKey);
    const next: GridPresetFile = {
      version: PRESET_VERSION,
      presets: { ...file.presets, [key]: presetState },
      defaultPreset: key,
    };
    savePresetFile(storageKey, next);
    setActivePreset(key);
  };

  const applyPreset = (name: string) => {
    if (!storageKey) return;
    const file = loadPresetFile(storageKey);
    const nextPreset = file.presets[name];
    if (!nextPreset) return;
    setVisibleColumnIds(nextPreset.visibleColumns);
    onQueryChange({
      page: 1,
      pageSize: nextPreset.pageSize,
      search: nextPreset.search,
      sortBy: nextPreset.sortBy,
      sortDir: nextPreset.sortDir,
    });
    onFiltersChange?.(nextPreset.filters);
    savePresetFile(storageKey, { ...file, defaultPreset: name });
    setActivePreset(name);
  };

  const resetPresets = () => {
    if (!storageKey) return;
    savePresetFile(storageKey, { version: PRESET_VERSION, presets: {} });
    setActivePreset(null);
  };

  const presetNames = useMemo(() => {
    if (!storageKey) return [];
    return Object.keys(loadPresetFile(storageKey).presets);
  }, [storageKey, activePreset]);
  const sortColumnLabel = useMemo(
    () => columns.find((column) => column.id === sortBy)?.label ?? sortBy,
    [columns, sortBy],
  );
  const operatorOptions: Record<GridFieldType, GridFilterOperator[]> = {
    string: ['contains', 'equals', 'starts_with', 'ends_with', 'in'],
    number: ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'in'],
    boolean: ['is_true', 'is_false', 'equals'],
    enum: ['equals', 'in'],
    date: ['before', 'after', 'between', 'equals'],
    datetime: ['before', 'after', 'between', 'equals'],
  };
  const operatorLabel: Record<GridFilterOperator, string> = {
    contains: 'contains',
    equals: 'is',
    starts_with: 'starts with',
    ends_with: 'ends with',
    gt: 'greater than',
    gte: 'at least',
    lt: 'less than',
    lte: 'at most',
    between: 'between',
    in: 'is any of',
    is_true: 'is yes',
    is_false: 'is no',
    before: 'before',
    after: 'after',
  };
  const formatRuleBadge = (rule: GridFilterRule): string => {
    const field = filterFields.find((f) => f.id === rule.field);
    if (!field) return `${rule.field} ${rule.op}`;
    const op = operatorLabel[rule.op] ?? rule.op.replace('_', ' ');
    if (rule.op === 'is_true' || rule.op === 'is_false') {
      return `${field.label} ${op}`;
    }
    if (rule.op === 'between') {
      return `${field.label} between ${String(rule.value ?? '')} and ${String(rule.valueTo ?? '')}`;
    }
    return `${field.label} ${op} ${String(rule.value ?? '')}`;
  };
  const hasRuleFilters = (filters?.rules?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onQueryChange({ page: 1, search: searchValue });
            }
          }}
          placeholder="Search..."
          containerClassName="min-w-[240px] max-w-md"
        />
        <Button className="shadow-sm" onClick={() => onQueryChange({ page: 1, search: searchValue })}>
          Search
        </Button>
        {filtersSlot}
        {filterFields.length > 0 ? (
          <Button variant="outline" className="shadow-sm" onClick={() => setIsFilterDialogOpen(true)}>
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="shadow-sm">
              <Columns3 className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={visibleColumnIds.includes(column.id)}
                disabled={column.hideable === false}
                onCheckedChange={(checked) => {
                  setVisibleColumnIds((prev) => {
                    if (checked) return [...new Set([...prev, column.id])];
                    return prev.filter((id) => id !== column.id);
                  });
                }}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {storageKey ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-sm">
                <Save className="h-4 w-4" />
                {activePreset ? `Preset: ${activePreset}` : 'Presets'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={savePreset}>Save current preset</DropdownMenuItem>
              <DropdownMenuSeparator />
              {presetNames.length === 0 ? (
                <DropdownMenuLabel>No presets yet</DropdownMenuLabel>
              ) : (
                presetNames.map((name) => (
                  <DropdownMenuItem key={name} onClick={() => applyPreset(name)}>
                    {name}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetPresets}>Reset presets</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2">
        {hasRuleFilters ? (
          <span className="inline-flex items-center rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
            Filters: {filters?.logic === 'OR' ? 'Match any' : 'Match all'}
          </span>
        ) : null}
        {search.trim() ? (
          <button
            type="button"
            onClick={() => onQueryChange({ page: 1, search: '' })}
            className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            Search: {search.trim()}
            <X className="h-3 w-3" />
          </button>
        ) : null}
        {sortBy && sortDir ? (
          <button
            type="button"
            onClick={() => onQueryChange({ page: 1, sortBy: undefined, sortDir: undefined })}
            className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            Sort: {sortColumnLabel} ({sortDir === 'asc' ? 'Asc' : 'Desc'})
            <X className="h-3 w-3" />
          </button>
        ) : null}
        {activeFilterBadges.map((badge) => (
          <button
            key={badge.id}
            type="button"
            onClick={badge.onClear}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition hover:bg-primary/15"
          >
            {badge.label}
            <X className="h-3 w-3" />
          </button>
        ))}
        {(filters?.rules ?? []).map((rule) => (
          <button
            key={rule.id}
            type="button"
            onClick={() =>
              onFiltersChange?.({
                logic: filters?.logic ?? 'AND',
                rules: (filters?.rules ?? []).filter((r) => r.id !== rule.id),
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition hover:bg-primary/15"
          >
            {formatRuleBadge(rule)}
            <X className="h-3 w-3" />
          </button>
        ))}
        {hasRuleFilters ? (
          <button
            type="button"
            onClick={() => onFiltersChange?.(undefined)}
            className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm transition hover:bg-muted"
          >
            Clear all filters
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {bulkActions.length > 0 && selectionMode !== 'none' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 shadow-sm">
          <span className="text-sm font-medium text-foreground">{selectedRows.length} selected</span>
          {bulkActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant ?? 'outline'}
              onClick={() => action.onClick(selectedRows)}
              disabled={selectedRows.length === 0}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <Table className="[&_tbody_tr:last-child]:border-b-0">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {selectionMode !== 'none' ? (
              <TableHead className="w-10">
                {selectionMode === 'multiple' ? (
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleAllOnPage}
                    aria-label="Select all rows"
                  />
                ) : null}
              </TableHead>
            ) : null}
            {visibleColumns.map((column) => (
              <TableHead key={column.id} className={column.headerClassName}>
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left font-semibold text-foreground/90 transition hover:text-foreground"
                    onClick={() => toggleSort(column.id)}
                  >
                    {column.label}
                    {sortBy === column.id ? (
                      sortDir === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )
                    ) : null}
                  </button>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
            {rowActions ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleColumns.length + (selectionMode !== 'none' ? 1 : 0) + (rowActions ? 1 : 0)}
                className="py-10 text-center text-muted-foreground"
              >
                Loading...
              </TableCell>
            </TableRow>
          ) : errorText ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleColumns.length + (selectionMode !== 'none' ? 1 : 0) + (rowActions ? 1 : 0)}
                className="py-10 text-center text-destructive"
              >
                {errorText}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleColumns.length + (selectionMode !== 'none' ? 1 : 0) + (rowActions ? 1 : 0)}
                className="py-10 text-center text-muted-foreground"
              >
                <div className="space-y-1">
                  <p>{emptyText}</p>
                  {hasRuleFilters || search.trim() ? (
                    <div className="flex justify-center gap-2">
                      {search.trim() ? (
                        <Button size="sm" variant="outline" onClick={() => onQueryChange({ page: 1, search: '' })}>
                          Clear search
                        </Button>
                      ) : null}
                      {hasRuleFilters ? (
                        <Button size="sm" variant="outline" onClick={() => onFiltersChange?.(undefined)}>
                          Clear filters
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const id = rowId(row);
              const selected = selectedIds.includes(id);
              return (
                <TableRow
                  key={id}
                  className={cn(
                    'transition-colors hover:bg-muted/40',
                    selected ? 'bg-primary/5 hover:bg-primary/10' : undefined,
                  )}
                  onClick={() => (selectionMode === 'single' ? toggleSelection(id) : undefined)}
                >
                  {selectionMode !== 'none' ? (
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(id)}
                        aria-label={`Select row ${id}`}
                      />
                    </TableCell>
                  ) : null}
                  {visibleColumns.map((column) => (
                    <TableCell key={`${id}-${column.id}`} className={column.className}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {rowActions ? <TableCell className="text-right">{rowActions(row)}</TableCell> : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 shadow-sm">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={pageSize}
            onChange={(e) => onQueryChange({ page: 1, pageSize: Number(e.target.value) })}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onQueryChange({ page: Math.max(1, page - 1) })}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onQueryChange({ page: Math.min(totalPages, page + 1) })}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Filter settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Match</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={draftFilters.logic}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, logic: e.target.value as 'AND' | 'OR' }))
                }
              >
                <option value="AND">All rules (AND)</option>
                <option value="OR">Any rule (OR)</option>
              </select>
            </div>
            {draftFilters.rules.map((rule) => {
              const field = filterFields.find((f) => f.id === rule.field) ?? filterFields[0];
              const ops: GridFilterOperator[] = field ? operatorOptions[field.type] : ['contains'];
              return (
                <div key={rule.id} className="grid grid-cols-1 gap-2 rounded-lg border p-2 md:grid-cols-12">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm md:col-span-4"
                    value={rule.field}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        rules: prev.rules.map((r) =>
                          r.id === rule.id
                            ? {
                                ...r,
                                field: e.target.value,
                                op: operatorOptions[
                                  filterFields.find((f) => f.id === e.target.value)?.type ?? 'string'
                                ][0],
                                value: '',
                                valueTo: undefined,
                              }
                            : r,
                        ),
                      }))
                    }
                  >
                    {filterFields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm md:col-span-3"
                    value={rule.op}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        rules: prev.rules.map((r) =>
                          r.id === rule.id ? { ...r, op: e.target.value as GridFilterOperator } : r,
                        ),
                      }))
                    }
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {operatorLabel[op]}
                      </option>
                    ))}
                  </select>
                  {rule.op !== 'is_true' && rule.op !== 'is_false' ? (
                    <>
                      {field?.type === 'enum' && field.options ? (
                        <select
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm md:col-span-3"
                          value={String(rule.value ?? '')}
                          onChange={(e) =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              rules: prev.rules.map((r) =>
                                r.id === rule.id ? { ...r, value: e.target.value } : r,
                              ),
                            }))
                          }
                        >
                          <option value="">Select</option>
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm md:col-span-3"
                          type={field?.type === 'number' ? 'number' : field?.type === 'date' || field?.type === 'datetime' ? 'date' : 'text'}
                          value={String(rule.value ?? '')}
                          onChange={(e) =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              rules: prev.rules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, value: field?.type === 'number' ? Number(e.target.value) : e.target.value }
                                  : r,
                              ),
                            }))
                          }
                        />
                      )}
                      {rule.op === 'between' ? (
                        <input
                          className="h-9 rounded-md border border-border bg-background px-2 text-sm md:col-span-1"
                          type={field?.type === 'number' ? 'number' : 'text'}
                          value={String(rule.valueTo ?? '')}
                          onChange={(e) =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              rules: prev.rules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, valueTo: field?.type === 'number' ? Number(e.target.value) : e.target.value }
                                  : r,
                              ),
                            }))
                          }
                        />
                      ) : null}
                    </>
                  ) : (
                    <div className="md:col-span-3" />
                  )}
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="md:col-span-1"
                    onClick={() =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        rules: prev.rules.filter((r) => r.id !== rule.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              onClick={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  rules: [
                    ...prev.rules,
                    {
                      id: crypto.randomUUID(),
                      field: filterFields[0]?.id ?? '',
                      op: operatorOptions[filterFields[0]?.type ?? 'string'][0],
                      value: '',
                    },
                  ],
                }))
              }
              disabled={filterFields.length === 0}
            >
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDraftFilters({ logic: 'AND', rules: [] });
                onFiltersChange?.(undefined);
              }}
            >
              Clear all
            </Button>
            <Button
              onClick={() => {
                const cleaned = draftFilters.rules.filter((rule) => rule.field && (rule.op === 'is_true' || rule.op === 'is_false' || rule.value !== '' && rule.value !== undefined));
                onFiltersChange?.(cleaned.length ? { logic: draftFilters.logic, rules: cleaned } : undefined);
                onQueryChange({ page: 1 });
                setIsFilterDialogOpen(false);
              }}
            >
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
