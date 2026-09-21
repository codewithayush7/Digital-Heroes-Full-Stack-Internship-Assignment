"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishDrawAction } from "@/app/actions/draw";
import {
  ShieldAlert,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
} from "lucide-react";

interface PublishDrawModalProps {
  drawId: string;
  drawTitle: string;
  drawnNumbers: number[];
  totalPrizePool: number;
  tier5WinnersCount: number;
  tier4WinnersCount: number;
  tier3WinnersCount: number;
  jackpotRolledOver: boolean;
  rolloverJackpotOut: number;
}

export function PublishDrawModal({
  drawId,
  drawTitle,
  drawnNumbers,
  totalPrizePool,
  tier5WinnersCount,
  tier4WinnersCount,
  tier3WinnersCount,
  jackpotRolledOver,
  rolloverJackpotOut,
}: PublishDrawModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorType, setErrorType] = useState<"stale" | "generic" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalWinners = tier5WinnersCount + tier4WinnersCount + tier3WinnersCount;

  const handleOpen = () => {
    setIsOpen(true);
    setIsConfirmed(false);
    setErrorType(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handlePublish = async () => {
    if (!isConfirmed || isPending) return;

    setIsPending(true);
    setErrorType(null);
    setErrorMessage(null);

    try {
      const res = await publishDrawAction(drawId);

      if (res.error) {
        if (/STALE_ROLLOVER/i.test(res.error)) {
          setErrorType("stale");
          setErrorMessage(
            "Another draw was published after this simulation was generated, altering the authoritative rollover balance. You must re-simulate the draw before publishing."
          );
        } else {
          setErrorType("generic");
          setErrorMessage(res.error);
        }
        setIsPending(false);
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorType("generic");
      setErrorMessage(err instanceof Error ? err.message : "Failed to publish draw.");
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition duration-150 shadow-md shadow-emerald-500/20 cursor-pointer"
      >
        <Lock className="h-3.5 w-3.5" />
        <span>Publish Draw...</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div className="glass-panel max-w-lg w-full rounded-2xl border border-slate-700 bg-[#0F172A] p-6 space-y-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="publish-dialog-title" className="text-base font-bold text-white">
                    Publish Draw Authoritatively
                  </h3>
                  <p className="text-xs text-slate-400">
                    Irreversible publication action
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="text-slate-400 hover:text-slate-200 transition p-1"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stale Rollover Alert */}
            {errorType === "stale" && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>Simulation Out of Date (Stale Rollover)</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  {errorMessage}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2"
                  >
                    Close and click &quot;Re-Simulate&quot; &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Generic Error */}
            {errorType === "generic" && errorMessage && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Authoritative Warning Notice */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-amber-300">
                Authoritative Action Notice
              </p>
              <p className="text-slate-400 leading-relaxed">
                Publishing transitions this draw from <span className="text-amber-400 font-mono">simulated</span> to <span className="text-emerald-400 font-mono">published</span>. Winning rows will be permanently inserted into the winners ledger, prize amounts will be finalized, and the rollover outcome will become authoritative. This cannot be undone through the normal application flow.
              </p>
            </div>

            {/* Audit Checklist */}
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Target Draw:</span>
                <span className="font-semibold text-white truncate max-w-[240px]">{drawTitle}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Winning Numbers:</span>
                <div className="flex gap-1">
                  {drawnNumbers.map((n, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center h-6 w-6 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs"
                    >
                      {String(n).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Total Prize Pool:</span>
                <span className="font-mono font-bold text-white">
                  ₹{totalPrizePool.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Winners Created:</span>
                <span className="font-bold text-emerald-400">
                  {totalWinners} Winner{totalWinners === 1 ? "" : "s"} ({tier5WinnersCount} T5, {tier4WinnersCount} T4, {tier3WinnersCount} T3)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Rollover Outcome:</span>
                <span className={`font-semibold ${jackpotRolledOver ? "text-amber-400" : "text-emerald-400"}`}>
                  {jackpotRolledOver
                    ? `₹${rolloverJackpotOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Rolled Over)`
                    : "₹0.00 (Jackpot Won)"}
                </span>
              </div>
            </div>

            {/* Explicit Confirmation Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                disabled={isPending || errorType === "stale"}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">
                I have reviewed the simulation audit above and authorize authoritative publication and winner row creation.
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!isConfirmed || isPending || errorType === "stale"}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold px-5 py-2 text-xs transition duration-150 shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Authorizing & Publishing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm & Publish Draw</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
