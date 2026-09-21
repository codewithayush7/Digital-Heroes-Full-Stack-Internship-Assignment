import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { donationCheckoutSchema } from "../validations/donation.schema";

export interface CreateDonationCheckoutParams {
  charityId: string;
  amount: number;
  currency?: string;
  userId?: string | null;
  originUrl: string;
}

export interface DonationServiceResult<T> {
  data?: T;
  error?: string;
}

export class DonationService {
  /**
   * Initiates a one-time Stripe Checkout Session for an independent charity donation.
   * Mode: "payment" (completely separate from recurring subscription logic and gameplay).
   */
  static async createDonationCheckoutSession(
    supabase: SupabaseClient<Database>,
    params: CreateDonationCheckoutParams
  ): Promise<{ url: string | null; error?: string }> {
    const parseResult = donationCheckoutSchema.safeParse({
      charityId: params.charityId,
      amount: params.amount,
    });

    if (!parseResult.success) {
      return {
        url: null,
        error: parseResult.error.issues[0]?.message || "Invalid donation input.",
      };
    }

    const { charityId, amount } = parseResult.data;

    // Verify charity existence
    const { data: charity, error: charityErr } = await supabase
      .from("charities")
      .select("id, name, slug")
      .eq("id", charityId)
      .maybeSingle();

    if (charityErr || !charity) {
      return { url: null, error: "The selected charity could not be found." };
    }

    const currency = (params.currency || "usd").toLowerCase();
    const unitAmountCents = Math.round(amount * 100);

    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `Direct Donation to ${charity.name}`,
                description:
                  "Independent charitable gift via Digital Heroes (standalone donation, not tied to gameplay).",
              },
              unit_amount: unitAmountCents,
            },
            quantity: 1,
          },
        ],
        client_reference_id: params.userId || undefined,
        metadata: {
          paymentType: "independent_donation",
          charityId: charity.id,
          charityName: charity.name,
          userId: params.userId || "",
        },
        success_url: `${params.originUrl}/charities/${charity.slug}?donation=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${params.originUrl}/charities/${charity.slug}?donation=cancelled`,
      };

      const session = await stripe.checkout.sessions.create(sessionParams);
      return { url: session.url };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initiate donation checkout.";
      console.error("Failed to create Stripe Donation Checkout session:", err);
      return { url: null, error: message };
    }
  }

  /**
   * Authoritative webhook reconciliation for independent donations.
   * Runs under elevated admin client upon verified checkout.session.completed event.
   * Delegates the financial mutation exclusively to the atomic PostgreSQL RPC
   * `record_independent_donation_atomic` to guarantee transaction-level atomicity
   * and concurrency-safe idempotency via advisory locking and unique constraints.
   */
  static async recordIndependentDonation(
    adminSupabase: SupabaseClient<Database>,
    session: Stripe.Checkout.Session
  ): Promise<{ success: boolean; donationCreated: boolean; error?: string }> {
    // 1. Validate metadata
    if (
      session.mode !== "payment" ||
      session.metadata?.paymentType !== "independent_donation" ||
      !session.metadata?.charityId
    ) {
      return {
        success: false,
        donationCreated: false,
        error: "Session is not a valid independent donation.",
      };
    }

    const charityId = session.metadata.charityId;
    const rawUserId = session.metadata.userId || session.client_reference_id;
    const userId = rawUserId && rawUserId.trim() !== "" ? rawUserId.trim() : null;

    // 2. Determine authoritative Stripe payment identifier
    const stripePaymentId =
      (typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id) || session.id;

    if (!stripePaymentId || stripePaymentId.trim() === "") {
      return {
        success: false,
        donationCreated: false,
        error: "Missing payment intent or session identifier.",
      };
    }

    const amountPaid = (session.amount_total || 0) / 100;
    if (amountPaid <= 0) {
      return {
        success: false,
        donationCreated: false,
        error: "Invalid payment amount.",
      };
    }

    const currency = session.currency ? session.currency.toLowerCase() : "usd";

    // 3. Delegate exclusively to atomic PostgreSQL RPC
    const { data, error: rpcError } = await adminSupabase.rpc(
      "record_independent_donation_atomic",
      {
        p_charity_id: charityId,
        p_amount: amountPaid,
        p_currency: currency,
        p_stripe_payment_id: stripePaymentId,
        p_user_id: userId,
      }
    );

    if (rpcError) {
      console.error("Failed to execute record_independent_donation_atomic RPC:", rpcError);
      return {
        success: false,
        donationCreated: false,
        error: rpcError.message,
      };
    }

    const result = data as {
      success?: boolean;
      donation_created?: boolean;
      already_processed?: boolean;
      donation_id?: string;
      error?: string;
    } | null;

    if (!result || !result.success) {
      return {
        success: false,
        donationCreated: false,
        error: result?.error || "Failed to record independent donation atomically.",
      };
    }

    return {
      success: true,
      donationCreated: result.donation_created ?? !result.already_processed,
    };
  }
}
