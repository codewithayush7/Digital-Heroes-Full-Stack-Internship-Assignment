import { notFound } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CharityService } from "@/lib/services/charity.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ExternalLink,
  Sparkles,
  Heart,
  Trophy,
} from "lucide-react";

export default async function CharityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const result = await CharityService.getCharityBySlug(supabase, slug);

  if (!result.data || result.error) {
    notFound();
  }

  const { charity, events } = result.data;

  // Check if current user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation */}
        <div>
          <Link
            href="/charities"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Charities</span>
          </Link>
        </div>

        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="relative h-64 sm:h-80 w-full bg-slate-950">
            {charity.cover_image_url && (
              <img
                src={charity.cover_image_url}
                alt={charity.name}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

            {charity.is_featured && (
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 text-slate-950 px-3.5 py-1 text-xs font-bold shadow-lg">
                <Sparkles className="h-3.5 w-3.5 fill-current" />
                <span>Featured Partner</span>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 relative -mt-16 sm:-mt-20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                {charity.logo_url && (
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border-2 border-slate-800 bg-slate-900 shadow-xl shrink-0">
                    <img
                      src={charity.logo_url}
                      alt={`${charity.name} logo`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {charity.name}
                  </h1>
                  {charity.tagline && (
                    <p className="text-sm text-emerald-400 font-medium">
                      {charity.tagline}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                <Link
                  href={user ? "/dashboard" : "/signup"}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 text-xs shadow-lg shadow-emerald-500/20 transition"
                >
                  <Heart className="h-4 w-4 fill-current" />
                  <span>{user ? "Select in Dashboard" : "Support on Signup"}</span>
                </Link>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
              <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-0.5">
                <span className="text-[11px] uppercase font-semibold text-slate-400">
                  Total Platform Giving
                </span>
                <div className="text-xl font-bold text-emerald-400">
                  {formatCurrency(Number(charity.total_funds_raised))}
                </div>
              </div>

              {charity.website_url && (
                <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-slate-400 block">
                      Official Website
                    </span>
                    <span className="text-xs text-slate-200 truncate block max-w-[200px]">
                      {charity.website_url.replace(/^https?:\/\//, "")}
                    </span>
                  </div>
                  <a
                    href={charity.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                  >
                    <span>Visit</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mission & About */}
        <section className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-3">
          <h2 className="text-lg font-bold text-white">About the Cause</h2>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {charity.description}
          </p>
        </section>

        {/* Upcoming Events / Golf Days */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">
              Upcoming Events & Golf Days
            </h2>
          </div>

          {events.length === 0 ? (
            <div className="glass-panel rounded-xl p-6 text-center border border-slate-800 text-xs text-slate-400">
              No upcoming events scheduled at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="glass-panel rounded-xl p-5 border border-slate-800 space-y-3"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {event.event_type.replace("_", " ")}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">
                      {event.title}
                    </h3>
                  </div>

                  {event.description && (
                    <p className="text-xs text-slate-400 line-clamp-3">
                      {event.description}
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-800/60 space-y-1 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-500" />
                      <span>{formatDate(event.event_date)}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
