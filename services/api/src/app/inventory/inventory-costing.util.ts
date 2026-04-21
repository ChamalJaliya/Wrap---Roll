export function computeMovingAverageAfterPurchase(
  currentQty: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number,
) {
  const nextQty = currentQty + incomingQty;
  if (nextQty <= 0) {
    return { nextQty: 0, nextAvgCost: 0 };
  }
  const currentValue = currentQty * currentAvgCost;
  const incomingValue = incomingQty * incomingUnitCost;
  return {
    nextQty,
    nextAvgCost: (currentValue + incomingValue) / nextQty,
  };
}

export function computePeriodOverlapRatio(
  rangeStart: Date,
  rangeEnd: Date,
  periodStart: Date,
  periodEnd: Date,
) {
  const overlapStart = Math.max(rangeStart.getTime(), periodStart.getTime());
  const overlapEnd = Math.min(rangeEnd.getTime(), periodEnd.getTime());
  if (overlapEnd <= overlapStart) return 0;
  const overlapMs = overlapEnd - overlapStart;
  const periodMs = Math.max(1, periodEnd.getTime() - periodStart.getTime());
  return overlapMs / periodMs;
}
