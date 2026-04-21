'use client';

import { Button, Input, Label, NativeSelect } from '@wrap-roll/shared-ui';
import type { ModifierGroupInput } from '@wrap-roll/contracts';

type ModifierBuilderProps = {
  value: ModifierGroupInput[];
  onChange: (next: ModifierGroupInput[]) => void;
};

function defaultGroup(): ModifierGroupInput {
  return {
    groupId: randomUUID(),
    name: '',
    type: 'single',
    required: false,
    minSelect: 0,
    maxSelect: 1,
    options: [
      {
        optionId: randomUUID(),
        label: '',
        priceAdjust: 0,
        isDefault: false,
      },
    ],
  };
}

function randomUUID(): string {
  return globalThis.crypto?.randomUUID?.() ?? `tmp-${Math.random().toString(36).slice(2)}`;
}

export function ModifierBuilder({ value, onChange }: ModifierBuilderProps) {
  const groups = value ?? [];

  const updateGroup = (groupId: string, patch: Partial<ModifierGroupInput>) => {
    onChange(groups.map((group) => (group.groupId === groupId ? { ...group, ...patch } : group)));
  };

  const removeGroup = (groupId: string) => {
    onChange(groups.filter((group) => group.groupId !== groupId));
  };

  const addOption = (groupId: string) => {
    onChange(
      groups.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              options: [
                ...group.options,
                { optionId: randomUUID(), label: '', priceAdjust: 0, isDefault: false },
              ],
            }
          : group,
      ),
    );
  };

  const updateOption = (
    groupId: string,
    optionId: string,
    patch: Partial<ModifierGroupInput['options'][number]>,
  ) => {
    onChange(
      groups.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.optionId === optionId ? { ...option, ...patch } : option,
              ),
            }
          : group,
      ),
    );
  };

  const removeOption = (groupId: string, optionId: string) => {
    onChange(
      groups.map((group) =>
        group.groupId === groupId
          ? { ...group, options: group.options.filter((option) => option.optionId !== optionId) }
          : group,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Modifier groups</h4>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...groups, defaultGroup()])}>
          Add group
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet. Add one to start building choices.</p>
      ) : null}
      {groups.map((group) => (
        <div key={group.groupId} className="space-y-3 rounded-xl border p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Group name</Label>
              <Input
                value={group.name}
                placeholder="Any title — this is what customers see for this step"
                onChange={(e) => updateGroup(group.groupId!, { name: e.target.value })}
              />
            </div>
            <NativeSelect
              label="Type"
              value={group.type}
              onChange={(e) =>
                updateGroup(group.groupId!, {
                  type: e.target.value as 'single' | 'multi',
                  maxSelect: e.target.value === 'single' ? 1 : Math.max(group.maxSelect ?? 1, 1),
                })
              }
            >
              <option value="single">Single choice</option>
              <option value="multi">Multiple choice</option>
            </NativeSelect>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={group.required}
                  onChange={(e) => updateGroup(group.groupId!, { required: e.target.checked })}
                />
                Required
              </label>
              <Button type="button" variant="outline" size="sm" onClick={() => removeGroup(group.groupId!)}>
                Remove group
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Min select</Label>
              <Input
                type="number"
                value={group.minSelect}
                onChange={(e) => updateGroup(group.groupId!, { minSelect: Number(e.target.value || 0) })}
              />
            </div>
            <div className="space-y-1">
              <Label>Max select</Label>
              <Input
                type="number"
                value={group.maxSelect}
                onChange={(e) => updateGroup(group.groupId!, { maxSelect: Number(e.target.value || 1) })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Options</p>
              <Button type="button" size="sm" variant="outline" onClick={() => addOption(group.groupId!)}>
                Add option
              </Button>
            </div>
            {group.options.map((option) => (
              <div key={option.optionId} className="grid grid-cols-1 gap-2 rounded-lg border p-2 md:grid-cols-12">
                <Input
                  className="md:col-span-6"
                  placeholder="Option label"
                  value={option.label}
                  onChange={(e) => updateOption(group.groupId!, option.optionId!, { label: e.target.value })}
                />
                <Input
                  className="md:col-span-3"
                  type="number"
                  placeholder="Price adjust"
                  value={option.priceAdjust}
                  onChange={(e) =>
                    updateOption(group.groupId!, option.optionId!, {
                      priceAdjust: Number(e.target.value || 0),
                    })
                  }
                />
                <label className="md:col-span-2 flex items-center gap-2 rounded-md border px-2 text-sm">
                  <input
                    type="checkbox"
                    checked={option.isDefault}
                    onChange={(e) =>
                      updateOption(group.groupId!, option.optionId!, { isDefault: e.target.checked })
                    }
                  />
                  Default
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="md:col-span-1"
                  onClick={() => removeOption(group.groupId!, option.optionId!)}
                >
                  X
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
