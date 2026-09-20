import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScoreService } from "@/lib/services/score.service";
import { ScoreForm } from "@/components/dashboard/ScoreForm";
import { ScoreList } from "@/components/dashboard/ScoreList";
import { ArrowLeft } from "lucide-react";

export default async function ScoresPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/scores");
  }

  const { data: scores = [] } = await ScoreService.getUserScores(
    supabase,
    user.id
  );

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">
            Stableford Golf Scores
          </h1>
          <p className="text-xs text-slate-400">
            Enter your recent Stableford scores (1–45). Only the 5 most recent scores by date are retained.
          </p>
        </div>

        <ScoreForm currentCount={scores.length} />
        <ScoreList scores={scores} />
      </div>
    </div>
  );
}
