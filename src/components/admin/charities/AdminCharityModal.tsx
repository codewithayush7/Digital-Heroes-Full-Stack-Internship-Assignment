"use client";

import { useState, useTransition } from "react";
import { X, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import type { Tables } from "@/types/database.types";
import {
  createCharityAction,
  updateCharityAction,
  type CharityActionResult,
} from "@/app/actions/charity";

export type Charity = Tables<"charities">;

interface AdminCharityModalProps {
  isOpen: boolean;
  onClose: () => void;
  charity?: Charity | null; // If present, edit mode; if null/undefined, create mode
}

export function AdminCharityModal({
  isOpen,
  onClose,
  charity,
}: AdminCharityModalProps) {
  const isEdit = Boolean(charity);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(charity?.name ?? "");
  const [slug, setSlug] = useState(charity?.slug ?? "");
  const [tagline, setTagline] = useState(charity?.tagline ?? "");
  const [description, setDescription] = useState(charity?.description ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(charity?.website_url ?? "");
  const [logoUrl, setLogoUrl] = useState(charity?.logo_url ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(charity?.cover_image_url ?? "");
  const [isFeatured, setIsFeatured] = useState(charity?.is_featured ?? false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateSlug = () => {
    const generated = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setSlug(generated);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const formData = new FormData();
    if (isEdit && charity) {
      formData.set("id", charity.id);
    }
    formData.set("name", name);
    formData.set("slug", slug);
    formData.set("tagline", tagline);
    formData.set("description", description);
    formData.set("websiteUrl", websiteUrl);
    formData.set("logoUrl", logoUrl);
    formData.set("coverImageUrl", coverImageUrl);
    formData.set("isFeatured", isFeatured ? "true" : "false");

    startTransition(async () => {
      const res: CharityActionResult = isEdit
        ? await updateCharityAction(null, formData)
        : await createCharityAction(null, formData);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
              {isEdit ? "Update Partner" : "New Onboarding"}
            </span>
            <h2 className="text-xl font-bold text-white">
              {isEdit ? `Edit '${charity?.name}'` : "Add Partner Charity"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Charity Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tee Off for Youth"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 block">
                  URL Slug *
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSlug}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Generate from Name</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                placeholder="e.g. tee-off-youth"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-500">
                URL identifier: /charities/{slug || "slug-preview"}
              </p>
            </div>

            {/* Tagline */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Empowering underprivileged juniors through golf"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Mission Description *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about the non-profit mission, programs, and impact..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Website URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Official Website
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://examplecharity.org"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Logo Image URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Logo URL
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://.../logo.png"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Cover Image URL */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Cover Image URL
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://.../cover-banner.jpg"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Is Featured */}
            <div className="space-y-1.5 sm:col-span-2 pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm font-medium text-slate-200">
                  Feature this partner on directory and homepage spotlight
                </span>
              </label>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isEdit ? "Save Changes" : "Create Partner"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
