/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Heart, ImageIcon } from "lucide-react";

export function CharityCoverImage({
  src,
  alt,
  className = "w-full h-full object-cover",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-slate-600 select-none">
        <Heart className="h-10 w-10 text-slate-700/60 mb-1" />
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Digital Heroes Partner
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

export function CharityLogoImage({
  src,
  name,
  className = "h-full w-full object-cover",
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    const initial = name?.trim()?.charAt(0)?.toUpperCase() || "H";
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900 text-emerald-400 font-extrabold text-lg select-none">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

export function CharityGalleryImage({
  src,
  alt,
  className = "w-full h-full object-cover",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-600 select-none">
        <ImageIcon className="h-8 w-8 text-slate-700 mb-1" />
        <span className="text-[10px] text-slate-500 font-medium">Impact Photo</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
