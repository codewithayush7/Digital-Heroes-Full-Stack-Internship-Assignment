"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { useTransition } from "react";

export function CharityFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") || "";
  const isFeaturedOnly = searchParams.get("featured") === "true";

  const updateFilters = (newSearch?: string, newFeatured?: boolean) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newSearch !== undefined) {
      if (newSearch.trim()) {
        params.set("search", newSearch.trim());
      } else {
        params.delete("search");
      }
    }

    if (newFeatured !== undefined) {
      if (newFeatured) {
        params.set("featured", "true");
      } else {
        params.delete("featured");
      }
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-3 w-full transition-opacity ${isPending ? "opacity-75" : "opacity-100"}`}>
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          defaultValue={currentSearch}
          placeholder="Search causes by name or mission..."
          onChange={(e) => updateFilters(e.target.value, undefined)}
          className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
        />
      </div>

      <button
        type="button"
        onClick={() => updateFilters(undefined, !isFeaturedOnly)}
        className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border transition shrink-0 ${
          isFeaturedOnly
            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
            : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Featured Only</span>
      </button>
    </div>
  );
}
