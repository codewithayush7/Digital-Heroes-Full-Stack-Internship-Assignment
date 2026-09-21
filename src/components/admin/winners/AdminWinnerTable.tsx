"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WinnerWithDetails } from "@/lib/services/draw.service";
import { AdminWinnerReviewModal } from "./AdminWinnerReviewModal";
import { AdminWinnerPayoutModal } from "./AdminWinnerPayoutModal";
import {
  ShieldCheck,
  CreditCard,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Eye,
  FileCheck,
} from "lucide-react";

interface AdminWinnerTableProps {
  winners: WinnerWithDetails[];
}

export function AdminWinnerTable({ winners }: AdminWinnerTableProps) {
  const router = useRouter();
  const [reviewWinnerId, setReviewWinnerId] = useState<string | null>(null);
  const [payoutWinner, setPayoutWinner] = useState<WinnerWithDetails | null>(null);

  function handleActionSuccess() {
    router.refresh();
  }

  if (winners.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
          <FileCheck className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">No Winners Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No winners match the selected filter criteria or have been generated yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Winner</th>
                <th className="py-3 px-4">Draw</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Prize Amount</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Payout</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {winners.map((winner) => {
                const drawDateFormatted = winner.draw?.draw_date
                  ? new Date(winner.draw.draw_date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";

                const isApproved = winner.verification_status === "approved";
                const isPendingReview = winner.verification_status === "pending_review";
                const isPaid = winner.payment_status === "paid";
                const canPay = isApproved && !isPaid;

                return (
                  <tr
                    key={winner.id}
                    className="hover:bg-slate-800/30 transition group"
                  >
                    {/* Winner Details */}
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-bold text-sm text-white">
                        {winner.profile?.full_name || "Anonymous Golfer"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {winner.profile?.email || winner.user_id.slice(0, 8) + "..."}
                      </div>
                    </td>

                    {/* Draw Details */}
                    <td className="py-3.5 px-4 space-y-0.5">
                      {winner.draw ? (
                        <Link
                          href={`/admin/draws/${winner.draw.id}`}
                          className="font-medium text-slate-200 hover:text-amber-400 transition inline-flex items-center gap-1"
                        >
                          <span>{winner.draw.title}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-slate-500" />
                        </Link>
                      ) : (
                        <span className="text-slate-500 font-mono">
                          {winner.draw_id.slice(0, 8)}...
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>{drawDateFormatted}</span>
                      </div>
                    </td>

                    {/* Prize Tier */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          winner.tier === "tier_5"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                            : winner.tier === "tier_4"
                            ? "bg-blue-500/15 text-blue-300 border border-blue-500/40"
                            : "bg-purple-500/15 text-purple-300 border border-purple-500/40"
                        }`}
                      >
                        {winner.tier.replace("_", " ")}
                      </span>
                    </td>

                    {/* Prize Amount */}
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                      ₹{Number(winner.prize_amount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    {/* Verification Status */}
                    <td className="py-3.5 px-4 space-y-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isApproved
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : winner.verification_status === "rejected"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : isPendingReview
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span className="capitalize">
                          {winner.verification_status.replace("_", " ")}
                        </span>
                      </span>

                      {winner.admin_notes && (
                        <div
                          className="text-[10px] text-slate-400 truncate max-w-[180px] italic"
                          title={winner.admin_notes}
                        >
                          &quot;{winner.admin_notes}&quot;
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4 space-y-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        <CreditCard className="h-3 w-3" />
                        <span className="capitalize">{winner.payment_status}</span>
                      </span>

                      {winner.paid_at && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(winner.paid_at).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Review Proof Trigger */}
                        {winner.proof_image_url ? (
                          <button
                            type="button"
                            onClick={() => setReviewWinnerId(winner.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                              isPendingReview
                                ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                            }`}
                          >
                            <Eye className="h-3 w-3" />
                            <span>
                              {isPendingReview ? "Review Proof" : "Inspect Proof"}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic pr-2">
                            Awaiting Upload
                          </span>
                        )}

                        {/* Mark Paid Trigger */}
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => setPayoutWinner(winner)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 transition"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Mark Paid</span>
                          </button>
                        )}

                        {isPaid && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Disbursed</span>
                          </span>
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

      {/* Review Modal */}
      <AdminWinnerReviewModal
        isOpen={reviewWinnerId !== null}
        winnerId={reviewWinnerId}
        onClose={() => setReviewWinnerId(null)}
        onSuccess={handleActionSuccess}
      />

      {/* Payout Modal */}
      <AdminWinnerPayoutModal
        isOpen={payoutWinner !== null}
        winner={payoutWinner}
        onClose={() => setPayoutWinner(null)}
        onSuccess={handleActionSuccess}
      />
    </>
  );
}
