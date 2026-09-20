"use client";

import { useActionState, useState } from "react";
import type { Charity } from "@/lib/services/charity.service";
import {
  updateCharitySelectionAction,
  type CharityActionResult,
} from "@/app/actions/charity";
import { Heart, CheckCircle2, AlertCircle, Save } from "lucide-react";
import {
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "@/lib/config/constants";

export function CharitySelectionForm({
  charities,
  selectedCharityId,
  currentPct,
}: {
  charities: Charity[];
  selectedCharityId: string | null;
  currentPct: number;
}) {
  const [chosenCharityId, setChosenCharityId] = useState<string>(
    selectedCharityId || ""
  );
  const [contributionPct, setContributionPct] = useState<number>(
    currentPct || MIN_CHARITY_CONTRIBUTION_PCT
  );

  const [state, formAction, isPending] = useActionState<
    CharityActionResult | null,
    FormData
  >(updateCharitySelectionAction, null);

  const selectedCharity = charities.find((c) => c.id === chosenCharityId);

  return (
    <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-emerald-400 fill-current" />
          <h3 className="text-sm font-semibold text-white">
            My Charity Giving Preference
          </h3>
        </div>
        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          {contributionPct}% of Fee
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
          <span>{state.message}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* Charity Dropdown Picker */}
        <div className="space-y-1.5">
          <label
            htmlFor="charityId"
            className="block text-xs font-medium text-slate-300"
          >
            Designated Charity
          </label>
          <select
            id="charityId"
            name="charityId"
            value={chosenCharityId}
            onChange={(e) => setChosenCharityId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
          >
            <option value="">-- Select a Charity --</option>
            {charities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_featured ? "★ (Featured)" : ""}
              </option>
            ))}
          </select>
          {selectedCharity?.tagline && (
            <p className="text-[11px] text-slate-400 mt-1 italic">
              &quot;{selectedCharity.tagline}&quot;
            </p>
          )}
        </div>

        {/* Contribution Percentage Slider */}
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Contribution Level (Min {MIN_CHARITY_CONTRIBUTION_PCT}%)
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {contributionPct}%
            </span>
          </div>
          <input
            id="charityContributionPct"
            name="charityContributionPct"
            type="range"
            min={MIN_CHARITY_CONTRIBUTION_PCT}
            max={MAX_CHARITY_CONTRIBUTION_PCT}
            step="5"
            value={contributionPct}
            onChange={(e) => setContributionPct(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Minimum {MIN_CHARITY_CONTRIBUTION_PCT}%</span>
            <span>50%</span>
            <span>Maximum {MAX_CHARITY_CONTRIBUTION_PCT}%</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2 px-4 text-xs transition duration-150 disabled:opacity-50 shadow-md shadow-emerald-500/20"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? <span>Saving...</span> : <span>Save Preferences</span>}
        </button>
      </form>
    </div>
  );
}
