export type ListFilterLogic = 'AND' | 'OR';

export type ListFilterRule = {
  field: string;
  op: string;
  value?: string | number | boolean;
  valueTo?: string | number;
};

export type ListFilterGroup = {
  logic?: ListFilterLogic;
  rules?: ListFilterRule[];
};

export type FilterFieldKind = 'string' | 'number' | 'boolean' | 'date' | 'enum';

export type FilterFieldConfig = {
  kind: FilterFieldKind;
  path?: string;
  caseInsensitive?: boolean;
};

type FilterConfigMap = Record<string, FilterFieldConfig>;

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateMs(value: unknown): number | null {
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeValue(value: unknown, kind: FilterFieldKind): unknown {
  if (kind === 'number') return toNumber(value);
  if (kind === 'boolean') {
    if (typeof value === 'boolean') return value;
    const text = normalizeString(value).toLowerCase();
    if (text === 'true') return true;
    if (text === 'false') return false;
    return null;
  }
  if (kind === 'date') return value;
  return value;
}

function compilePrismaRule(rule: ListFilterRule, field: string, config: FilterFieldConfig): Record<string, unknown> | null {
  const op = rule.op;
  const kind = config.kind;
  const value = normalizeValue(rule.value, kind);
  const valueTo = normalizeValue(rule.valueTo, kind);
  const path = config.path ?? field;

  if (op === 'is_true') return { [path]: true };
  if (op === 'is_false') return { [path]: false };
  if (op === 'contains') {
    const text = normalizeString(value);
    if (!text) return null;
    return { [path]: { contains: text, ...(config.caseInsensitive ? { mode: 'insensitive' } : {}) } };
  }
  if (op === 'starts_with') {
    const text = normalizeString(value);
    if (!text) return null;
    return { [path]: { startsWith: text, ...(config.caseInsensitive ? { mode: 'insensitive' } : {}) } };
  }
  if (op === 'ends_with') {
    const text = normalizeString(value);
    if (!text) return null;
    return { [path]: { endsWith: text, ...(config.caseInsensitive ? { mode: 'insensitive' } : {}) } };
  }
  if (op === 'equals') {
    if (value === null || value === undefined || value === '') return null;
    if (kind === 'string' || kind === 'enum') {
      return config.caseInsensitive
        ? { [path]: { equals: String(value), mode: 'insensitive' } }
        : { [path]: String(value) };
    }
    if (kind === 'date') {
      const date = toDateMs(value);
      return date === null ? null : { [path]: new Date(date) };
    }
    return { [path]: value };
  }
  if (op === 'in') {
    const values = String(rule.value ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) return null;
    if (kind === 'number') {
      const numbers = values.map(toNumber).filter((n): n is number => n !== null);
      return numbers.length ? { [path]: { in: numbers } } : null;
    }
    return { [path]: { in: values } };
  }
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    if (kind === 'date') {
      const date = toDateMs(value);
      return date === null ? null : { [path]: { [op]: new Date(date) } };
    }
    if (typeof value !== 'number') return null;
    return { [path]: { [op]: value } };
  }
  if (op === 'between') {
    if (kind === 'date') {
      const start = toDateMs(value);
      const end = toDateMs(valueTo);
      if (start === null || end === null) return null;
      return { [path]: { gte: new Date(Math.min(start, end)), lte: new Date(Math.max(start, end)) } };
    }
    if (typeof value !== 'number' || typeof valueTo !== 'number') return null;
    return { [path]: { gte: Math.min(value, valueTo), lte: Math.max(value, valueTo) } };
  }
  if (op === 'before') {
    const date = toDateMs(value);
    return date === null ? null : { [path]: { lt: new Date(date) } };
  }
  if (op === 'after') {
    const date = toDateMs(value);
    return date === null ? null : { [path]: { gt: new Date(date) } };
  }

  return null;
}

