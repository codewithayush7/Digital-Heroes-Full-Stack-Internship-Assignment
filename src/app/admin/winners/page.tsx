import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DrawService, type WinnerFilters } from "@/lib/services/draw.service";
import { WinnerFilterBar } from "@/components/admin/winners/WinnerFilterBar";
import { AdminWinnerTable } from "@/components/admin/winners/AdminWinnerTable";
import {
  Trophy,
  ArrowLeft,
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
            Draw Winners & Payout Operations
          </h1>
          <p className="text-xs text-slate-400">
            Operations ledger of winning participants across published draws, verification review, and manual payout tracking.
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
      <AdminWinnerTable winners={winners} />
    </div>
  );
}
