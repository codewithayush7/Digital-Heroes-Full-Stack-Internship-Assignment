import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";
import { ArrowLeft, LogOut, Heart, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ProfilePage() {
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>

        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-xl">
              {(profile?.full_name?.[0] || user.email?.[0] || "U").toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {profile?.full_name || "Subscriber Profile"}
              </h1>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>

          <div className="divide-y divide-slate-800/80 text-sm">
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-400 text-xs">User ID</span>
              <span className="font-mono text-xs text-slate-300">{user.id}</span>
            </div>

            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-400 text-xs">Role</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  profile?.role === "admin"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                }`}
              >
                {profile?.role || "subscriber"}
              </span>
            </div>

            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-400 text-xs">Charity Giving %</span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Heart className="h-4 w-4" />
                <span>{profile?.charity_contribution_pct ?? 10}%</span>
              </div>
            </div>

            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-400 text-xs">Member Since</span>
              <div className="flex items-center gap-1.5 text-slate-300 text-xs">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {profile?.created_at
                    ? formatDate(profile.created_at)
                    : "Recently"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/40 border border-slate-800 p-3.5 text-xs text-slate-400">
            <p>
              <strong>Security Policy:</strong> In accordance with Digital Heroes security rules, role permissions are locked to prevent client-side privilege escalation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
