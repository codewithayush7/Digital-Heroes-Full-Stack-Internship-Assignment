"use client";

import { useState } from "react";
import { markWinnerPaidAction } from "@/app/actions/winner";
import type { WinnerWithDetails } from "@/lib/services/draw.service";
import {
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Coins,
  ShieldCheck,
} from "lucide-react";

interface AdminWinnerPayoutModalProps {
  isOpen: boolean;
  winner: WinnerWithDetails | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminWinnerPayoutModal({
  isOpen,
  winner,
  onClose,
  onSuccess,
}: AdminWinnerPayoutModalProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !winner) return null;

  async function handleConfirmPayout() {
    if (!winner) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await markWinnerPaidAction({
        winnerId: winner.id,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Disburse Prize Payout</h3>
              <p className="text-xs text-slate-400">Manual payout recording and confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Winner Details Card */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Payee / Winner</span>
              <span className="text-xs font-bold text-white">
                {winner.profile?.full_name || "Golfer"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Email</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {winner.profile?.email || winner.user_id.slice(0, 8) + "..."}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Draw</span>
              <span className="text-slate-300 font-medium">
                {winner.draw?.title || "Draw Winner"}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span>Prize Amount</span>
              </span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                ₹{Number(winner.prize_amount).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Verification Notice */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Score proof has been verified and approved. You are recording manual disbursement via bank transfer / UPI.
            </span>
          </div>

          {/* Payout Reference Notes */}
          <div className="space-y-1.5">
            <label htmlFor="payoutNotes" className="block text-xs font-semibold text-slate-300">
              Payout Reference / Notes (Optional)
            </label>
            <textarea
              id="payoutNotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bank wire ref #987654321 transferred on March 21."
              className="w-full text-xs rounded-xl bg-slate-950 border border-slate-800 p-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 transition resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmPayout}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 transition shadow-lg shadow-emerald-900/20 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            <span>Confirm Payout Completed</span>
          </button>
        </div>
      </div>
    </div>
  );
}
