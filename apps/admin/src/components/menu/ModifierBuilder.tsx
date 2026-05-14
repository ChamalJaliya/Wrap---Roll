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
        <div
          key={group.groupId}
          className="space-y-5 rounded-xl border border-border/80 bg-muted/5 p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Modifier group
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removeGroup(group.groupId!)}
            >
              Remove group
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
            <div className="space-y-1.5 md:col-span-5">
              <Label>Group name</Label>
              <Input
                className="h-10"
                value={group.name}
                placeholder="Title shown to customers for this step"
                onChange={(e) => updateGroup(group.groupId!, { name: e.target.value })}
              />
            </div>
            <div className="md:col-span-4">
              <NativeSelect
                className="h-10 min-h-10 py-2"
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
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label>Required</Label>
              <label className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 shadow-xs">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={group.required}
                  onChange={(e) => updateGroup(group.groupId!, { required: e.target.checked })}
                  aria-label="Require selection from this group"
                />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 md:gap-6">
            <div className="w-full min-w-[7rem] max-w-[10rem] space-y-1.5">
              <Label>Min select</Label>
              <Input
                className="h-10"
                type="number"
                value={group.minSelect}
                onChange={(e) => updateGroup(group.groupId!, { minSelect: Number(e.target.value || 0) })}
              />
            </div>
            <div className="w-full min-w-[7rem] max-w-[10rem] space-y-1.5">
              <Label>Max select</Label>
              <Input
                className="h-10"
                type="number"
                value={group.maxSelect}
                onChange={(e) => updateGroup(group.groupId!, { maxSelect: Number(e.target.value || 1) })}
              />
            </div>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-foreground">Options</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 shrink-0 self-start sm:self-auto"
                onClick={() => addOption(group.groupId!)}
              >
                Add option
              </Button>
            </div>
            <div className="space-y-3">
              {group.options.map((option) => (
                <div
                  key={option.optionId}
                  className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background p-3 md:flex-row md:items-center md:gap-3"
                >
                  <Input
                    className="h-10 min-w-0 md:flex-1"
                    placeholder="Option label"
                    value={option.label}
                    onChange={(e) => updateOption(group.groupId!, option.optionId!, { label: e.target.value })}
                  />
                  <Input
                    className="h-10 md:w-[9rem]"
                    type="number"
                    placeholder="Price adjust"
                    value={option.priceAdjust}
                    onChange={(e) =>
                      updateOption(group.groupId!, option.optionId!, {
                        priceAdjust: Number(e.target.value || 0),
                      })
                    }
                  />
                  <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs md:w-[7.5rem]">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
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
                    className="h-10 shrink-0 md:w-10 md:px-0"
                    onClick={() => removeOption(group.groupId!, option.optionId!)}
                    aria-label="Remove option"
                  >
                    X
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
