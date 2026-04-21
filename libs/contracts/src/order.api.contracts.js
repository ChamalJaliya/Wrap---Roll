"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPS_ACTIVITY_ACTOR_ROLE_FILTERS = exports.OPS_ACTIVITY_APP_FILTERS = exports.PAYMENT_FLOW_BOARD_STATUSES = exports.ORDER_FLOW_BOARD_STATUSES = void 0;
exports.formatPaymentCollectionLabel = formatPaymentCollectionLabel;
const staff_contracts_1 = require("./staff.contracts");
exports.ORDER_FLOW_BOARD_STATUSES = [
    'placed',
    'paid',
    'in_kitchen',
    'ready',
    'in_transit',
    'delivered',
    'cancelled',
    'voided',
    'refunded',
];
exports.PAYMENT_FLOW_BOARD_STATUSES = [
    'pending',
    'completed',
    'failed',
    'refunded',
];
/** Surfaces for `OpsActivityEventRow.app` (where the action happened — not the same as actor role). */
exports.OPS_ACTIVITY_APP_FILTERS = [
    'client',
    'cashier',
    'kitchen',
    'delivery',
    'admin',
    'system',
];
/** Stored `actorRole` values for activity filters (staff roles + shopper). */
exports.OPS_ACTIVITY_ACTOR_ROLE_FILTERS = [
    'ADMIN',
    'CASHIER',
    'KITCHEN',
    'COURIER',
    staff_contracts_1.SHOPPER_ROLE,
    'SYSTEM',
];
function formatPaymentCollectionLabel(paymentCollection) {
    if (!paymentCollection)
        return 'Immediate';
    switch (paymentCollection) {
        case 'on_delivery':
            return 'Pay on delivery';
        case 'on_pickup':
            return 'Pay on pickup';
        case 'immediate':
            return 'Immediate';
        default:
            return String(paymentCollection).replace(/_/g, ' ');
    }
}
//# sourceMappingURL=order.api.contracts.js.map