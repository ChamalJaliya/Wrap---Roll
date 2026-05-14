'use client';

import { Button, Input, Label } from '@wrap-roll/shared-ui';
import type { MenuRecipeLineInput } from '@wrap-roll/contracts';
import { useMemo, useState } from 'react';
import { IngredientSearchSelect } from './IngredientSearchSelect';

type IngredientOption = {
  id: string;
  name: string;
  unit: string;
  currentStock?: number;
  lowStockThreshold?: number;
};

type RecipeBuilderProps = {
  ingredients: IngredientOption[];
  /** Async inventory search (`GET /inventory?search=…`) for the combobox */
  fetchIngredientOptions?: (query: string) => Promise<IngredientOption[]>;
  lines: MenuRecipeLineInput[];
  onChange: (next: MenuRecipeLineInput[]) => void;
};

export function RecipeBuilder({
  ingredients,
  fetchIngredientOptions,
  lines,
  onChange,
}: RecipeBuilderProps) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  const addLine = () => {
    if (!ingredientId) return;
    const quantityUsed = Number(quantity);
    if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) return;
    const existing = lines.find((line) => line.ingredientId === ingredientId);
    if (existing) {
      onChange(
        lines.map((line) =>
          line.ingredientId === ingredientId ? { ...line, quantityUsed } : line,
        ),
      );
    } else {
      onChange([...lines, { ingredientId, quantityUsed }]);
    }
    setIngredientId('');
    setQuantity('1');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-6">
          <IngredientSearchSelect
            label="Ingredient"
            ingredients={ingredients}
            fetchOptions={fetchIngredientOptions}
            value={ingredientId}
            onChange={setIngredientId}
            placeholder="Search ingredients…"
          />
        </div>
        <div className="md:col-span-4 space-y-2">
          <Label className="text-xs">Quantity per 1 menu item</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="md:col-span-2">
          <Button type="button" variant="outline" className="h-10 w-full" onClick={addLine}>
            Add
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No ingredient links yet.</p>
      ) : (
        <div className="space-y-2">
          {lines.map((line) => {
            const ingredient = ingredientMap.get(line.ingredientId);
            const isLow =
              typeof ingredient?.currentStock === 'number' &&
              typeof ingredient?.lowStockThreshold === 'number' &&
              ingredient.currentStock <= ingredient.lowStockThreshold;
            return (
              <div
                key={line.ingredientId}
                className="grid grid-cols-1 gap-2 rounded-lg border p-2 md:grid-cols-12 md:items-center"
              >
                <div className="md:col-span-6">
                  <p className="font-medium">{ingredient?.name ?? line.ingredientId}</p>
                  <p className="text-xs text-muted-foreground">
                    Unit: {ingredient?.unit ?? '-'}
                    {isLow ? ' - low stock' : ''}
                  </p>
                </div>
                <div className="md:col-span-4">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-10"
                    value={line.quantityUsed}
                    onChange={(e) =>
                      onChange(
                        lines.map((value) =>
                          value.ingredientId === line.ingredientId
                            ? { ...value, quantityUsed: Number(e.target.value || 0) }
                            : value,
                        ),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() =>
                      onChange(lines.filter((value) => value.ingredientId !== line.ingredientId))
                    }
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
}
