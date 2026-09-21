import Link from "next/link";
import { Check, Sparkles, ShieldCheck, ArrowRight, Heart } from "lucide-react";

export function PricingCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {/* Monthly Plan */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 flex flex-col justify-between glow-card relative">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              Monthly Plan
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white">Monthly Membership</h3>
            <p className="text-xs text-slate-400 mt-1">
              Flexible month-to-month subscription with full draw qualification.
            </p>
          </div>

          <ul className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Qualify for monthly algorithm-driven prize draws (Tiers 5, 4, 3)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Log golf rounds and retain up to 5 rolling Stableford scores (1–45)</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Heart className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Designate 10%–100% of your contributions to a vetted charity</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Complete member dashboard with draw history and score snapshots</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Manage or cancel anytime through secure billing portal</span>
            </li>
          </ul>
        </div>

        <div className="pt-8 mt-6 border-t border-slate-800/80">
          <Link
            href="/signup?plan=monthly"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-white font-semibold px-5 py-3 text-sm transition"
          >
            <span>Get Started Monthly</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Annual Plan */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border-2 border-amber-500/40 bg-slate-900/40 flex flex-col justify-between glow-card relative shadow-2xl shadow-amber-500/5">
        <div className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 px-3.5 py-1 text-[11px] font-extrabold shadow-lg">
          <Sparkles className="h-3 w-3 fill-current" />
          <span>Save with Discount</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              Annual Membership
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white">Annual Membership</h3>
            <p className="text-xs text-slate-400 mt-1">
              Year-round participation with discounted annual billing rate.
            </p>
          </div>

          <ul className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Full year-round qualification across 12 monthly draws</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Discounted yearly membership rate</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Heart className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Continuous sustained funding for your designated charity</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Retain top 5 rolling Stableford golf scores all season</span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>Priority winner review & automated monthly participation</span>
            </li>
          </ul>
        </div>

        <div className="pt-8 mt-6 border-t border-slate-800/80">
          <Link
            href="/signup?plan=yearly"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-3 text-sm transition shadow-lg shadow-amber-500/20"
          >
            <span>Join with Annual</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
