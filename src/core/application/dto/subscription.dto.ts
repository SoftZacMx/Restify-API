import { z } from 'zod';

export const createSubscriptionCheckoutSchema = z.object({
  email: z.string().email(),
  businessName: z.string().min(1).max(200),
});

export type CreateSubscriptionCheckoutInput = z.infer<typeof createSubscriptionCheckoutSchema>;
