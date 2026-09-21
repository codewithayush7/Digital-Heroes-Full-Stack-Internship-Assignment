import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CharityService } from "@/lib/services/charity.service";
import { DrawService } from "@/lib/services/draw.service";
import { CharityCard } from "@/components/charity/CharityCard";
import { PricingCards } from "@/components/public/PricingCards";
import { PublicShell } from "@/components/public/PublicShell";
import { formatCurrency } from "@/lib/utils";
import {
  SCORE_MIN,
  SCORE_MAX,
  MAX_RETAINED_SCORES,
  PRIZE_TIER_SPLITS,
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "@/lib/config/constants";
import {
  Sparkles,
  Trophy,
  Heart,
  ArrowRight,
  TrendingUp,
  Target,
  Coins,
} from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch featured charities and latest authoritative published draw in parallel
  const [featuredRes, latestDrawRes] = await Promise.all([
    CharityService.getCharities(supabase, { featuredOnly: true }),
    DrawService.getLatestPublishedDraw(supabase),
  ]);

  const featuredCharities = featuredRes.data ?? [];
  const latestDraw = latestDrawRes.data ?? null;

  const rolloverAmount = Number(latestDraw?.rollover_jackpot_out ?? 0);
  const hasActiveRollover = rolloverAmount > 0;

  return (
    <PublicShell>
      {/* ========================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-800/60 bg-gradient-to-b from-[#090D16] via-[#0D1527] to-[#090D16]">
        {/* Background ambient lighting effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[250px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Badge: Rollover Jackpot or Platform Mission */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 fill-current text-amber-400" />
            <span>Turn Regular Golf Rounds Into Charitable Impact & Cash Prizes</span>
            {hasActiveRollover && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400 font-bold">
                  Current Rollover Jackpot: {formatCurrency(rolloverAmount)}
                </span>
              </>
            )}
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
            Play with Purpose. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400">
              Win with Impact.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-xl text-slate-300 leading-relaxed">
            Digital Heroes connects regular weekend golf performance with philanthropic giving. Your logged Stableford scores automatically enter you into monthly prize draws while directly funding vetted non-profit causes.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-7 py-3.5 text-sm transition shadow-xl shadow-amber-500/20"
            >
              <span>Join the Platform</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/charities"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-7 py-3.5 text-sm transition backdrop-blur-md"
            >
              <Heart className="h-4 w-4 fill-current" />
              <span>Explore Charities</span>
            </Link>
          </div>

          {/* Trust / Metric Highlights */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left border-t border-slate-800/80 max-w-4xl mx-auto">
            <div className="glass-panel p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Score Range
              </span>
              <div className="text-lg font-bold text-white">
                {SCORE_MIN} to {SCORE_MAX} Points
              </div>
              <p className="text-[11px] text-slate-400">Stableford scoring system</p>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Draw Frequency
              </span>
              <div className="text-lg font-bold text-amber-400">Monthly Draws</div>
              <p className="text-[11px] text-slate-400">5 numbers drawn each month</p>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Charity Allocation
              </span>
              <div className="text-lg font-bold text-emerald-400">
                {MIN_CHARITY_CONTRIBUTION_PCT}% to {MAX_CHARITY_CONTRIBUTION_PCT}%
              </div>
              <p className="text-[11px] text-slate-400">User configurable share</p>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Winning Tiers
              </span>
              <div className="text-lg font-bold text-white">3 Prize Tiers</div>
              <p className="text-[11px] text-slate-400">5, 4, and 3 match pools</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. HOW IT WORKS SECTION */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <Target className="h-3.5 w-3.5" />
            <span>The Player Journey</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How Digital Heroes Works
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            No complicated lotteries or rigid rules. Every swing on your home course directly drives your participation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 glow-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base">
                1
              </div>
              <h3 className="text-lg font-bold text-white">Play & Score</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Play your regular round of golf and log your Stableford score from 1 to 45. Enter dates, course names, and authentic scores.
              </p>
            </div>
            <div className="text-[11px] text-amber-400/90 font-medium pt-2 border-t border-slate-800/80">
              Valid range: 1–45 points
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 glow-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Build Your Numbers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your latest 5 retained golf scores automatically become your personal snapshot numbers for the monthly draw.
              </p>
            </div>
            <div className="text-[11px] text-amber-400/90 font-medium pt-2 border-t border-slate-800/80">
              Rolling 5-score retention
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 glow-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-base">
                3
              </div>
              <h3 className="text-lg font-bold text-white">Monthly Draw</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                At the end of every month, an algorithmic draw selects 5 winning numbers across the 1–45 spectrum.
              </p>
            </div>
            <div className="text-[11px] text-emerald-400/90 font-medium pt-2 border-t border-slate-800/80">
              Deterministic 5-number draw
            </div>
          </div>

          {/* Step 4 */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 glow-card flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-base">
                4
              </div>
              <h3 className="text-lg font-bold text-white">Give Back & Win</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Matching numbers unlock tiered cash prizes. Meanwhile, your subscription contribution directly funds your chosen charity.
              </p>
            </div>
            <div className="text-[11px] text-emerald-400/90 font-medium pt-2 border-t border-slate-800/80">
              Win cash & support causes
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. DRAW MECHANICS & PRIZE TIERS SECTION */}
      {/* ========================================================================= */}
      <section id="draw-mechanics" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-y border-slate-800/60 bg-[#070B13]">
        <div className="max-w-5xl mx-auto space-y-14">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
              <Trophy className="h-3.5 w-3.5" />
              <span>Transparent Algorithmic Splits</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Draw Mechanics & Prize Tiers
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Every month, active subscribers with {MAX_RETAINED_SCORES} valid Stableford scores enter the draw. The prize pool is split according to strict, transparent rules.
            </p>
          </div>

          {/* Tiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier 5 */}
            <div className="glass-panel p-6 rounded-2xl border-2 border-amber-500/40 bg-slate-900/40 space-y-4 glow-card relative flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Grand Jackpot
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {Math.round(PRIZE_TIER_SPLITS.tier_5.share * 100)}% Pool
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">5 Matches</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Match all 5 drawn numbers with your 5 retained scores. Claims {Math.round(PRIZE_TIER_SPLITS.tier_5.share * 100)}% of the monthly prize pool plus any accumulated rollover jackpot.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 space-y-1">
                <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Rollover Guarantee</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  If no member matches all 5 numbers, this entire 40% pool rolls over directly to increase the next draw jackpot.
                </p>
              </div>
            </div>

            {/* Tier 4 */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 glow-card flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full">
                    Second Tier
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {Math.round(PRIZE_TIER_SPLITS.tier_4.share * 100)}% Pool
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">4 Matches</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Match 4 of the 5 drawn numbers. Claims {Math.round(PRIZE_TIER_SPLITS.tier_4.share * 100)}% of the monthly prize pool, split equally among all verified 4-match winners.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-400">
                  Guaranteed monthly distribution without rollover requirements.
                </div>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 glow-card flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full">
                    Third Tier
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {Math.round(PRIZE_TIER_SPLITS.tier_3.share * 100)}% Pool
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">3 Matches</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Match 3 of the 5 drawn numbers. Claims {Math.round(PRIZE_TIER_SPLITS.tier_3.share * 100)}% of the monthly prize pool, split equally among all qualifying 3-match winners.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <div className="text-[10px] text-slate-400">
                  Highest probability winning tier rewarding regular golfers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CHARITY IMPACT SECTION */}
      {/* ========================================================================= */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12">
        <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-slate-800 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
              <Heart className="h-3.5 w-3.5 fill-current" />
              <span>Philanthropy First</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Giving Back is Built Directly into Every Membership
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              When you join Digital Heroes, you select a vetted non-profit partner. You control what portion of your membership contribution—between {MIN_CHARITY_CONTRIBUTION_PCT}% and {MAX_CHARITY_CONTRIBUTION_PCT}%—goes directly to support their mission and events.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/charities"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 text-xs transition shadow-lg shadow-emerald-500/20"
              >
                <span>Browse All Vetted Charities</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FEATURED CHARITY SPOTLIGHT */}
      {/* ========================================================================= */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Partner Spotlight</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Featured Charitable Causes
            </h2>
          </div>

          <Link
            href="/charities"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-medium transition"
          >
            <span>View Full Directory</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featuredCharities.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center border border-slate-800 space-y-3">
            <Heart className="h-10 w-10 mx-auto text-slate-600" />
            <h3 className="text-base font-semibold text-white">Explore Our Partners</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Our partner non-profits span medical support, youth golf initiatives, and community relief. Browse the full directory to select your beneficiary.
            </p>
            <div className="pt-2">
              <Link
                href="/charities"
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                <span>Browse Charity Directory</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCharities.slice(0, 3).map((charity) => (
              <CharityCard key={charity.id} charity={charity} />
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 6. MEMBERSHIP & PRICING SECTION */}
      {/* ========================================================================= */}
      <section id="membership" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-slate-800/60 bg-[#070B13]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
              <Coins className="h-3.5 w-3.5" />
              <span>Simple, Transparent Membership</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Choose How You Participate
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              All plans include complete dashboard access, monthly draw qualifications, and direct charity contribution allocations.
            </p>
          </div>

          {/* Pricing presentation component */}
          <PricingCards />
        </div>
      </section>
    </PublicShell>
  );
}
