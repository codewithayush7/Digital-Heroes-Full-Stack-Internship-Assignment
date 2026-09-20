import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";
import { ShieldCheck, LogOut, ArrowLeft, Users, Trophy, HeartHandshake, FileCheck } from "lucide-react";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Platform Operations & Management
          </h1>
          <p className="text-xs text-slate-400">
            Authenticated administrator: {user?.email}
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

      {/* Surface Overviews (Milestone preview) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Users className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">User Management</h2>
          <p className="text-xs text-slate-400">
            Manage subscribers, view activity, and update scores.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Trophy className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">Draw Engine</h2>
          <p className="text-xs text-slate-400">
            Configure monthly draws, simulate, and publish results.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">Charity Management</h2>
          <p className="text-xs text-slate-400">
            Add, update charities, events, and track donations.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <FileCheck className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">Winner Verification</h2>
          <p className="text-xs text-slate-400">
            Review score proof screenshots and track payouts.
          </p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-2">
        <h3 className="text-sm font-semibold text-emerald-400">
          Role Guard Active
        </h3>
        <p className="text-xs text-slate-400">
          This area is strictly restricted to users with <code>role: &apos;admin&apos;</code> verified through PostgreSQL RLS and server-side layout guards.
        </p>
      </div>
    </div>
  );
}
