import Link from "next/link";
import type { Charity } from "@/lib/services/charity.service";
import { formatCurrency } from "@/lib/utils";
import { Sparkles, ArrowRight } from "lucide-react";
import { CharityCoverImage, CharityLogoImage } from "./CharityImage";

export function CharityCard({ charity }: { charity: Charity }) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 flex flex-col glow-charity transition-all duration-200">
      {/* Cover Image & Featured Badge */}
      <div className="relative h-44 w-full bg-slate-900">
        <CharityCoverImage
          src={charity.cover_image_url}
          alt={charity.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />

        {charity.is_featured && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 text-slate-950 px-3 py-1 text-xs font-bold shadow-lg backdrop-blur-md z-10">
            <Sparkles className="h-3 w-3 fill-current" />
            <span>Featured Cause</span>
          </div>
        )}

        {charity.logo_url && (
          <div className="absolute bottom-3 left-4 h-12 w-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-md z-10">
            <CharityLogoImage
              src={charity.logo_url}
              name={charity.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
            {charity.name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {charity.tagline || charity.description}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">
              Funds Raised
            </span>
            <span className="text-sm font-bold text-emerald-400">
              {formatCurrency(Number(charity.total_funds_raised))}
            </span>
          </div>

          <Link
            href={`/charities/${charity.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-medium transition"
          >
            <span>Details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
