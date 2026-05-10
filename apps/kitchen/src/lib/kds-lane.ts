import type { QueueOrder } from '@wrap-roll/contracts';

export type KdsLaneFilter = 'all' | 'takeaway' | 'dine_in' | 'delivery';

export function fulfillmentTypeLabel(
  ft: QueueOrder['fulfillmentType'] | string | null | undefined,
): string {
  const k = String(ft ?? '').toLowerCase();
  if (k === 'delivery') return 'Delivery';
  if (k === 'dine_in') return 'Dine-in';
  if (k === 'takeaway') return 'Pickup';
  return 'Order';
}

export function orderMatchesLane(
  ft: QueueOrder['fulfillmentType'] | string | null | undefined,
  lane: KdsLaneFilter,
): boolean {
  if (lane === 'all') return true;
  const k = String(ft ?? '').toLowerCase();
  return k === lane;
}
