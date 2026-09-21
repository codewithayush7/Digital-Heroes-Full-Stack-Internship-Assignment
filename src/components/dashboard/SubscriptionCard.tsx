"use client";

import { useState, useTransition } from "react";
import type { SubscriptionRow } from "@/lib/services/subscription.service";
import {
  createCheckoutSessionAction,
  createCustomerPortalAction,
} from "@/app/actions/subscription";
import type { PlanType } from "@/lib/stripe";
import {
  CreditCard,
  Sparkles,
  Calendar,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Check,
} from "lucide-react";

interface SubscriptionCardProps {
  subscription: SubscriptionRow | null;
  isActiveSubscriber: boolean;
}

export function SubscriptionCard({
  subscription,
  isActiveSubscriber,
}: SubscriptionCardProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("monthly");
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSubscribe = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await createCheckoutSessionAction(selectedPlan);
      if (res?.error) {
        setActionError(res.error);
      }
    });
  };

  const handleManageBilling = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await createCustomerPortalAction();
      if (res?.error) {
        setActionError(res.error);
      }
    });
  };

  const formattedPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Membership & Billing
              {isActiveSubscriber && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3" />
                  Draw Qualified
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Monthly and annual entry into charity draws with automated donation allocation.
            </p>
          </div>
        </div>

        <div>
          {isActiveSubscriber ? (
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                subscription?.cancel_at_period_end
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {subscription?.cancel_at_period_end ? "Canceling at Period End" : "Active Subscriber"}
            </span>
          ) : subscription?.status === "past_due" ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              Payment Past Due
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              No Active Subscription
            </span>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Active Subscriber View */}
      {isActiveSubscriber && subscription && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400">Current Plan</span>
              <div className="text-sm font-bold text-white capitalize flex items-center gap-1.5">
                <span>{subscription.plan_type} Plan</span>
                {subscription.plan_type === "yearly" && (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                    Discounted
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400">
                {subscription.cancel_at_period_end ? "Access Through" : "Next Renewal Date"}
              </span>
              <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{formattedPeriodEnd || "Ongoing"}</span>
              </div>
            </div>
          </div>

          {subscription.cancel_at_period_end && (
            <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
              Your subscription is scheduled to end on <strong>{formattedPeriodEnd}</strong>. You remain qualified for any draws occurring prior to this date.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              ) : (
                <ExternalLink className="h-4 w-4 text-slate-400" />
              )}
              <span>Manage Billing & Cancellation (Stripe)</span>
            </button>
          </div>
        </div>
      )}

      {/* Inactive / Non-Subscriber View */}
      {!isActiveSubscriber && (
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Subscribe now to qualify for monthly prize draws and directly empower your designated charity with a percentage of every subscription.
          </p>

          {/* Plan Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                selectedPlan === "monthly"
                  ? "border-amber-500/50 bg-amber-500/10 text-white"
                  : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Monthly</span>
                {selectedPlan === "monthly" && <Check className="h-4 w-4 text-amber-400" />}
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold text-white">Monthly Plan</div>
                <div className="text-xs text-slate-400 mt-0.5">Flexible monthly billing & draw entry</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              className={`p-4 rounded-xl border text-left transition flex flex-col justify-between relative overflow-hidden ${
                selectedPlan === "yearly"
                  ? "border-amber-500/50 bg-amber-500/10 text-white"
                  : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Annual</span>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                    Save with Discount
                  </span>
                </div>
                {selectedPlan === "yearly" && <Check className="h-4 w-4 text-amber-400" />}
              </div>
              <div className="mt-2">
                <div className="text-lg font-bold text-white">Annual Membership</div>
                <div className="text-xs text-slate-400 mt-0.5">Discounted yearly rate & year-long entry</div>
              </div>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>PCI-compliant secure checkout powered by Stripe Test Mode</span>
            </div>

            <button
              type="button"
              onClick={handleSubscribe}
              disabled={isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>Subscribe Now ({selectedPlan === "monthly" ? "Monthly" : "Yearly"})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
