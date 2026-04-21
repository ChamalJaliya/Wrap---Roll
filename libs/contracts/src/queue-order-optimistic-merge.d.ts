import type { QueueOrder } from './order.api.contracts';
/**
 * Merges server order fields from a PATCH response onto an existing queue row.
 * Preserves projection-only fields (`allowedNextStatuses`, `actions`, SLA, etc.) until the next full `GET /orders/queue` refresh.
 */
export declare function mergeQueueOrderFromApiPatch(existing: QueueOrder, apiBody: unknown): QueueOrder;
//# sourceMappingURL=queue-order-optimistic-merge.d.ts.map