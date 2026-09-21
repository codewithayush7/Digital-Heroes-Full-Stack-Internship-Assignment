"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDrawAction } from "@/app/actions/draw";
import { Sparkles, Calendar, Type, Dices, AlertCircle, Loader2 } from "lucide-react";

interface DrawCreateFormProps {
  currentRollover: number;
}

export function DrawCreateForm({ currentRollover }: DrawCreateFormProps) {
  const router = useRouter();

  // Default to the last day of the current month at 20:00 local time
  const now = new Date();
  const defaultDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 20, 0, 0);
  const defaultDateStr = defaultDate.toISOString().slice(0, 16);

  const [title, setTitle] = useState(`Monthly Charity Draw — ${defaultDate.toLocaleString("default", { month: "long", year: "numeric" })}`);
  const [drawDate, setDrawDate] = useState(defaultDateStr);
  const [drawMode, setDrawMode] = useState<"random" | "algorithmic">("algorithmic");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPending(true);

    try {
      const isoDate = new Date(drawDate).toISOString();
      const res = await createDrawAction({
        title,
        draw_date: isoDate,
        draw_mode: drawMode,
      });

      if (res.error || !res.data) {
        setErrorMessage(res.error || "Failed to create draw draft.");
        setIsPending(false);
        return;
      }

      router.push(`/admin/draws/${res.data.id}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 animate-fadeIn">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-rose-200">Unable to Create Draw</h4>
            <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Information Banner */}
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>New Draw Lifecycle: Initialized in Draft</span>
        </div>
        <p className="text-xs text-slate-400">
          The draw will be created as a <code className="text-slate-200 font-mono">draft</code>. You can run simulations, preview hypothetical participant matches, and review pool allocations before publishing.
        </p>
        {currentRollover > 0 && (
          <p className="text-xs text-emerald-400 font-medium pt-1">
            Authoritative Rollover Available: ₹{currentRollover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Draw Title */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5 text-slate-400" />
            <span>Draw Title</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            placeholder="e.g. March 2026 Monthly Charity Draw"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          />
        </div>

        {/* Draw Date */}
        <div className="space-y-1.5">
          <label htmlFor="draw_date" className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Scheduled Draw Date & Time</span>
          </label>
          <input
            id="draw_date"
            name="draw_date"
            type="datetime-local"
            required
            value={drawDate}
            onChange={(e) => setDrawDate(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          />
        </div>

        {/* Draw Mode */}
        <div className="space-y-1.5">
          <label htmlFor="draw_mode" className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Dices className="h-3.5 w-3.5 text-slate-400" />
            <span>Draw Mode</span>
          </label>
          <select
            id="draw_mode"
            name="draw_mode"
            value={drawMode}
            onChange={(e) => setDrawMode(e.target.value as "random" | "algorithmic")}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          >
            <option value="algorithmic">Algorithmic — Weighted by Participant Score Frequency</option>
            <option value="random">Random — Uniform Pseudo-Random Selection</option>
          </select>
          <p className="text-[11px] text-slate-500">
            {drawMode === "algorithmic"
              ? "Selects winning numbers proportionally based on scores retained by active subscribers."
              : "Standard lottery-style selection with uniform probability across 1 to 45."}
          </p>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 text-xs transition duration-150 shadow-md shadow-amber-500/20 cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating Draft...</span>
            </>
          ) : (
            <span>Create Draft Draw &rarr;</span>
          )}
        </button>
      </div>
    </form>
  );
}
