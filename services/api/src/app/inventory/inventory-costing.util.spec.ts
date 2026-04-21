import { computeMovingAverageAfterPurchase, computePeriodOverlapRatio } from './inventory-costing.util';

describe('inventory-costing.util', () => {
  it('computes moving weighted average across purchases', () => {
    const first = computeMovingAverageAfterPurchase(0, 0, 200, 45);
    expect(first.nextQty).toBe(200);
    expect(first.nextAvgCost).toBe(45);

    const second = computeMovingAverageAfterPurchase(first.nextQty, first.nextAvgCost, 500, 50);
    expect(second.nextQty).toBe(700);
    expect(second.nextAvgCost).toBeCloseTo(48.57, 2);
  });

  it('returns zero overlap for non-overlapping periods', () => {
    const ratio = computePeriodOverlapRatio(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.999Z'),
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-02-28T23:59:59.999Z'),
    );
    expect(ratio).toBe(0);
  });

  it('computes partial overlap ratio', () => {
    const ratio = computePeriodOverlapRatio(
      new Date('2026-01-10T00:00:00.000Z'),
      new Date('2026-01-20T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T00:00:00.000Z'),
    );
    expect(ratio).toBeCloseTo(10 / 30, 3);
  });
});
