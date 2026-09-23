"use client";

import { CheckCircle2, AlertCircle, Sparkles, ArrowDown } from "lucide-react";

interface DrawParticipationCardProps {
  isSubscribed: boolean;
  scoresCount: number;
  retainedScores: number[];
}

export function DrawParticipationCard({
  isSubscribed,
  scoresCount,
  retainedScores,
}: DrawParticipationCardProps) {
  const isReady = isSubscribed && scoresCount === 5;

  return (
    <div className="glass-panel rounded-xl border border-slate-800 p-6 space-y-5 bg-slate-900/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              Next Monthly Draw Participation
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Participation is determined at draw time from your active subscription and latest 5 retained golf scores.
          </p>
        </div>

        <div>
          {isReady ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready for the Next Monthly Draw
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <AlertCircle className="h-3.5 w-3.5" />
              Criteria Incomplete
            </span>
          )}
        </div>
      </div>

      {isReady ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-300">
              Current Qualifying Numbers:
            </span>
            <span className="text-slate-400 text-[11px]">
              Authoritative snapshot captured at draw time
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {retainedScores.map((score, idx) => (
              <div
                key={idx}
                className="h-10 w-10 rounded-xl bg-slate-800 border border-emerald-500/40 flex items-center justify-center text-sm font-bold text-emerald-300 shadow-sm"
              >
                {score}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            You are in good standing. When the next monthly draw runs, your latest 5 retained scores at that moment will form your official draw entry.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Requirement 1: Subscription */}
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                isSubscribed
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-300"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span>1. Active Subscription</span>
                {isSubscribed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {isSubscribed
                  ? "Qualifying subscription confirmed."
                  : "An active membership is required to enter monthly draws."}
              </p>
              {!isSubscribed && (
                <a
                  href="#subscription-card"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
                >
                  <span>Subscribe below</span>
                  <ArrowDown className="h-3 w-3" />
                </a>
              )}
            </div>

            {/* Requirement 2: 5 Golf Scores */}
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                scoresCount === 5
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-300"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span>2. Retained Golf Scores ({scoresCount} / 5)</span>
                {scoresCount === 5 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {scoresCount === 5
                  ? "5 scores recorded and retained."
                  : `Enter ${5 - scoresCount} more score${
                      5 - scoresCount === 1 ? "" : "s"
                    } to qualify for draw entry.`}
              </p>
              {scoresCount < 5 &&
                (isSubscribed ? (
                  <a
                    href="#score-form"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
                  >
                    <span>Enter scores below</span>
                    <ArrowDown className="h-3 w-3" />
                  </a>
                ) : (
                  <a
                    href="#subscription-card"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition"
                  >
                    <span>Subscribe to enter scores</span>
                    <ArrowDown className="h-3 w-3" />
                  </a>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
