import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DrawService } from "@/lib/services/draw.service";
import { DrawCreateForm } from "@/components/admin/draws/DrawCreateForm";
import { ArrowLeft, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewDrawPage() {
  const supabase = await createClient();
  const rolloverRes = await DrawService.getAuthoritativeRolloverJackpot(supabase);
  const currentRollover = rolloverRes.data ?? 0;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <Link
          href="/admin/draws"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Draws</span>
        </Link>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <Sparkles className="h-3 w-3" />
              Configure Draw
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Create Monthly Draw Draft
          </h1>
          <p className="text-xs text-slate-400">
            Configure the draw schedule and selection algorithm. Once created, you will be able to run simulations and review participant matches.
          </p>
        </div>
      </header>

      {/* Creation Form */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
        <DrawCreateForm currentRollover={currentRollover} />
      </div>
    </div>
  );
}