export function buildPrismaWhereFromFilters(filters: ListFilterGroup | undefined, configMap: FilterConfigMap): Record<string, unknown> {
  const rules = filters?.rules ?? [];
  const logic: ListFilterLogic = filters?.logic === 'OR' ? 'OR' : 'AND';
  const compiled = rules
    .map((rule) => {
      const config = configMap[rule.field];
      if (!config) return null;
      return compilePrismaRule(rule, rule.field, config);
    })
    .filter((value): value is Record<string, unknown> => Boolean(value));

  if (compiled.length === 0) return {};
  return { [logic]: compiled };
}

function valueFromRow(row: Record<string, unknown>, field: string, config: FilterFieldConfig): unknown {
  const path = config.path ?? field;
  return row[path];
}

function matchesRule(row: Record<string, unknown>, rule: ListFilterRule, field: string, config: FilterFieldConfig): boolean {
  const op = rule.op;
  const kind = config.kind;
  const raw = valueFromRow(row, field, config);
  const value = normalizeValue(rule.value, kind);
  const valueTo = normalizeValue(rule.valueTo, kind);

  if (op === 'is_true') return Boolean(raw) === true;
  if (op === 'is_false') return Boolean(raw) === false;

  const textRaw = String(raw ?? '');
  const textValue = String(value ?? '');
  if (op === 'contains') return textRaw.toLowerCase().includes(textValue.toLowerCase());
  if (op === 'starts_with') return textRaw.toLowerCase().startsWith(textValue.toLowerCase());
  if (op === 'ends_with') return textRaw.toLowerCase().endsWith(textValue.toLowerCase());
  if (op === 'equals') {
    if (kind === 'number' || kind === 'boolean') return raw === value;
    if (kind === 'date') {
      const a = toDateMs(raw);
      const b = toDateMs(value);
      return a !== null && b !== null && a === b;
    }
    return textRaw.toLowerCase() === textValue.toLowerCase();
  }
  if (op === 'in') {
    const values = String(rule.value ?? '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    return values.includes(textRaw.toLowerCase());
  }
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    if (kind === 'date') {
      const a = toDateMs(raw);
      const b = toDateMs(value);
      if (a === null || b === null) return false;
      if (op === 'gt') return a > b;
      if (op === 'gte') return a >= b;
      if (op === 'lt') return a < b;
      return a <= b;
    }
    if (typeof raw !== 'number' || typeof value !== 'number') return false;
    if (op === 'gt') return raw > value;
    if (op === 'gte') return raw >= value;
    if (op === 'lt') return raw < value;
    return raw <= value;
  }
  if (op === 'between') {
    if (kind === 'date') {
      const a = toDateMs(raw);
      const start = toDateMs(value);
      const end = toDateMs(valueTo);
      if (a === null || start === null || end === null) return false;
      return a >= Math.min(start, end) && a <= Math.max(start, end);
    }
    if (typeof raw !== 'number' || typeof value !== 'number' || typeof valueTo !== 'number') return false;
    return raw >= Math.min(value, valueTo) && raw <= Math.max(value, valueTo);
  }
  if (op === 'before') {
    const a = toDateMs(raw);
    const b = toDateMs(value);
    return a !== null && b !== null && a < b;
  }
  if (op === 'after') {
    const a = toDateMs(raw);
    const b = toDateMs(value);
    return a !== null && b !== null && a > b;
  }

  return true;
}

export function applyFiltersInMemory<T extends Record<string, unknown>>(
  rows: T[],
  filters: ListFilterGroup | undefined,
  configMap: FilterConfigMap,
): T[] {
  const rules = filters?.rules ?? [];
  if (rules.length === 0) return rows;
  const logic: ListFilterLogic = filters?.logic === 'OR' ? 'OR' : 'AND';

  return rows.filter((row) => {
    const runRule = (rule: ListFilterRule) => {
      const config = configMap[rule.field];
      if (!config) return true;
      return matchesRule(row, rule, rule.field, config);
    };
    return logic === 'OR' ? rules.some(runRule) : rules.every(runRule);
  });
}
