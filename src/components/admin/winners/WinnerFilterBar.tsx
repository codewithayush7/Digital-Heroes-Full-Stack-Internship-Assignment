"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, RotateCcw } from "lucide-react";

interface WinnerFilterBarProps {
  draws: Array<{ id: string; title: string }>;
  selectedDrawId?: string;
  selectedTier?: string;
  selectedVerificationStatus?: string;
  selectedPaymentStatus?: string;
}

export function WinnerFilterBar({
  draws,
  selectedDrawId = "",
  selectedTier = "",
  selectedVerificationStatus = "",
  selectedPaymentStatus = "",
}: WinnerFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = Boolean(
    selectedDrawId ||
      selectedTier ||
      selectedVerificationStatus ||
      selectedPaymentStatus
  );

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5 text-amber-400" />
          <span>Filter Winners Ledger</span>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-400 font-medium transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Draw Filter */}
        <div className="space-y-1">
          <label htmlFor="filter-draw" className="block text-[11px] font-medium text-slate-400">
            Draw
          </label>
          <select
            id="filter-draw"
            value={selectedDrawId}
            onChange={(e) => updateParam("drawId", e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          >
            <option value="">All Published Draws</option>
            {draws.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Tier Filter */}
        <div className="space-y-1">
          <label htmlFor="filter-tier" className="block text-[11px] font-medium text-slate-400">
            Winning Tier
          </label>
          <select
            id="filter-tier"
            value={selectedTier}
            onChange={(e) => updateParam("tier", e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          >
            <option value="">All Tiers</option>
            <option value="tier_5">Tier 5 (5 Matches · Jackpot)</option>
            <option value="tier_4">Tier 4 (4 Matches)</option>
            <option value="tier_3">Tier 3 (3 Matches)</option>
          </select>
        </div>

        {/* Verification Status */}
        <div className="space-y-1">
          <label htmlFor="filter-verification" className="block text-[11px] font-medium text-slate-400">
            Verification Status
          </label>
          <select
            id="filter-verification"
            value={selectedVerificationStatus}
            onChange={(e) => updateParam("verificationStatus", e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          >
            <option value="">All Verification States</option>
            <option value="pending_submission">Pending Submission</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Payment Status */}
        <div className="space-y-1">
          <label htmlFor="filter-payment" className="block text-[11px] font-medium text-slate-400">
            Payment Status
          </label>
          <select
            id="filter-payment"
            value={selectedPaymentStatus}
            onChange={(e) => updateParam("paymentStatus", e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
          >
            <option value="">All Payment States</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
    </div>
  );
}
