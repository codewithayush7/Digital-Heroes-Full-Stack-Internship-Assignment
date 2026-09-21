import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DrawService, type WinnerFilters } from "@/lib/services/draw.service";
import { WinnerFilterBar } from "@/components/admin/winners/WinnerFilterBar";
import {
  Trophy,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  CreditCard,
  FileCheck,
  ExternalLink,
  Coins,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface AdminWinnersPageProps {
  searchParams: Promise<{
    drawId?: string;
    tier?: string;
    verificationStatus?: string;
    paymentStatus?: string;
  }>;
}

export default async function AdminWinnersPage({
  searchParams,
}: AdminWinnersPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const filters: WinnerFilters = {
    drawId: params.drawId || undefined,
    tier: (params.tier as WinnerFilters["tier"]) || undefined,
    verificationStatus:
      (params.verificationStatus as WinnerFilters["verificationStatus"]) ||
      undefined,
    paymentStatus:
      (params.paymentStatus as WinnerFilters["paymentStatus"]) || undefined,
  };

  const [winnersResult, publishedDrawsResult] = await Promise.all([
    DrawService.listWinners(supabase, filters),
    DrawService.listDraws(supabase, { status: "published" }),
  ]);

  const winners = winnersResult.data ?? [];
  const publishedDraws = publishedDrawsResult.data ?? [];

  const totalPrizeDistributed = winners.reduce(
    (sum, w) => sum + Number(w.prize_amount),
    0
  );

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Admin Portal</span>
            </Link>
            <span className="text-slate-600">/</span>
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              <Trophy className="h-3 w-3" />
              Winners Ledger
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Draw Winners & Payout Verification
          </h1>
          <p className="text-xs text-slate-400">
            Read-only ledger of winning participants across published draws, verification status, and payment tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-panel px-4 py-2 rounded-xl border border-slate-800 space-y-0.5 text-right">
            <span className="text-[11px] text-slate-400 font-medium flex items-center justify-end gap-1">
              <Coins className="h-3 w-3 text-amber-400" />
              <span>Total Displayed Prizes</span>
            </span>
            <div className="text-base font-bold font-mono text-emerald-400">
              ₹{totalPrizeDistributed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <WinnerFilterBar
        draws={publishedDraws.map((d) => ({ id: d.id, title: d.title }))}
        selectedDrawId={params.drawId}
        selectedTier={params.tier}
        selectedVerificationStatus={params.verificationStatus}
        selectedPaymentStatus={params.paymentStatus}
      />

      {/* Winners Ledger Table */}
      <div className="space-y-4">
        {winners.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
              <FileCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No Winners Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {params.drawId || params.tier || params.verificationStatus || params.paymentStatus
                  ? "No winners match the selected filter criteria."
                  : "No winners have been registered yet. Winner records are generated upon publishing a draw."}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Winner</th>
                    <th className="py-3 px-4">Draw</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Prize Amount</th>
                    <th className="py-3 px-4">Verification Status</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Score Proof</th>
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

                    return (
                      <tr
                        key={winner.id}
                        className="hover:bg-slate-800/30 transition group"
                      >
                        {/* Winner Name & Email */}
                        <td className="py-3.5 px-4 space-y-0.5">
                          <div className="font-bold text-sm text-white">
                            {winner.profile?.full_name || "Anonymous Golfer"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {winner.profile?.email || winner.user_id.slice(0, 8) + "..."}
                          </div>
                        </td>

                        {/* Draw Info */}
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
                            <span className="text-slate-500 font-mono">{winner.draw_id.slice(0, 8)}...</span>
                          )}
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Calendar className="h-3 w-3" />
                            <span>{drawDateFormatted}</span>
                          </div>
                        </td>

                        {/* Tier */}
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
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              winner.verification_status === "approved"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : winner.verification_status === "rejected"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : winner.verification_status === "pending_review"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            <span className="capitalize">{winner.verification_status.replace("_", " ")}</span>
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              winner.payment_status === "paid"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            <CreditCard className="h-3 w-3" />
                            <span className="capitalize">{winner.payment_status}</span>
                          </span>
                        </td>

                        {/* Proof Submission */}
                        <td className="py-3.5 px-4 text-[11px]">
                          {winner.proof_image_url ? (
                            <a
                              href={winner.proof_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 underline underline-offset-2"
                            >
                              <span>View Image</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-slate-500 italic">
                              Awaiting upload
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
