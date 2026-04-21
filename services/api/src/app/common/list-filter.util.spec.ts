import { applyFiltersInMemory, buildPrismaWhereFromFilters } from './list-filter.util';

describe('list-filter.util', () => {
  it('builds prisma where for AND number/date/string rules', () => {
    const where = buildPrismaWhereFromFilters(
      {
        logic: 'AND',
        rules: [
          { field: 'name', op: 'contains', value: 'wrap' },
          { field: 'basePrice', op: 'between', value: 500, valueTo: 1000 },
          { field: 'createdAt', op: 'after', value: '2026-01-01T00:00:00.000Z' },
        ],
      },
      {
        name: { kind: 'string', caseInsensitive: true },
        basePrice: { kind: 'number' },
        createdAt: { kind: 'date' },
      },
    );

    expect(where).toHaveProperty('AND');
    const andClauses = (where as { AND: unknown[] }).AND;
    expect(andClauses).toHaveLength(3);
  });

  it('ignores unknown fields and invalid values', () => {
    const where = buildPrismaWhereFromFilters(
      {
        logic: 'OR',
        rules: [
          { field: 'unknown', op: 'contains', value: 'abc' },
          { field: 'price', op: 'gt', value: 'not-a-number' as unknown as number },
        ],
      },
      {
        price: { kind: 'number' },
      },
    );
    expect(where).toEqual({});
  });

  it('filters in-memory rows with OR logic', () => {
    const rows = [
      { role: 'ADMIN', fullName: 'Primary Admin', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
      { role: 'KITCHEN', fullName: 'Kitchen Chef One', isActive: true, createdAt: '2026-02-01T00:00:00.000Z' },
      { role: 'COURIER', fullName: 'Courier One', isActive: false, createdAt: '2026-03-01T00:00:00.000Z' },
    ];

    const next = applyFiltersInMemory(
      rows,
      {
        logic: 'OR',
        rules: [
          { field: 'role', op: 'equals', value: 'ADMIN' },
          { field: 'fullName', op: 'contains', value: 'kitchen' },
        ],
      },
      {
        role: { kind: 'enum' },
        fullName: { kind: 'string' },
        isActive: { kind: 'boolean' },
        createdAt: { kind: 'date' },
      },
    );

    expect(next).toHaveLength(2);
    expect(next.map((r) => r.role)).toEqual(['ADMIN', 'KITCHEN']);
  });
});
