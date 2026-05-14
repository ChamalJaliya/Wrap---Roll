'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@wrap-roll/shared-ui';

export type IngredientSearchOption = {
  id: string;
  name: string;
  unit: string;
};

type Props = {
  label?: string;
  ingredients: IngredientSearchOption[];
  value: string;
  onChange: (ingredientId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  id?: string;
  className?: string;
  fetchOptions?: (query: string) => Promise<IngredientSearchOption[]>;
  resetSelectionOnFilterMismatch?: boolean;
};

const SEARCH_DEBOUNCE_MS = 220;

function ingredientMatchesQuery(i: IngredientSearchOption, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return (
    i.name.toLowerCase().includes(n) ||
    i.unit.toLowerCase().includes(n) ||
    i.id.toLowerCase().includes(n)
  );
}

export function IngredientSearchSelect({
  label,
  ingredients,
  value,
  onChange,
  disabled,
  placeholder = 'Choose ingredient…',
  searchPlaceholder = 'Search by name, unit, or id…',
  id: idProp,
  className,
  fetchOptions,
  resetSelectionOnFilterMismatch = true,
}: Props) {
  const autoId = useId();
  const searchInputId = idProp ?? `ingredient-combobox-search-${autoId}`;
  const listboxId = `${searchInputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [asyncRows, setAsyncRows] = useState<IngredientSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const pickedRef = useRef<Map<string, IngredientSearchOption>>(new Map());
  const asyncReqRef = useRef(0);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  const asyncMode = Boolean(fetchOptions);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!asyncMode || !fetchOptions || !open) return;
    let cancelled = false;
    const req = ++asyncReqRef.current;
    setLoading(true);
    void fetchOptions(debouncedSearch)
      .then((rows) => {
        if (cancelled || asyncReqRef.current !== req) return;
        setAsyncRows(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (cancelled || asyncReqRef.current !== req) return;
        setAsyncRows([]);
      })
      .finally(() => {
        if (cancelled || asyncReqRef.current !== req) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asyncMode, fetchOptions, debouncedSearch, open]);

  const syncRows = useMemo(() => {
    if (asyncMode) return [];
    const q = searchQuery;
    return !q.trim()
      ? ingredients
      : ingredients.filter((i) => ingredientMatchesQuery(i, q));
  }, [ingredients, searchQuery, asyncMode]);

  const rows = asyncMode ? asyncRows : syncRows;

  const rowsWithPinned = useMemo(() => {
    if (!value) return rows;
    if (rows.some((r) => r.id === value)) return rows;
    const fromIngredients = ingredients.find((i) => i.id === value);
    const fromPicked = pickedRef.current.get(value);
    const stub: IngredientSearchOption =
      fromIngredients ??
      fromPicked ?? {
        id: value,
        name: ingredients.length === 0 && asyncMode ? 'Loading…' : 'Unknown ingredient',
        unit: '—',
      };
    if (resetSelectionOnFilterMismatch && !asyncMode) {
      return rows;
    }
    return [stub, ...rows];
  }, [rows, value, ingredients, resetSelectionOnFilterMismatch, asyncMode]);

  const displayOption = useMemo(() => {
    if (!value) return null;
    return (
      ingredients.find((i) => i.id === value) ??
      pickedRef.current.get(value) ??
      asyncRows.find((i) => i.id === value) ??
      null
    );
  }, [value, ingredients, asyncRows]);

  const triggerLabel = displayOption
    ? `${displayOption.name} (${displayOption.unit})`
    : placeholder;

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setSearchQuery('');
      setDebouncedSearch('');
      window.requestAnimationFrame(() => {
        popoverContentRef.current?.querySelector('input')?.focus();
      });
    }
  }, []);

  const pick = useCallback(
    (opt: IngredientSearchOption) => {
      pickedRef.current.set(opt.id, opt);
      onChange(opt.id);
      setOpen(false);
    },
    [onChange],
  );

  /** Sync mode only: recipe add row clears selection when inline search excludes the pick */
  useEffect(() => {
    if (asyncMode || !resetSelectionOnFilterMismatch || !open || !value) return;
    const ing = ingredients.find((i) => i.id === value);
    if (!ing) return;
    if (!ingredientMatchesQuery(ing, searchQuery)) onChange('');
  }, [
    asyncMode,
    resetSelectionOnFilterMismatch,
    open,
    value,
    ingredients,
    searchQuery,
    onChange,
  ]);

  const emptyBlocking = !asyncMode && ingredients.length === 0;

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <Label htmlFor={searchInputId} className="text-xs">
          {label}
        </Label>
      ) : null}
      <Popover open={open} onOpenChange={onOpenChange} modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || emptyBlocking}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            className={cn(
              'h-10 w-full justify-between gap-2 px-3 font-normal',
              !displayOption && 'text-muted-foreground',
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={popoverContentRef}
          align="start"
          side="bottom"
          className="flex max-h-[min(380px,52vh)] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="shrink-0 border-b border-border p-2">
            <Input
              id={searchInputId}
              type="search"
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              aria-autocomplete="list"
              aria-controls={listboxId}
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label={label ?? 'Ingredients'}
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-1 [-webkit-overflow-scrolling:touch]"
            onWheel={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                <span className="text-sm">Searching…</span>
              </div>
            ) : rowsWithPinned.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No ingredients match.
              </p>
            ) : (
              rowsWithPinned.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={value === opt.id}
                  className={cn(
                    'flex w-full rounded-md px-2 py-2 text-left text-sm outline-none transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    value === opt.id && 'bg-accent/60',
                  )}
                  onClick={() => pick(opt)}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {opt.name}
                    <span className="text-muted-foreground"> ({opt.unit})</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <p className="shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {asyncMode
              ? loading
                ? 'Searching inventory…'
                : `${asyncRows.length} result${asyncRows.length === 1 ? '' : 's'}`
              : searchQuery.trim()
                ? `${syncRows.length} of ${ingredients.length} match locally`
                : `${ingredients.length} ingredients`}
          </p>
        </PopoverContent>
      </Popover>
      {emptyBlocking ? (
        <p className="text-[11px] text-muted-foreground">
          No ingredients loaded — open Inventory or refresh the page.
        </p>
      ) : null}
    </div>
  );
}
