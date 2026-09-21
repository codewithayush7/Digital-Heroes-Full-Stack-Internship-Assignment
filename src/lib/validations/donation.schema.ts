import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const donationCheckoutSchema = z.object({
  charityId: z.string().regex(UUID_REGEX, "Invalid charity ID format."),
  amount: z.coerce
    .number({ error: "Donation amount is required." })
    // Application minimum chosen to remain safely above Stripe's current $0.50 equivalent threshold for US accounts charging in INR
    .min(50, "Minimum donation amount is ₹50.00.")
    .max(50000, "Maximum single donation is ₹50,000.00."),
});

export type DonationCheckoutInput = z.infer<typeof donationCheckoutSchema>;
