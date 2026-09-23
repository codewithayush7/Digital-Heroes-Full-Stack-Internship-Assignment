import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoreService } from "@/lib/services/score.service";
import { SubscriptionService } from "@/lib/services/subscription.service";
import { isUserEmailConfirmed } from "@/lib/auth";
import { ScoreForm } from "@/components/dashboard/ScoreForm";
import { ScoreList } from "@/components/dashboard/ScoreList";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";

export default async function ScoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/scores");
  }

  if (!isUserEmailConfirmed(user)) {
    redirect("/login?error=email_not_confirmed");
  }

  const [isSubscribed, { data: scores = [] }] = await Promise.all([
    SubscriptionService.hasActiveSubscription(supabase, user.id),
    ScoreService.getUserScores(supabase, user.id),
  ]);

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">
            Stableford Golf Scores
          </h1>
          <p className="text-xs text-slate-400">
            Enter your recent Stableford scores (1–45). Only the 5 most recent scores by date are retained.
          </p>
        </div>

        {isSubscribed ? (
          <ScoreForm currentCount={scores.length} />
        ) : (
          <div className="glass-panel rounded-xl p-6 border border-amber-500/30 bg-amber-500/5 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Active Subscription Required</span>
            </div>
            <p className="text-xs text-slate-300">
              An active subscription is required to record and manage golf scores. Subscribe to enter your scores and qualify for monthly prize draws.
            </p>
            <div>
              <Link
                href="/dashboard#subscription-card"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition duration-150 shadow-md shadow-amber-500/20"
              >
                <span>Subscribe on Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        <ScoreList scores={scores} canManage={isSubscribed} />
      </div>
    </div>
  );
}
