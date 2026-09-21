import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubscriptionService } from "@/lib/services/subscription.service";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET in server environment.");
    return NextResponse.json(
      { error: "Webhook secret is not configured on the server." },
      { status: 500 }
    );
  }

  // 1. Read raw request body as text
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  // 2. Cryptographic signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Signature verification failed";
    console.error(`Stripe webhook signature verification failed: ${errorMsg}`);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMsg}` },
      { status: 400 }
    );
  }

  // 3. Process the verified event using elevated admin client
  const adminSupabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = (session.metadata?.userId || session.client_reference_id) as string;
          const planType = (session.metadata?.planType as "monthly" | "yearly") || undefined;

          await SubscriptionService.syncSubscriptionFromStripe(
            adminSupabase,
            subscription,
            planType,
            userId
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await SubscriptionService.syncSubscriptionFromStripe(adminSupabase, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await SubscriptionService.handleInvoicePaymentSucceeded(adminSupabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await SubscriptionService.handleInvoicePaymentFailed(adminSupabase, invoice);
        break;
      }

      default:
        // Ignore unhandled event types cleanly
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    console.error(`Error processing webhook event ${event.type}:`, errorMsg);
    return NextResponse.json(
      { error: "Webhook handler failed during database synchronization." },
      { status: 500 }
    );
  }
}
