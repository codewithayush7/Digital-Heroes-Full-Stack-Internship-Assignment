import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";
import { ScoreService } from "@/lib/services/score.service";
import { CharityService } from "@/lib/services/charity.service";
import { SubscriptionService } from "@/lib/services/subscription.service";
import { DrawService } from "@/lib/services/draw.service";
import { ScoreForm } from "@/components/dashboard/ScoreForm";
import { ScoreList } from "@/components/dashboard/ScoreList";
import { CharitySelectionForm } from "@/components/dashboard/CharitySelectionForm";
import { SubscriptionCard } from "@/components/dashboard/SubscriptionCard";
import { DrawParticipationCard } from "@/components/dashboard/DrawParticipationCard";
import { DrawResultsCard } from "@/components/dashboard/DrawResultsCard";
import { WinningsHistoryCard } from "@/components/dashboard/WinningsHistoryCard";
import {
  LogOut,
  User,
  Shield,
  Heart,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; billing?: string }>;
}) {
  const { error, billing } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: profile },
    { data: scores = [] },
    { data: charities = [] },
    activeSub,
    latestDrawRes,
    userWinningsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    ScoreService.getUserScores(supabase, user.id),
    CharityService.getCharities(supabase),
    SubscriptionService.getActiveSubscription(supabase, user.id),
    DrawService.getLatestPublishedDraw(supabase),
    DrawService.getUserWinnings(supabase, user.id),
  ]);

  const latestDraw = latestDrawRes.data ?? null;
  const userEntryRes = latestDraw
    ? await DrawService.getUserDrawEntry(supabase, latestDraw.id, user.id)
    : { data: null };
  const userEntry = userEntryRes.data ?? null;

  const userWinnings = userWinningsRes.data ?? {
    winners: [],
    totalWon: 0,
    pendingAmount: 0,
    paidAmount: 0,
  };

  const selectedCharity = charities.find((c) => c.id === profile?.charity_id);
  const isSubscribed = Boolean(activeSub);
  const retainedScoreValues = scores.map((s) => s.score);

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation / Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
              Digital Heroes Dashboard
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Welcome, {profile?.full_name || user.email}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/charities"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-400 transition"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span>Charity Directory</span>
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-200 transition"
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-400 transition"
              >
                <Shield className="h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-300 transition"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </form>
          </div>
        </header>

        {/* Billing Feedback Banners */}
        {billing === "success" && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <h4 className="font-semibold text-emerald-200">Subscription Activated</h4>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                Thank you! Your membership is active, and you are now qualified for monthly prize draws and charitable allocations.
              </p>
            </div>
          </div>
        )}

        {billing === "cancelled" && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
            <Info className="h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <h4 className="font-semibold text-slate-200">Checkout Cancelled</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Your checkout session was cancelled. No charges were made.
              </p>
            </div>
          </div>
        )}

        {/* Unauthorized Notification Banner */}
        {error === "unauthorized" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h4 className="font-semibold text-amber-200">Access Restricted</h4>
              <p className="text-xs text-amber-300/90 mt-0.5">
                Your account has subscriber permissions. Administrator privileges are required to access the admin portal.
              </p>
            </div>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-xs font-medium text-slate-400">Subscriber Status</span>
            <div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isSubscribed
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : activeSub?.status === "past_due"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {isSubscribed
                  ? activeSub?.cancel_at_period_end
                    ? "Canceling at Period End"
                    : "Active Subscriber"
                  : activeSub?.status === "past_due"
                  ? "Past Due"
                  : "Inactive"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {profile?.role === "admin"
                ? "Admin Privileges Active"
                : isSubscribed
                ? "Qualified for Draws"
                : "Subscribe to Enter Draws"}
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-xs font-medium text-slate-400">Designated Charity</span>
            <div className="flex items-center gap-1.5 truncate">
              <Heart className="h-4 w-4 text-emerald-400 fill-current shrink-0" />
              <span className="text-xs font-bold text-white truncate">
                {selectedCharity ? selectedCharity.name : "None Selected"}
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 font-medium">
              {profile?.charity_contribution_pct ?? 10}% Contribution
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-xs font-medium text-slate-400">Scores Retained</span>
            <div className="text-lg font-bold text-amber-400">
              {scores.length} / 5
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {scores.length === 5 ? "Entry Complete" : `${5 - scores.length} more needed`}
            </p>
          </div>
        </div>

        {/* Next Monthly Draw Readiness (Phase D2) */}
        <DrawParticipationCard
          isSubscribed={isSubscribed}
          scoresCount={scores.length}
          retainedScores={retainedScoreValues}
        />

        {/* Official Draw Results (Phase D2) */}
        <DrawResultsCard
          latestDraw={latestDraw}
          userEntry={userEntry}
        />

        {/* Winnings & Payouts Overview (Phase D2) */}
        <WinningsHistoryCard
          winners={userWinnings.winners}
          totalWon={userWinnings.totalWon}
          pendingAmount={userWinnings.pendingAmount}
          paidAmount={userWinnings.paidAmount}
        />

        {/* Subscription & Billing Section */}
        <div id="subscription-card">
          <SubscriptionCard
            subscription={activeSub}
            isActiveSubscriber={isSubscribed}
          />
        </div>

        {/* Charity Preference Section (Milestone 1D) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-bold text-white">
                Charitable Impact Allocation
              </h2>
              <p className="text-xs text-slate-400">
                Choose which verified partner receives a portion of your subscription fee (minimum 10%).
              </p>
            </div>
            <Link
              href="/charities"
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <span>Explore Charities</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <CharitySelectionForm
            charities={charities}
            selectedCharityId={profile?.charity_id ?? null}
            currentPct={Number(profile?.charity_contribution_pct ?? 10)}
          />
        </div>

        {/* Score Management Section (Milestone 1C) */}
        <div id="score-form" className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">
              Golf Score Management (Stableford)
            </h2>
            <p className="text-xs text-slate-400">
              Record your scores between 1 and 45 points. Only your latest 5 scores (ordered by played date) are retained.
            </p>
          </div>

          {isSubscribed ? (
            <ScoreForm currentCount={scores.length} />
          ) : (
            <div className="glass-panel rounded-xl p-5 border border-amber-500/30 bg-amber-500/5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Active Subscription Required</span>
              </div>
              <p className="text-xs text-slate-300">
                An active subscription is required to record and manage golf scores. Subscribe to enter your scores and qualify for monthly prize draws.
              </p>
              <a
                href="#subscription-card"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition duration-150 shadow-md shadow-amber-500/20"
              >
                <span>View Subscription Plans</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
          <ScoreList scores={scores} canManage={isSubscribed} />
        </div>
      </div>
    </div>
  );
}
