"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerHistoryOrderSchema = exports.CustomerSchema = exports.SavedPaymentTokenSchema = exports.CustomerAddressSchema = void 0;
// libs/contracts/src/customer.schema.ts
const zod_1 = require("zod");
exports.CustomerAddressSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    label: zod_1.z.string().min(1, 'Label is required (e.g. Home, Work)'),
    addressLine1: zod_1.z.string().min(1, 'Address Line 1 is required'),
    addressLine2: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().min(1, 'City is required'),
    postalCode: zod_1.z.string().optional().nullable(),
    latitude: zod_1.z.number().min(-90).max(90).optional().nullable(),
    longitude: zod_1.z.number().min(-180).max(180).optional().nullable(),
    geocodeSource: zod_1.z.string().optional().nullable(),
    geocodeAccuracy: zod_1.z.string().optional().nullable(),
    isDefault: zod_1.z.boolean().default(false),
});
exports.SavedPaymentTokenSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    token: zod_1.z.string(),
    cardBrand: zod_1.z.string(),
    last4: zod_1.z.string().length(4),
    isDefault: zod_1.z.boolean().default(false),
});
exports.CustomerSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    email: zod_1.z.string().email().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    addresses: zod_1.z.array(exports.CustomerAddressSchema),
    savedPayments: zod_1.z.array(exports.SavedPaymentTokenSchema),
});
exports.CustomerHistoryOrderSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    placedAt: zod_1.z.string(),
    fulfillmentType: zod_1.z.string(),
    status: zod_1.z.string(),
    total: zod_1.z.number().or(zod_1.z.string()),
});
//# sourceMappingURL=customer.schema.js.map