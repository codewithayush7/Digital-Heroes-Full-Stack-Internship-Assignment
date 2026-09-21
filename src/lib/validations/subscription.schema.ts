import { z } from "zod";

export const checkoutSessionSchema = z.object({
  planType: z.enum(["monthly", "yearly"], {
    message: "Plan type must be either 'monthly' or 'yearly'",
  }),
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
