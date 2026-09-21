"use client";

import { useState } from "react";
import { createDonationCheckoutAction } from "@/app/actions/donation";
import { Heart, Sparkles, AlertCircle, Loader2 } from "lucide-react";

interface DirectDonationCardProps {
  charityId: string;
  charityName: string;
}

const PRESET_AMOUNTS = [50, 100, 250, 500];

export function DirectDonationCard({
  charityId,
  charityName,
}: DirectDonationCardProps) {
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetClick = (preset: number) => {
    setIsCustom(false);
    setAmount(preset);
    setCustomAmount("");
    setError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const finalAmount = isCustom ? parseFloat(customAmount) : amount;
    if (isNaN(finalAmount) || finalAmount < 50) {
      setError("Please enter a donation amount of at least ₹50.00.");
      return;
    }
    if (finalAmount > 50000) {
      setError("Maximum single donation is ₹50,000.00.");
      return;
    }

    setIsPending(true);
    const formData = new FormData();
    formData.append("charityId", charityId);
    formData.append("amount", finalAmount.toString());

    try {
      const res = await createDonationCheckoutAction(formData);
      if (res?.error) {
        setError(res.error);
        setIsPending(false);
      }
    } catch {
      // In Next.js, redirect() throws an internal redirect error which is normal
      setIsPending(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-emerald-500/30 bg-slate-900/60 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Heart className="h-4 w-4 fill-current" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Donate Directly to {charityName}
            </h3>
            <p className="text-[11px] text-slate-400">
              Independent gift • No platform subscription or draw entry required
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Direct Philanthropy
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Preset Amounts */}
        <div className="grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition border ${
                !isCustom && amount === preset
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-sm"
                  : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700"
              }`}
            >
              ₹{preset}
            </button>
          ))}
        </div>

        {/* Custom Amount Toggle & Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="customAmount"
              className="text-xs text-slate-400 font-medium"
            >
              Or enter custom amount (₹ INR)
            </label>
            {!isCustom ? (
              <button
                type="button"
                onClick={() => {
                  setIsCustom(true);
                  setCustomAmount(amount.toString());
                }}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Custom
              </button>
            ) : null}
          </div>

          {isCustom && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                ₹
              </span>
              <input
                id="customAmount"
                type="number"
                min="50"
                max="50000"
                step="1"
                placeholder="50"
                value={customAmount}
                onChange={handleCustomChange}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 pl-7 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          )}
        </div>

        {/* Action Button & Notice */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 leading-tight">
            100% of this contribution funds {charityName}. Processed securely via Stripe Checkout (guests and members).
          </p>

          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 fill-current" />
            )}
            <span>
              Donate ₹{isCustom ? customAmount || "0" : amount}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
