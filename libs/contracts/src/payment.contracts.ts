import { z } from 'zod';

export const PayHereWebhookSchema = z.object({
  merchant_id: z.string().min(1),
  order_id: z.string().min(1),
  payhere_amount: z.string().min(1),
  payhere_currency: z.string().min(1),
  status_code: z.string().min(1),
  md5sig: z.string().min(1),
  payment_id: z.string().optional(),
});

export type PayHereWebhookPayload = z.infer<typeof PayHereWebhookSchema>;
