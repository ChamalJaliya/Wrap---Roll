export type ModifierDisplayLine = { label: string; value: string };

function prettifyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Matches kitchen emphasis for allergen / special-instruction style rows. */
export function isModifierLinePriority(label: string): boolean {
  return /note|allerg|spice|no\s|without|special/i.test(label);
}

/**
 * Human-readable modifier rows from stored `modifiersJson` / `modifiers`.
 * Only **dynamic group titles** + values (plus notes). No fixed “base/protein” keys.
 */
export function getOrderItemModifierDisplayLines(raw: unknown): ModifierDisplayLine[] {
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }

  const lines: ModifierDisplayLine[] = [];
  const add = (label: string, value: string | null | undefined) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    lines.push({ label, value: text });
  };

  const pushGroupLines = (groups: unknown[]) => {
    for (const group of groups) {
      if (!group || typeof group !== 'object') continue;
      const g = group as Record<string, unknown>;
      const groupName = String(g.groupName ?? g.name ?? g.group ?? 'Option').trim();
      const options = Array.isArray(g.options)
        ? g.options
        : Array.isArray(g.selectedOptions)
          ? g.selectedOptions
          : [];
      const parts: string[] = [];
      for (const opt of options) {
        if (opt && typeof opt === 'object') {
          const o = opt as Record<string, unknown>;
          const label = String(o.label ?? o.name ?? '').trim();
          if (!label) continue;
          const adjust = Number(o.priceAdjust ?? 0);
          parts.push(
            Number.isFinite(adjust) && adjust > 0 ? `${label} (+${adjust})` : label,
          );
        } else {
          const s = String(opt ?? '').trim();
          if (s) parts.push(s);
        }
      }
      if (parts.length > 0) {
        lines.push({ label: prettifyLabel(groupName || 'Option'), value: parts.join(', ') });
      }
    }
  };

  if (Array.isArray(parsed)) {
    pushGroupLines(parsed);
  } else if (parsed && typeof parsed === 'object') {
    const value = parsed as Record<string, unknown>;
    if (Array.isArray(value.optionGroups) && value.optionGroups.length > 0) {
      pushGroupLines(value.optionGroups);
    }
    const n = value.notes;
    if (typeof n === 'string' && n.trim()) {
      add(prettifyLabel('notes'), n);
    }
  }

  return lines;
}
