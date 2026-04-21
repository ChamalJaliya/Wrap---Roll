"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayHereWebhookSchema = void 0;
const zod_1 = require("zod");
exports.PayHereWebhookSchema = zod_1.z.object({
    merchant_id: zod_1.z.string().min(1),
    order_id: zod_1.z.string().min(1),
    payhere_amount: zod_1.z.string().min(1),
    payhere_currency: zod_1.z.string().min(1),
    status_code: zod_1.z.string().min(1),
    md5sig: zod_1.z.string().min(1),
    payment_id: zod_1.z.string().optional(),
});
//# sourceMappingURL=payment.contracts.js.map