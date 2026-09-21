"use client";

import type { Tables } from "@/types/database.types";
import { Trophy, Award, Calendar, Check, AlertCircle } from "lucide-react";

type Draw = Tables<"draws">;
type DrawEntry = Tables<"draw_entries">;

interface DrawResultsCardProps {
  latestDraw: Draw | null;
  userEntry: DrawEntry | null;
}

export function DrawResultsCard({
  latestDraw,
  userEntry,
}: DrawResultsCardProps) {
  if (!latestDraw) {
    return (
      <div className="glass-panel rounded-xl border border-slate-800 p-6 text-center space-y-3 bg-slate-900/30">
        <div className="h-10 w-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">
            Official Draw Results
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No official draws have been completed yet. Once our inaugural monthly draw is published, official winning numbers and your entry matching results will appear here.
          </p>
        </div>
      </div>
    );
  }

  const drawnNumbers = latestDraw.drawn_numbers ?? [];
  const matchedSet = new Set(userEntry?.matched_numbers ?? []);
  const formattedDate = new Date(
    latestDraw.published_at || latestDraw.draw_date
  ).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const getTierLabel = (tier: string | null | undefined) => {
    switch (tier) {
      case "tier_5":
        return "5-Number Match (Jackpot)";
      case "tier_4":
        return "4-Number Match";
      case "tier_3":
        return "3-Number Match";
      default:
        return null;
    }
  };

  const isWinner = Boolean(userEntry?.winning_tier && Number(userEntry.prize_amount ?? 0) > 0);

  return (
    <div className="glass-panel rounded-xl border border-slate-800 p-6 space-y-6 bg-slate-900/40">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
            Latest Official Results
          </span>
          <h3 className="text-lg font-bold text-white">{latestDraw.title}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <span>Published on {formattedDate}</span>
        </div>
      </div>

      {/* Official Winning Numbers */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold text-slate-300">
          Official Drawn Numbers
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {drawnNumbers.map((num, idx) => (
            <div
              key={idx}
              className="h-11 w-11 rounded-xl bg-gradient-to-b from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-300 font-extrabold text-base flex items-center justify-center shadow-md shadow-amber-950/20"
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* Rollover Notice (if applicable) */}
      {latestDraw.jackpot_rolled_over && Number(latestDraw.rollover_jackpot_out ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <span className="font-medium">
            5-Match Jackpot Rolled Over:
          </span>
          <span className="font-bold text-amber-300">
            ${Number(latestDraw.rollover_jackpot_out).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            carried forward to next draw
          </span>
        </div>
      )}

      {/* User's Entry & Match Breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            Your Official Entry Snapshot
          </span>
          {userEntry && (
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isWinner
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {userEntry.matches_count} of 5 Matches
            </span>
          )}
        </div>

        {userEntry ? (
          <div className="space-y-3">
            {/* User Numbers with Match Indicators */}
            <div className="flex flex-wrap items-center gap-2">
              {userEntry.scores_snapshot.map((num, idx) => {
                const isMatch = matchedSet.has(num);
                return (
                  <div
                    key={idx}
                    className={`relative h-10 px-3.5 rounded-lg border flex items-center justify-center text-sm font-bold transition ${
                      isMatch
                        ? "bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/20"
                        : "bg-slate-800/80 border-slate-700 text-slate-300"
                    }`}
                  >
                    <span>{num}</span>
                    {isMatch && (
                      <span className="ml-1.5 inline-flex items-center text-[10px] uppercase font-extrabold text-amber-400">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Win Celebration Banner */}
            {isWinner ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-200">
                      Congratulations! You Won!
                    </span>
                    <p className="text-[11px] text-emerald-300/80">
                      Tier: {getTierLabel(userEntry.winning_tier)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-emerald-300">
                    ${Number(userEntry.prize_amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    See Winnings History below
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {userEntry.matches_count > 0
                  ? `You matched ${userEntry.matches_count} number${
                      userEntry.matches_count === 1 ? "" : "s"
                    }. A minimum of 3 matches is required to win a prize.`
                  : "None of your snapshot numbers matched this draw. Keep your scores updated for the next monthly draw!"}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-800 bg-slate-900/50 text-xs text-slate-400">
            <AlertCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-300">
                Did not participate in this draw
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                You did not have an active subscription or 5 retained golf scores at the time this draw was conducted. Ensure your qualification checklist above is complete for the next monthly draw.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
