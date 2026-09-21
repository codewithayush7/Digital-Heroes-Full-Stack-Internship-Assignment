"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserWinnerWithDraw } from "@/lib/services/draw.service";
import { SubmitProofModal } from "./SubmitProofModal";
import { getWinnerProofSignedUrlAction } from "@/app/actions/winner";
import {
  Trophy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface WinningsHistoryCardProps {
  winners: UserWinnerWithDraw[];
  totalWon: number;
  pendingAmount: number;
  paidAmount: number;
}

export function WinningsHistoryCard({
  winners,
  totalWon,
  pendingAmount,
  paidAmount,
}: WinningsHistoryCardProps) {
  const router = useRouter();
  const [selectedWinnerForProof, setSelectedWinnerForProof] =
    useState<UserWinnerWithDraw | null>(null);
  const [viewingProofId, setViewingProofId] = useState<string | null>(null);

  async function handleViewProof(winnerId: string) {
    setViewingProofId(winnerId);
    try {
      const res = await getWinnerProofSignedUrlAction(winnerId);
      if (res.data?.signedUrl) {
        window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        alert(res.error || "Failed to retrieve score proof image.");
      }
    } catch {
      alert("An unexpected error occurred while loading your proof image.");
    } finally {
      setViewingProofId(null);
    }
  }

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "tier_5":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            5-Match Jackpot
          </span>
        );
      case "tier_4":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            4-Match Winner
          </span>
        );
      case "tier_3":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            3-Match Winner
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{tier}</span>;
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        );
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400">
            <Clock className="h-3 w-3" />
            Under Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      case "pending_submission":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Proof Required
          </span>
        );
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Paid
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Pending
          </span>
        );
    }
  };

  return (
    <>
      <div className="glass-panel rounded-xl border border-slate-800 p-6 space-y-6 bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <h3 className="text-base font-bold text-white">
                Winnings & Payouts Overview
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Track your draw prize earnings, score verification status, and payout disbursements.
            </p>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total Career Won</span>
            <div className="text-lg font-bold text-emerald-400">
              ${totalWon.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Paid Out</span>
            <div className="text-lg font-bold text-white">
              ${paidAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Pending Payout</span>
            <div className="text-lg font-bold text-amber-400">
              ${pendingAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Winnings History List / Table */}
        {winners.length > 0 ? (
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-300">
              Prize History ({winners.length})
            </span>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3.5 font-medium">Draw</th>
                    <th className="py-2.5 px-3.5 font-medium">Tier</th>
                    <th className="py-2.5 px-3.5 font-medium">Prize</th>
                    <th className="py-2.5 px-3.5 font-medium">Verification</th>
                    <th className="py-2.5 px-3.5 font-medium">Payment</th>
                    <th className="py-2.5 px-3.5 font-medium text-right">Score Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {winners.map((winner) => {
                    const isRejected = winner.verification_status === "rejected";
                    const isPendingSubmission =
                      winner.verification_status === "pending_submission";
                    const canSubmitProof =
                      (isPendingSubmission || isRejected) &&
                      winner.payment_status === "pending";

                    return (
                      <tr key={winner.id} className="hover:bg-slate-900/30 transition">
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-white">
                            {winner.draw?.title ?? "Official Draw"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {winner.draw?.draw_date
                              ? new Date(winner.draw.draw_date).toLocaleDateString(
                                  undefined,
                                  { month: "short", day: "numeric", year: "numeric" }
                                )
                              : "Concluded"}
                          </div>
                        </td>

                        <td className="py-3 px-3.5">{getTierBadge(winner.tier)}</td>

                        <td className="py-3 px-3.5 font-bold text-emerald-300">
                          ${Number(winner.prize_amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        <td className="py-3 px-3.5 space-y-1">
                          {getVerificationBadge(winner.verification_status)}
                          {isRejected && winner.admin_notes && (
                            <div
                              className="text-[10px] text-rose-400 max-w-xs truncate italic"
                              title={winner.admin_notes}
                            >
                              Note: {winner.admin_notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          {getPaymentBadge(winner.payment_status)}
                        </td>

                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Submit / Resubmit Proof Trigger */}
                            {canSubmitProof && (
                              <button
                                type="button"
                                onClick={() => setSelectedWinnerForProof(winner)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                                  isRejected
                                    ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40"
                                    : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40"
                                }`}
                              >
                                <Upload className="h-3 w-3" />
                                <span>{isRejected ? "Resubmit Proof" : "Submit Proof"}</span>
                              </button>
                            )}

                            {/* View Uploaded Proof via Signed URL */}
                            {winner.proof_image_url && (
                              <button
                                type="button"
                                onClick={() => handleViewProof(winner.id)}
                                disabled={viewingProofId === winner.id}
                                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition underline underline-offset-2 disabled:opacity-50"
                              >
                                {viewingProofId === winner.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ExternalLink className="h-3 w-3" />
                                )}
                                <span>View Proof</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-5 text-center space-y-1.5">
            <p className="text-xs font-semibold text-slate-300">
              No prize winnings recorded yet
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Keep your qualifying subscription active and your 5 golf scores recorded to participate and win in upcoming monthly draws.
            </p>
          </div>
        )}
      </div>

      {/* Proof Submission Modal */}
      <SubmitProofModal
        isOpen={selectedWinnerForProof !== null}
        winner={selectedWinnerForProof}
        onClose={() => setSelectedWinnerForProof(null)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
