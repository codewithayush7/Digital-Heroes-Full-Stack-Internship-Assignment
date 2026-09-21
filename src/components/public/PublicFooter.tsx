import Link from "next/link";
import { Sparkles, Heart, Trophy, ShieldCheck } from "lucide-react";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-[#060910] text-slate-400 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Brand & Mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-white">
              <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                <Sparkles className="h-4 w-4 fill-current" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white">
                Digital <span className="text-amber-400">Heroes</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Bridging athletic performance and philanthropy. Digital Heroes empowers golfers to transform regular course rounds into dedicated charitable funding and monthly prize opportunities.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
              <div className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-emerald-400" />
                <span>Verified Charities</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-amber-400" />
                <span>Algorithmic Draws</span>
              </div>
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-indigo-400" />
                <span>Secure Billing</span>
              </div>
            </div>
          </div>

          {/* Column 2: Platform Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#how-it-works" className="hover:text-amber-400 transition">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#draw-mechanics" className="hover:text-amber-400 transition">
                  Draw Mechanics
                </Link>
              </li>
              <li>
                <Link href="/#membership" className="hover:text-amber-400 transition">
                  Membership & Pricing
                </Link>
              </li>
              <li>
                <Link href="/charities" className="hover:text-emerald-400 transition">
                  Charity Directory
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Membership & Access */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Member Access
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="hover:text-white transition">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-amber-400 transition">
                  Join Platform
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition">
                  Member Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Platform Transparency Notice */}
        <div className="pt-6 border-t border-slate-800/80 text-[11px] text-slate-500 leading-relaxed space-y-2">
          <p>
            <strong className="text-slate-400 font-medium">Draw Participation Notice:</strong> Monthly prize draws are conducted algorithmically using 5 retained Stableford golf scores within the authoritative 1–45 score range. Prize pools are funded by participating memberships and allocated across 3 prize tiers (Tier 5: 40% with rollover jackpot, Tier 4: 35%, Tier 3: 25%). Members designate between 10% and 100% of their subscription contributions to vetted charitable partners.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-slate-500">
            <p>© {currentYear} Digital Heroes. All rights reserved.</p>
            <p className="text-slate-600">Golf Performance • Charitable Impact • Algorithm-Driven Draws</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
