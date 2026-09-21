"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { simulateDrawAction } from "@/app/actions/draw";
import { Play, RefreshCw, Loader2, AlertCircle } from "lucide-react";

interface SimulateDrawButtonProps {
  drawId: string;
  isResimulation?: boolean;
  disabled?: boolean;
}

export function SimulateDrawButton({
  drawId,
  isResimulation = false,
  disabled = false,
}: SimulateDrawButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async () => {
    if (isResimulation) {
      const confirmed = window.confirm(
        "Re-simulating will completely replace the current simulation snapshot, redraw winning numbers, and re-calculate all participant matches. Do you want to proceed?"
      );
      if (!confirmed) return;
    }

    setIsPending(true);
    setError(null);

    try {
      const res = await simulateDrawAction(drawId);
      if (res.error) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.refresh();
      setIsPending(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to simulate draw.");
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg max-w-md">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleSimulate}
        disabled={disabled || isPending}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
          isResimulation
            ? "border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
            : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
        }`}
      >
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{isResimulation ? "Re-Simulating Draw..." : "Simulating Draw..."}</span>
          </>
        ) : isResimulation ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Re-Simulate (Replace Snapshot)</span>
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Run Simulation</span>
          </>
        )}
      </button>
    </div>
  );
}
