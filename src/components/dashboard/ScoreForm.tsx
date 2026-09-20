"use client";

import { useActionState, useEffect, useRef } from "react";
import { addScoreAction, type ScoreActionResult } from "@/app/actions/score";
import { PlusCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { SCORE_MIN, SCORE_MAX } from "@/lib/config/constants";

export function ScoreForm({ currentCount }: { currentCount: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    ScoreActionResult | null,
    FormData
  >(addScoreAction, null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state?.success]);

  return (
    <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-amber-400" />
          <span>Record New Score</span>
        </h3>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
          Retained: {currentCount} / 5
        </span>
      </div>

      {state?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <p>{state.error}</p>
        </div>
      )}

      {state?.success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Score successfully saved and retention updated.</span>
        </div>
      )}

      <form ref={formRef} action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label
            htmlFor="score"
            className="block text-xs font-medium text-slate-300"
          >
            Stableford Points ({SCORE_MIN}–{SCORE_MAX})
          </label>
          <input
            id="score"
            name="score"
            type="number"
            min={SCORE_MIN}
            max={SCORE_MAX}
            required
            placeholder="e.g. 36"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="playedDate"
            className="block text-xs font-medium text-slate-300"
          >
            Date Played
          </label>
          <input
            id="playedDate"
            name="playedDate"
            type="date"
            max={today}
            defaultValue={today}
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-2 px-3 text-xs transition duration-150 disabled:opacity-50 shadow-md shadow-amber-500/20 h-[38px]"
          >
            {isPending ? <span>Saving...</span> : <span>Add Score</span>}
          </button>
        </div>
      </form>

      {currentCount >= 5 && (
        <p className="text-[11px] text-slate-500">
          * You currently have 5 retained scores. Adding a newer score will automatically remove your oldest score.
        </p>
      )}
    </div>
  );
}
