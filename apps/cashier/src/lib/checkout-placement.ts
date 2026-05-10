/**
 * Queue row ids from the current POS checkout flow only. Used so background sync of *older*
 * offline rows does not clear the cart / supervisor state while a new order is being built.
 */
export const pendingPlacementQueueIds = new Set<string>();
