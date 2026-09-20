import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";
import { LogOut, User, Shield, Heart, ArrowRight, AlertTriangle } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation / Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
              Digital Heroes Dashboard
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Welcome, {profile?.full_name || user.email}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-200 transition"
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-400 transition"
              >
                <Shield className="h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            )}
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

        {/* Unauthorized Notification Banner */}
        {error === "unauthorized" && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h4 className="font-semibold text-amber-200">Access Restricted</h4>
              <p className="text-xs text-amber-300/90 mt-0.5">
                Your account has subscriber permissions. Administrator privileges are required to access the admin portal.
              </p>
            </div>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-medium text-slate-400">Account Role</span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  profile?.role === "admin"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                }`}
              >
                {profile?.role || "subscriber"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Role is strictly server-verified via Supabase PostgreSQL.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-medium text-slate-400">Charity Contribution</span>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-emerald-400" />
              <span className="text-lg font-bold text-white">
                {profile?.charity_contribution_pct ?? 10}%
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Minimum 10% directed to charity.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-medium text-slate-400">Authentication</span>
            <div className="text-xs text-slate-300 truncate">
              {user.email}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Active Session Verified
            </div>
          </div>
        </div>

        {/* Milestone 1B Confirmation Notice */}
        <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-3">
          <h2 className="text-base font-semibold text-white">
            Milestone 1B Verification Surface
          </h2>
          <p className="text-sm text-slate-400">
            Authentication, session persistence, and server-side profile retrieval are functional.
            In Milestone 1C, golf score management (1–45 range and 5-score rolling logic) will be integrated here.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition"
            >
              <span>View Full Profile Information</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
