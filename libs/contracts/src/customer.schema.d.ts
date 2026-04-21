import { z } from 'zod';
export declare const CustomerAddressSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    addressLine1: z.ZodString;
    addressLine2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    city: z.ZodString;
    postalCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    latitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    longitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    geocodeSource: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    geocodeAccuracy: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const SavedPaymentTokenSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    token: z.ZodString;
    cardBrand: z.ZodString;
    last4: z.ZodString;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const CustomerSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    addresses: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        label: z.ZodString;
        addressLine1: z.ZodString;
        addressLine2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        city: z.ZodString;
        postalCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        latitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        longitude: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        geocodeSource: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        geocodeAccuracy: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        isDefault: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    savedPayments: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        token: z.ZodString;
        cardBrand: z.ZodString;
        last4: z.ZodString;
        isDefault: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const CustomerHistoryOrderSchema: z.ZodObject<{
    id: z.ZodString;
    placedAt: z.ZodString;
    fulfillmentType: z.ZodString;
    status: z.ZodString;
    total: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
}, z.core.$strip>;
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;
export type SavedPaymentToken = z.infer<typeof SavedPaymentTokenSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type CustomerHistoryOrder = z.infer<typeof CustomerHistoryOrderSchema>;
//# sourceMappingURL=customer.schema.d.ts.map