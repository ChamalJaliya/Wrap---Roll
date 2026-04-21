import { z } from 'zod';
export declare const PayHereWebhookSchema: z.ZodObject<{
    merchant_id: z.ZodString;
    order_id: z.ZodString;
    payhere_amount: z.ZodString;
    payhere_currency: z.ZodString;
    status_code: z.ZodString;
    md5sig: z.ZodString;
    payment_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PayHereWebhookPayload = z.infer<typeof PayHereWebhookSchema>;
//# sourceMappingURL=payment.contracts.d.ts.map