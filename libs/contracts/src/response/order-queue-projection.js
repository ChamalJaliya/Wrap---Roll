"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KITCHEN_QUEUE_FORBIDDEN_KEYS = void 0;
exports.projectQueueOrderForPersona = projectQueueOrderForPersona;
function projectKitchen(order) {
    var _a;
    return {
        id: order.id,
        status: order.status,
        source: order.source,
        fulfillmentType: order.fulfillmentType,
        tableNumber: order.tableNumber,
        itemCount: order.itemCount,
        items: (_a = order.items) === null || _a === void 0 ? void 0 : _a.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            modifiersJson: i.modifiersJson,
            menuItemId: i.menuItemId,
        })),
        estimatedReadyTime: order.estimatedReadyTime,
        customer: order.customer ? { name: order.customer.name } : null,
        placedAt: order.placedAt,
        updatedAt: order.updatedAt,
        kitchenPriority: order.kitchenPriority,
        printedAt: order.printedAt,
        readyAt: order.readyAt,
        kitchenEligible: order.kitchenEligible,
        releaseReason: order.releaseReason,
        kitchenReleaseAt: order.kitchenReleaseAt,
        priorityDeadlineAt: order.priorityDeadlineAt,
        slaBucket: order.slaBucket,
        allowedNextStatuses: order.allowedNextStatuses,
        actions: order.actions,
        blockedReasonsByStatus: order.blockedReasonsByStatus,
    };
}
function projectCourier(order) {
    var _a;
    return {
        id: order.id,
        status: order.status,
        source: order.source,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentCollection: order.paymentCollection,
        fulfillmentType: order.fulfillmentType,
        customer: order.customer,
        subtotal: order.subtotal,
        tax: order.tax,
        deliveryFee: order.deliveryFee,
        total: order.total,
        itemCount: order.itemCount,
        items: (_a = order.items) === null || _a === void 0 ? void 0 : _a.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            modifiersJson: i.modifiersJson,
        })),
        deliveryAddress: order.deliveryAddress,
        deliveryLatitude: order.deliveryLatitude,
        deliveryLongitude: order.deliveryLongitude,
        deliveryDistanceKm: order.deliveryDistanceKm,
        deliveryGeoSource: order.deliveryGeoSource,
        estimatedReadyTime: order.estimatedReadyTime,
        courierId: order.courierId,
        placedAt: order.placedAt,
        updatedAt: order.updatedAt,
        kitchenPriority: order.kitchenPriority,
        paymentRisk: order.paymentRisk,
        allowedNextStatuses: order.allowedNextStatuses,
        actions: order.actions,
        blockedReasonsByStatus: order.blockedReasonsByStatus,
    };
}
/**
 * Returns a role-appropriate queue order JSON. Input is the internal `QueueOrder` (ops superset).
 */
function projectQueueOrderForPersona(persona, order) {
    if (persona === 'kitchen')
        return projectKitchen(order);
    if (persona === 'courier')
        return projectCourier(order);
    return order;
}
/** Keys that must not appear in serialized kitchen queue payloads (for tests / audits). */
exports.KITCHEN_QUEUE_FORBIDDEN_KEYS = [
    'total',
    'subtotal',
    'tax',
    'deliveryFee',
    'discountCode',
    'discountAmount',
    'transactionId',
    'paymentCollection',
    'paymentMethod',
    'paymentStatus',
    'paymentRisk',
    'staffScheduleOverride',
    'deliveryLatitude',
    'deliveryLongitude',
    'deliveryDistanceKm',
    'deliveryGeoSource',
    'courierId',
];
//# sourceMappingURL=order-queue-projection.js.map