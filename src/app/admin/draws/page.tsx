import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DrawService, type Draw } from "@/lib/services/draw.service";
import {
  Trophy,
  Plus,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Shield,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface AdminDrawsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminDrawsPage({ searchParams }: AdminDrawsPageProps) {
  const { status } = await searchParams;
  const supabase = await createClient();

  const [drawsResult, rolloverResult] = await Promise.all([
    DrawService.listDraws(supabase, {
      status: (status as Draw["status"]) || undefined,
    }),
    DrawService.getAuthoritativeRolloverJackpot(supabase),
  ]);

  const allDrawsRes = status ? await DrawService.listDraws(supabase) : drawsResult;
  const allDraws = allDrawsRes.data ?? [];
  const displayedDraws = drawsResult.data ?? [];
  const authoritativeRollover = rolloverResult.data ?? 0;

  const draftCount = allDraws.filter((d) => d.status === "draft").length;
  const simulatedCount = allDraws.filter((d) => d.status === "simulated").length;
  const publishedCount = allDraws.filter((d) => d.status === "published").length;

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
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <Trophy className="h-3 w-3" />
              Draw Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Monthly Prize Draws
          </h1>
          <p className="text-xs text-slate-400">
            Configure monthly draws, simulate weighted score selections, and authoritatively publish winners.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/draws/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition duration-150 shadow-md shadow-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Draw</span>
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Authoritative Rollover */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Authoritative Rollover</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ₹{authoritativeRollover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500">
            Carries forward to next published draw
          </p>
        </div>

        {/* Drafts Count */}
        <Link
          href="/admin/draws?status=draft"
          className={`glass-panel p-5 rounded-xl border transition space-y-1 block ${
            status === "draft"
              ? "border-slate-500 bg-slate-800/60"
              : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Drafts</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-200 font-mono">
            {draftCount}
          </div>
          <p className="text-[11px] text-slate-500">
            Configured draws awaiting simulation
          </p>
        </Link>

        {/* Simulated Count */}
        <Link
          href="/admin/draws?status=simulated"
          className={`glass-panel p-5 rounded-xl border transition space-y-1 block ${
            status === "simulated"
              ? "border-amber-500/50 bg-amber-500/10"
              : "border-slate-800 hover:border-amber-500/30"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Simulated</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {simulatedCount}
          </div>
          <p className="text-[11px] text-slate-500">
            Snapshots ready for review or publishing
          </p>
        </Link>

        {/* Published Count */}
        <Link
          href="/admin/draws?status=published"
          className={`glass-panel p-5 rounded-xl border transition space-y-1 block ${
            status === "published"
              ? "border-emerald-500/50 bg-emerald-500/10"
              : "border-slate-800 hover:border-emerald-500/30"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Published</span>
            <Shield className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {publishedCount}
          </div>
          <p className="text-[11px] text-slate-500">
            Authoritative, completed draw records
          </p>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs">
        <span className="text-slate-400 font-medium mr-2">Filter status:</span>
        <Link
          href="/admin/draws"
          className={`px-3 py-1.5 rounded-lg transition font-medium ${
            !status
              ? "bg-slate-800 text-white border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-white"
          }`}
        >
          All ({allDraws.length})
        </Link>
        <Link
          href="/admin/draws?status=draft"
          className={`px-3 py-1.5 rounded-lg transition font-medium ${
            status === "draft"
              ? "bg-slate-800 text-white border border-slate-700 font-semibold"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Drafts ({draftCount})
        </Link>
        <Link
          href="/admin/draws?status=simulated"
          className={`px-3 py-1.5 rounded-lg transition font-medium ${
            status === "simulated"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
              : "text-slate-400 hover:text-amber-400"
          }`}
        >
          Simulated ({simulatedCount})
        </Link>
        <Link
          href="/admin/draws?status=published"
          className={`px-3 py-1.5 rounded-lg transition font-medium ${
            status === "published"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold"
              : "text-slate-400 hover:text-emerald-400"
          }`}
        >
          Published ({publishedCount})
        </Link>
      </div>

      {/* Draws List */}
      <div className="space-y-4">
        {displayedDraws.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No Draws Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {status
                  ? `There are no draws with status '${status}'.`
                  : "No draws have been configured yet. Create your first monthly draw to get started."}
              </p>
            </div>
            {!status && (
              <Link
                href="/admin/draws/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Draw</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Draw Title & Date</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Total Prize Pool</th>
                    <th className="py-3 px-4">Rollover Out</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {displayedDraws.map((draw) => {
                    const drawDateFormatted = new Date(draw.draw_date).toLocaleDateString(
                      "en-IN",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    );

                    return (
                      <tr
                        key={draw.id}
                        className="hover:bg-slate-800/30 transition group"
                      >
                        <td className="py-4 px-4 space-y-0.5">
                          <Link
                            href={`/admin/draws/${draw.id}`}
                            className="font-bold text-sm text-white group-hover:text-amber-400 transition flex items-center gap-1.5"
                          >
                            <span>{draw.title}</span>
                          </Link>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <Calendar className="h-3 w-3" />
                            <span>{drawDateFormatted}</span>
                            <span className="text-slate-600">•</span>
                            <span className="capitalize">{draw.cadence}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
                            <span className="capitalize">{draw.draw_mode}</span>
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              draw.status === "published"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : draw.status === "simulated"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            <span className="capitalize">{draw.status}</span>
                          </span>
                        </td>

                        <td className="py-4 px-4 font-mono font-medium text-slate-200">
                          {draw.status === "draft" ? (
                            <span className="text-slate-500 italic">Pending Simulation</span>
                          ) : (
                            `₹${Number(draw.total_prize_pool).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}`
                          )}
                        </td>

                        <td className="py-4 px-4 font-mono font-medium">
                          {draw.status === "draft" ? (
                            <span className="text-slate-500">—</span>
                          ) : draw.jackpot_rolled_over ? (
                            <span className="text-amber-400">
                              ₹{Number(draw.rollover_jackpot_out).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            <span className="text-emerald-400">₹0.00 (Jackpot Won)</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <Link
                            href={`/admin/draws/${draw.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-200 group-hover:border-amber-500/40 group-hover:text-amber-300 transition"
                          >
                            <span>Manage</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
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
