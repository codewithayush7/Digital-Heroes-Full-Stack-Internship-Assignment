import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminService } from "@/lib/services/admin.service";
import { signOutAction } from "@/app/actions/auth";
import { formatCurrency } from "@/lib/utils";
import {
  ShieldCheck,
  LogOut,
  ArrowLeft,
  Users,
  Trophy,
  HeartHandshake,
  FileCheck,
  Sparkles,
  Coins,
  TrendingUp,
} from "lucide-react";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminClient = createAdminClient();
  const kpiRes = await AdminService.getPlatformKpis(adminClient);
  const kpis = kpiRes.data ?? {
    totalUsers: 0,
    activeSubscribers: 0,
    totalPrizePool: 0,
    currentRolloverJackpot: 0,
    totalCharityFunds: 0,
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Portal
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">
              {user?.email}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Platform Operations & Intelligence
          </h1>
          <p className="text-xs text-slate-400">
            Real-time platform ledger, algorithmic draws, partner charities, and winner payouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-300 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </header>

      {/* Real-time KPI Metric Cards */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-400" />
          <h2 className="text-xs uppercase tracking-wider font-bold text-slate-300">
            Live Platform Metrics
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Registered Users */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Users
              </span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                <Users className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">
              {kpis.totalUsers}
            </div>
            <p className="text-[11px] text-slate-400">Registered member profiles</p>
          </div>

          {/* Active Subscribers */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active Subs
              </span>
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">
              {kpis.activeSubscribers}
            </div>
            <p className="text-[11px] text-slate-400">Qualifying active subscribers</p>
          </div>

          {/* Total Prize Pool */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Prize Pool Sum
              </span>
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Coins className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-amber-400">
              {formatCurrency(kpis.totalPrizePool)}
            </div>
            <p className="text-[11px] text-slate-400">Published draws total</p>
          </div>

          {/* Current Rollover Jackpot */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Current Rollover
              </span>
              <div className="h-7 w-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-purple-400">
              {formatCurrency(kpis.currentRolloverJackpot)}
            </div>
            <p className="text-[11px] text-slate-400">Active jackpot rollover</p>
          </div>

          {/* Total Charity Funds Raised */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Charity Raised
              </span>
              <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <HeartHandshake className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-rose-400">
              {formatCurrency(kpis.totalCharityFunds)}
            </div>
            <p className="text-[11px] text-slate-400">Cumulative partner giving</p>
          </div>
        </div>
      </section>

      {/* Operational Modules Navigation */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-300">
          Management Modules
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* User Management */}
          <Link
            href="/admin/users"
            className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2 hover:border-blue-500/40 hover:bg-slate-800/40 transition group block"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-105 transition">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-blue-400 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                Open Directory &rarr;
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition">
              User Directory
            </h3>
            <p className="text-xs text-slate-400">
              Subscribers, profile adjustments, score overrides.
            </p>
          </Link>

          {/* Draw Engine */}
          <Link
            href="/admin/draws"
            className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2 hover:border-amber-500/40 hover:bg-slate-800/40 transition group block"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition">
                <Trophy className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-amber-400 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                Open Engine &rarr;
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition">
              Draw Engine
            </h3>
            <p className="text-xs text-slate-400">
              Configure monthly draws, simulate, and publish results.
            </p>
          </Link>

          {/* Charity Management */}
          <Link
            href="/admin/charities"
            className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2 hover:border-emerald-500/40 hover:bg-slate-800/40 transition group block"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition">
                <HeartHandshake className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                Open Directory &rarr;
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition">
              Charity Management
            </h3>
            <p className="text-xs text-slate-400">
              Onboard non-profits, edit branding, toggle featured spotlights.
            </p>
          </Link>

          {/* Winner Verification */}
          <Link
            href="/admin/winners"
            className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2 hover:border-purple-500/40 hover:bg-slate-800/40 transition group block"
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition">
                <FileCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-purple-400 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                View Ledger &rarr;
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition">
              Winner Verification
            </h3>
            <p className="text-xs text-slate-400">
              Review score proof screenshots and track manual payouts.
            </p>
          </Link>
        </div>
      </section>

      {/* Security Guard Notice */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
        <p>
          <strong>Access Governance:</strong> Administrative operations enforce server-side layout guards, authenticated session verification, and PostgreSQL role validation (<code>role: &apos;admin&apos;</code>).
        </p>
      </div>
    </div>
  );
}
