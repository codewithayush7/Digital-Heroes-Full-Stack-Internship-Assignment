import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type Stripe from "stripe";
import { stripe, getStripePriceId, getPlanTypeFromPriceId, type PlanType } from "@/lib/stripe";

export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type SubscriptionStatus = Database["public"]["Tables"]["subscriptions"]["Row"]["status"];

export interface StripeSubscriptionPayload {
  id: string;
  customer?: string | { id: string } | null;
  status: Stripe.Subscription.Status;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  currency?: string;
  metadata?: Stripe.Metadata;
  items?: {
    data: Array<{
      id?: string;
      price?: {
        id?: string;
        unit_amount?: number | null;
      };
      current_period_start?: number;
      current_period_end?: number;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface StripeInvoicePayload {
  id: string;
  subscription?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
  amount_paid?: number;
  currency?: string;
  billing_reason?: string | null;
  subscription_details?: {
    metadata?: Record<string, string>;
  };
  [key: string]: unknown;
}

export class SubscriptionService {
  /**
   * Evaluates whether a user has an active or trialing subscription where current_period_end is still in the future.
   * Preserves subscriptions with cancel_at_period_end = true as active until the paid period ends.
   * Returns null if status is past_due, unpaid, canceled, lapsed, or if expired.
   */
  static async getActiveSubscription(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<SubscriptionRow | null> {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .gt("current_period_end", nowIso)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error retrieving active subscription:", error);
      return null;
    }

    return data;
  }

  /**
   * Fast boolean check for qualifying subscriber status.
   * Real-time check used for draw eligibility and subscriber-only features.
   */
  static async hasActiveSubscription(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<boolean> {
    const activeSub = await this.getActiveSubscription(supabase, userId);
    return Boolean(activeSub);
  }

  /**
   * Retrieves all subscription records for an authenticated user (subscription history).
   */
  static async getUserSubscriptions(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<SubscriptionRow[]> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user subscriptions:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Creates a Stripe Checkout Session for an authenticated user.
   * Uses supabase.auth.getUser() on the server to prevent client-supplied user ID forgery.
   * Reuses an existing Stripe Customer ID if the user previously had one.
   */
  static async createCheckoutSession(
    supabase: SupabaseClient<Database>,
    planType: PlanType,
    originUrl: string
  ): Promise<{ url: string | null; error?: string }> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { url: null, error: "Authentication required to initiate subscription checkout." };
    }

    try {
      const priceId = getStripePriceId(planType);

      // Check if user already has an existing Stripe customer ID in history
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const existingCustomerId = existingSub?.stripe_customer_id;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          planType,
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            planType,
          },
        },
        success_url: `${originUrl}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${originUrl}/dashboard?billing=cancelled`,
      };

      if (existingCustomerId) {
        sessionParams.customer = existingCustomerId;
      } else {
        sessionParams.customer_email = user.email;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return { url: session.url };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create checkout session.";
      console.error("Failed to create Stripe Checkout session:", err);
      return { url: null, error: message };
    }
  }

  /**
   * Creates a Stripe Customer Portal Session for billing and cancellation management.
   */
  static async createCustomerPortalSession(
    supabase: SupabaseClient<Database>,
    originUrl: string
  ): Promise<{ url: string | null; error?: string }> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { url: null, error: "Authentication required." };
    }

    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.stripe_customer_id) {
        return {
          url: null,
          error: "No active Stripe customer account found. Please subscribe first.",
        };
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${originUrl}/dashboard`,
      });

      return { url: portalSession.url };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create customer portal session.";
      console.error("Failed to create Stripe portal session:", err);
      return { url: null, error: message };
    }
  }

  /**
   * Maps Stripe subscription status to database-allowed status enum:
   * ('active', 'trialing', 'canceled', 'past_due', 'unpaid', 'incomplete', 'lapsed')
   */
  static mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    switch (stripeStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "canceled":
        return "canceled";
      case "past_due":
        return "past_due";
      case "unpaid":
        return "unpaid";
      case "incomplete":
        return "incomplete";
      case "incomplete_expired":
      case "paused":
        return "lapsed";
      default:
        return "lapsed";
    }
  }

  /**
   * Synchronizes Stripe Subscription state to public.subscriptions using the privileged admin client.
   * Performs an idempotent upsert keyed on stripe_subscription_id.
   */
  static async syncSubscriptionFromStripe(
    adminSupabase: SupabaseClient<Database>,
    subscription: Stripe.Subscription,
    explicitPlanType?: PlanType,
    explicitUserId?: string
  ): Promise<{ success: boolean; subscription?: SubscriptionRow; error?: string }> {
    try {
      // 1. Resolve User ID from metadata, or fallback to existing subscription record
      let userId = explicitUserId || (subscription.metadata?.userId as string);

      if (!userId) {
        const { data: existing } = await adminSupabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (existing) {
          userId = existing.user_id;
        } else if (subscription.customer) {
          const { data: existingByCustomer } = await adminSupabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", subscription.customer as string)
            .maybeSingle();
          if (existingByCustomer) {
            userId = existingByCustomer.user_id;
          }
        }
      }

      if (!userId) {
        console.error("Unable to resolve userId for subscription:", subscription.id);
        return { success: false, error: "Missing user identification for subscription." };
      }

      // 2. Resolve Plan Type
      const priceId = subscription.items.data[0]?.price.id;
      const planType: PlanType =
        explicitPlanType ||
        (subscription.metadata?.planType as PlanType) ||
        getPlanTypeFromPriceId(priceId);

      // 3. Map Status and Dates
      const status = this.mapStripeStatus(subscription.status);
      const subPayload = subscription as unknown as StripeSubscriptionPayload;
      const startEpoch =
        subPayload.current_period_start ??
        subPayload.items?.data?.[0]?.current_period_start;
      const endEpoch =
        subPayload.current_period_end ??
        subPayload.items?.data?.[0]?.current_period_end;

      const currentPeriodStart = startEpoch
        ? new Date(startEpoch * 1000).toISOString()
        : new Date().toISOString();
      const currentPeriodEnd = endEpoch
        ? new Date(endEpoch * 1000).toISOString()
        : new Date().toISOString();

      const amount = (subscription.items.data[0]?.price.unit_amount || 0) / 100;
      const currency = subscription.currency ? subscription.currency.toLowerCase() : "usd";
      const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

      // 4. Idempotent Upsert into public.subscriptions
      const { data, error } = await adminSupabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
            stripe_subscription_id: subscription.id,
            plan_type: planType,
            status,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            amount,
            currency,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "stripe_subscription_id",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Error upserting subscription:", error);
        return { success: false, error: error.message };
      }

      return { success: true, subscription: data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected synchronization error.";
      console.error("Exception in syncSubscriptionFromStripe:", err);
      return { success: false, error: message };
    }
  }

  /**
   * Authoritative billing event handler for successful invoice payment.
   * Synchronizes subscription period dates, status, and creates the charity donation allocation.
   * Includes application-level duplicate protection using stripe_payment_id.
   */
  static async handleInvoicePaymentSucceeded(
    adminSupabase: SupabaseClient<Database>,
    invoice: Stripe.Invoice
  ): Promise<{ success: boolean; donationCreated: boolean; error?: string }> {
    try {
      const invPayload = invoice as unknown as StripeInvoicePayload;
      const subscriptionId =
        typeof invPayload.subscription === "string"
          ? invPayload.subscription
          : invPayload.subscription?.id;

      if (!subscriptionId) {
        // Not a subscription invoice (e.g. one-off payment)
        return { success: true, donationCreated: false };
      }

      // 1. Resolve subscription row to identify user and update status
      const { data: subRow } = await adminSupabase
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      const userId =
        subRow?.user_id ||
        (invPayload.subscription_details?.metadata?.userId as string);

      if (!userId) {
        console.warn("Could not find user associated with subscription invoice:", invoice.id);
        return { success: false, donationCreated: false, error: "User association not found." };
      }

      // 2. Ensure subscription is marked active in the database
      if (subRow && subRow.status !== "active") {
        await adminSupabase
          .from("subscriptions")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", subRow.id);
      }

      // 3. Application-Level Duplicate Protection for Donation Allocation
      // Unique identifier for the payment: payment_intent ID or invoice ID
      const stripePaymentId =
        (typeof invPayload.payment_intent === "string"
          ? invPayload.payment_intent
          : invPayload.payment_intent?.id) || invPayload.id;

      const { data: existingDonation } = await adminSupabase
        .from("donations")
        .select("id")
        .eq("stripe_payment_id", stripePaymentId)
        .maybeSingle();

      if (existingDonation) {
        // Already recorded; prevent double-crediting
        return { success: true, donationCreated: false };
      }

      // 4. Calculate Charity Allocation
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("charity_id, charity_contribution_pct")
        .eq("id", userId)
        .single();

      if (!profile?.charity_id) {
        // User has not designated a charity yet
        return { success: true, donationCreated: false };
      }

      const amountPaid = (invoice.amount_paid || 0) / 100;
      const contributionPct = Number(profile.charity_contribution_pct ?? 10);
      const donationAmount = Math.round(amountPaid * (contributionPct / 100) * 100) / 100;

      if (donationAmount <= 0) {
        return { success: true, donationCreated: false };
      }

      const currency = invoice.currency ? invoice.currency.toLowerCase() : "usd";

      // 5. Insert Donation Record
      const { error: donationError } = await adminSupabase.from("donations").insert({
        user_id: userId,
        charity_id: profile.charity_id,
        amount: donationAmount,
        currency,
        donation_type: "subscription_allocation",
        stripe_payment_id: stripePaymentId,
        status: "completed",
      });

      if (donationError) {
        console.error("Failed to insert charity donation allocation:", donationError);
        return { success: false, donationCreated: false, error: donationError.message };
      }

      // 6. Update Charity Total Funds Raised
      const { data: charity } = await adminSupabase
        .from("charities")
        .select("total_funds_raised")
        .eq("id", profile.charity_id)
        .single();

      if (charity) {
        const currentRaised = Number(charity.total_funds_raised || 0);
        const newRaised = Math.round((currentRaised + donationAmount) * 100) / 100;

        await adminSupabase
          .from("charities")
          .update({
            total_funds_raised: newRaised,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.charity_id);
      }

      return { success: true, donationCreated: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected invoice processing error.";
      console.error("Exception in handleInvoicePaymentSucceeded:", err);
      return { success: false, donationCreated: false, error: message };
    }
  }

  /**
   * Handles invoice payment failure by marking subscription as past_due.
   */
  static async handleInvoicePaymentFailed(
    adminSupabase: SupabaseClient<Database>,
    invoice: Stripe.Invoice
  ): Promise<void> {
    const invPayload = invoice as unknown as StripeInvoicePayload;
    const subscriptionId =
      typeof invPayload.subscription === "string"
        ? invPayload.subscription
        : invPayload.subscription?.id;

    if (subscriptionId) {
      await adminSupabase
        .from("subscriptions")
        .update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId);
    }
  }
}
