import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DrawService } from "@/lib/services/draw.service";
import { SimulateDrawButton } from "@/components/admin/draws/SimulateDrawButton";
import { PublishDrawModal } from "@/components/admin/draws/PublishDrawModal";
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Trophy,
  Users,
  CheckCircle2,
  Lock,
  ExternalLink,
  Coins,
  FileSpreadsheet,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface DrawDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DrawDetailPage({ params }: DrawDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [drawResult, entriesResult] = await Promise.all([
    DrawService.getDraw(supabase, id),
    DrawService.getDrawEntriesWithProfiles(supabase, id),
  ]);

  if (drawResult.error || !drawResult.data) {
    notFound();
  }

  const draw = drawResult.data;
  const entries = entriesResult.data ?? [];

  const tier5Winners = entries.filter((e) => e.winning_tier === "tier_5");
  const tier4Winners = entries.filter((e) => e.winning_tier === "tier_4");
  const tier3Winners = entries.filter((e) => e.winning_tier === "tier_3");

  const drawDateFormatted = new Date(draw.draw_date).toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const publishedAtFormatted = draw.published_at
    ? new Date(draw.published_at).toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header & Breadcrumb */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1.5">
          <Link
            href="/admin/draws"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Draws</span>
          </Link>
          <div className="flex items-center gap-2 pt-0.5">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                draw.status === "published"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : draw.status === "simulated"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <span className="capitalize">{draw.status}</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400 capitalize">
              {draw.draw_mode} Mode
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {draw.title}
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>Scheduled: {drawDateFormatted}</span>
          </div>
        </div>

        {/* Action Controls by Status */}
        <div className="flex items-center gap-3">
          {draw.status === "draft" && (
            <SimulateDrawButton drawId={draw.id} />
          )}

          {draw.status === "simulated" && (
            <div className="flex items-center gap-2.5">
              <SimulateDrawButton drawId={draw.id} isResimulation />
              <PublishDrawModal
                drawId={draw.id}
                drawTitle={draw.title}
                drawnNumbers={draw.drawn_numbers ?? []}
                totalPrizePool={Number(draw.total_prize_pool)}
                tier5WinnersCount={tier5Winners.length}
                tier4WinnersCount={tier4Winners.length}
                tier3WinnersCount={tier3Winners.length}
                jackpotRolledOver={draw.jackpot_rolled_over}
                rolloverJackpotOut={Number(draw.rollover_jackpot_out)}
              />
            </div>
          )}

          {draw.status === "published" && (
            <Link
              href={`/admin/winners?drawId=${draw.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold transition"
            >
              <Trophy className="h-3.5 w-3.5 text-purple-400" />
              <span>View Winners ({tier5Winners.length + tier4Winners.length + tier3Winners.length})</span>
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </Link>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* LIFECYCLE STATE: DRAFT                                        */}
      {/* ------------------------------------------------------------- */}
      {draw.status === "draft" && (
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6 text-center max-w-xl mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">
              Draw Configured in Draft State
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This draw is scheduled for <span className="text-slate-200">{drawDateFormatted}</span> using <span className="text-slate-200 capitalize">{draw.draw_mode}</span> mode. Run a simulation to evaluate current qualifying subscribers, calculate pool amounts with rollover, and generate hypothetical numbers.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <SimulateDrawButton drawId={draw.id} />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LIFECYCLE STATE: SIMULATED OR PUBLISHED                       */}
      {/* ------------------------------------------------------------- */}
      {(draw.status === "simulated" || draw.status === "published") && (
        <div className="space-y-8">
          {/* Status Context Banner */}
          {draw.status === "simulated" ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-xs text-amber-200">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-300">Hypothetical Simulation Snapshot</h4>
                <p className="text-amber-200/90 mt-0.5 leading-relaxed">
                  These results are a persistent simulation snapshot. Winning numbers, matches, and prize allocations are hypothetical until authoritatively published. Re-simulating replaces this snapshot.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3 text-xs text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-300">Authoritatively Published Draw</h4>
                <p className="text-emerald-200/90 mt-0.5 leading-relaxed">
                  Published on {publishedAtFormatted}. Winning rows have been created in the winners ledger, and rollover has been finalized.
                </p>
              </div>
            </div>
          )}

          {/* Drawn Winning Numbers */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                {draw.status === "published" ? "Official Winning Numbers" : "Simulated Drawn Numbers"}
              </span>
              <span className="text-xs text-slate-500">
                Mode: <span className="capitalize text-slate-300 font-medium">{draw.draw_mode}</span> (1 to 45)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(draw.drawn_numbers ?? []).map((num, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 font-mono font-extrabold text-xl sm:text-2xl shadow-lg shadow-amber-500/10"
                >
                  {String(num).padStart(2, "0")}
                </div>
              ))}
            </div>
          </div>

          {/* Financial & Pool Accounting Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Prize Pool */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Total Prize Pool</span>
                <Coins className="h-4 w-4 text-amber-400" />
              </span>
              <div className="text-2xl font-bold font-mono text-white">
                ₹{Number(draw.total_prize_pool).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                ₹{Number(draw.subscription_pool_portion).toLocaleString("en-IN", { minimumFractionDigits: 2 })} sub + ₹{Number(draw.rollover_jackpot_in).toLocaleString("en-IN", { minimumFractionDigits: 2 })} rollover
              </p>
            </div>

            {/* Participation Breakdown */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Participation</span>
                <Users className="h-4 w-4 text-blue-400" />
              </span>
              <div className="text-2xl font-bold font-mono text-white">
                {entries.length} <span className="text-xs text-slate-400 font-normal">participants</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {draw.total_active_subscribers} active qualifying subscribers
              </p>
            </div>

            {/* Rollover In */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Rollover In</span>
                <Lock className="h-4 w-4 text-emerald-400" />
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                ₹{Number(draw.rollover_jackpot_in).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500">
                From previous published draw
              </p>
            </div>

            {/* Rollover Out */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-between">
                <span>Rollover Out</span>
                <Trophy className="h-4 w-4 text-amber-400" />
              </span>
              <div className={`text-2xl font-bold font-mono ${draw.jackpot_rolled_over ? "text-amber-400" : "text-emerald-400"}`}>
                {draw.jackpot_rolled_over
                  ? `₹${Number(draw.rollover_jackpot_out).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  : "₹0.00"}
              </div>
              <p className="text-[11px] text-slate-500">
                {draw.jackpot_rolled_over
                  ? "Rolled over (0 Tier 5 winners)"
                  : "Jackpot won by Tier 5 winners"}
              </p>
            </div>
          </div>

          {/* Tier Allocation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tier 5 */}
            <div className="glass-panel p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Tier 5 (5 Matches · 40%)
                </span>
                <span className="text-xs font-bold text-amber-300 font-mono">
                  {tier5Winners.length} Winner{tier5Winners.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                ₹{Number(draw.tier_5_pool).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                {tier5Winners.length > 0
                  ? `₹${(Number(draw.tier_5_pool) / tier5Winners.length).toLocaleString("en-IN", { minimumFractionDigits: 2 })} per winner`
                  : `Rolled over: ₹${Number(draw.rollover_jackpot_out).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              </p>
            </div>

            {/* Tier 4 */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Tier 4 (4 Matches · 35%)
                </span>
                <span className="text-xs font-bold text-slate-300 font-mono">
                  {tier4Winners.length} Winner{tier4Winners.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                ₹{Number(draw.tier_4_pool).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                {tier4Winners.length > 0
                  ? `₹${(Number(draw.tier_4_pool) / tier4Winners.length).toLocaleString("en-IN", { minimumFractionDigits: 2 })} per winner`
                  : `Unclaimed: ₹${Number(draw.unclaimed_tier_4).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              </p>
            </div>

            {/* Tier 3 */}
            <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Tier 3 (3 Matches · 25%)
                </span>
                <span className="text-xs font-bold text-slate-300 font-mono">
                  {tier3Winners.length} Winner{tier3Winners.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                ₹{Number(draw.tier_3_pool).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400">
                {tier3Winners.length > 0
                  ? `₹${(Number(draw.tier_3_pool) / tier3Winners.length).toLocaleString("en-IN", { minimumFractionDigits: 2 })} per winner`
                  : `Unclaimed: ₹${Number(draw.unclaimed_tier_3).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>

          {/* Participant Snapshot Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Participant Audit Snapshot ({entries.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Scores ordered by played date DESC
              </span>
            </div>

            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#0F172A] z-10">
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">5 Scores Snapshot</th>
                      <th className="py-3 px-4 text-center">Matches</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4 text-right">Prize Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {entries.map((entry) => {
                      const drawnSet = new Set(draw.drawn_numbers ?? []);

                      return (
                        <tr
                          key={entry.id}
                          className={`hover:bg-slate-800/30 transition ${
                            entry.winning_tier ? "bg-amber-500/5 font-medium" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">
                              {entry.profile?.full_name || "Golfer Participant"}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {entry.profile?.email || entry.user_id.slice(0, 8) + "..."}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-mono">
                              {entry.scores_snapshot.map((score, sIdx) => {
                                const isMatched = drawnSet.has(score);
                                return (
                                  <span
                                    key={sIdx}
                                    className={`inline-flex items-center justify-center h-6 w-6 rounded text-xs font-bold ${
                                      isMatched
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                                        : "bg-slate-800/80 text-slate-400 border border-slate-700"
                                    }`}
                                  >
                                    {score}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-white">
                            {entry.matches_count}
                          </td>

                          <td className="py-3 px-4">
                            {entry.winning_tier ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                                  entry.winning_tier === "tier_5"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : entry.winning_tier === "tier_4"
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                    : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                }`}
                              >
                                {entry.winning_tier.replace("_", " ")}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono">
                            {entry.prize_amount > 0 ? (
                              <span className="font-bold text-emerald-400">
                                ₹{Number(entry.prize_amount).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            ) : (
                              <span className="text-slate-600">₹0.00</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
