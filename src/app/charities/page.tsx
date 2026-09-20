import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CharityService } from "@/lib/services/charity.service";
import { CharityCard } from "@/components/charity/CharityCard";
import { CharityFilter } from "@/components/charity/CharityFilter";
import { Heart, ArrowLeft } from "lucide-react";

export default async function CharitiesDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; featured?: string }>;
}) {
  const { search, featured } = await searchParams;
  const supabase = await createClient();

  const { data: charities = [] } = await CharityService.getCharities(supabase, {
    search,
    featuredOnly: featured === "true",
  });

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <header className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Overview</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
                <Heart className="h-3.5 w-3.5 fill-current" />
                <span>Our Charitable Partners</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Charity Directory
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                Every subscription actively supports a vetted non-profit. Explore our partners, their upcoming golf days, and direct your impact.
              </p>
            </div>

            <div className="w-full md:w-80">
              <Suspense fallback={<div className="h-10 bg-slate-900 rounded-xl" />}>
                <CharityFilter />
              </Suspense>
            </div>
          </div>
        </header>

        {/* Charity Cards Grid */}
        {charities.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 space-y-3">
            <Heart className="h-10 w-10 mx-auto text-slate-600" />
            <h3 className="text-base font-semibold text-white">
              No charities found
            </h3>
            <p className="text-xs text-slate-400">
              Try adjusting your search criteria or clearing filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {charities.map((charity) => (
              <CharityCard key={charity.id} charity={charity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
