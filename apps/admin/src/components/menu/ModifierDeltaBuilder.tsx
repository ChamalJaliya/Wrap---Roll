'use client';

import React, { useMemo } from 'react';
import { Button, Input, Label } from '@wrap-roll/shared-ui';
import type { ModifierGroupInput } from '@wrap-roll/contracts';
import { IngredientSearchSelect } from './IngredientSearchSelect';

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
};

export type ModifierIngredientDelta = {
  optionId: string;
  ingredientId: string;
  quantityDelta: number;
};

type Props = {
  modifierGroups: ModifierGroupInput[];
  ingredients: IngredientOption[];
  fetchIngredientOptions?: (query: string) => Promise<IngredientOption[]>;
  value: ModifierIngredientDelta[];
  onChange: (next: ModifierIngredientDelta[]) => void;
};

function rowsForOption(
  deltas: ModifierIngredientDelta[],
  optionId: string,
): ModifierIngredientDelta[] {
  return deltas.filter((d) => d.optionId === optionId);
}

export function ModifierDeltaBuilder({
  modifierGroups,
  ingredients,
  fetchIngredientOptions,
  value,
  onChange,
}: Props) {
  const ingredientById = useMemo(() => {
    const map = new Map<string, IngredientOption>();
    for (const i of ingredients) map.set(i.id, i);
    return map;
  }, [ingredients]);

  const updateRow = (idx: number, patch: Partial<ModifierIngredientDelta>) => {
    const next = value.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRow = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const addRow = (optionId: string) => {
    const firstIngredientId = ingredients[0]?.id ?? '';
    const next = [
      ...value,
      { optionId, ingredientId: firstIngredientId, quantityDelta: 0 },
    ];
    onChange(next);
  };

  if (!modifierGroups.length) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        Add modifier groups/options first to configure ingredient impacts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {modifierGroups.map((group) => (
        <div key={group.groupId} className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{group.name || 'Untitled group'}</p>
              <p className="text-xs text-muted-foreground">
                Configure per-option ingredient deltas (additional consumption per item).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {group.options.map((opt) => {
              const optionId = opt.optionId ?? '';
              const optRows = optionId ? rowsForOption(value, optionId) : [];
              return (
                <div key={opt.optionId ?? opt.label} className="rounded-lg border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{opt.label || 'Untitled option'}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addRow(optionId)}
                      disabled={ingredients.length === 0 || !optionId}
                    >
                      Add ingredient impact
                    </Button>
                  </div>

                  {optRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No ingredient impacts configured.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {optRows.map((row) => {
                        const globalIdx = value.indexOf(row);
                        const ingredient = ingredientById.get(row.ingredientId);
                        return (
                          <div
                            key={`${row.optionId}-${row.ingredientId}-${globalIdx}`}
                            className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_160px_90px]"
                          >
                            <div className="min-w-0">
                              <IngredientSearchSelect
                                label="Ingredient"
                                ingredients={ingredients}
                                fetchOptions={fetchIngredientOptions}
                                value={row.ingredientId}
                                onChange={(id) => updateRow(globalIdx, { ingredientId: id })}
                                placeholder="Search ingredients…"
                                resetSelectionOnFilterMismatch={false}
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs">
                                Qty delta ({ingredient?.unit ?? 'unit'})
                              </Label>
                              <Input
                                type="number"
                                step="0.001"
                                className="bg-muted/30"
                                value={row.quantityDelta}
                                onChange={(e) =>
                                  updateRow(globalIdx, {
                                    quantityDelta: Number(e.target.value),
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-end justify-end">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeRow(globalIdx)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

