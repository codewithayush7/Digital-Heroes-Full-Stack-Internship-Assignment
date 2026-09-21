"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Menu, X, ArrowRight, LogIn, Heart } from "lucide-react";

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#090D16]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white hover:opacity-90 transition group"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 fill-current" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight leading-none text-white">
              Digital <span className="text-amber-400">Heroes</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase mt-0.5">
              Golf & Giving
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link
            href="/#how-it-works"
            className="hover:text-amber-400 transition"
          >
            How It Works
          </Link>
          <Link
            href="/#draw-mechanics"
            className="hover:text-amber-400 transition"
          >
            Draw Mechanics
          </Link>
          <Link
            href="/charities"
            className="hover:text-emerald-400 transition flex items-center gap-1.5"
          >
            <Heart className="h-3.5 w-3.5 text-emerald-400 fill-current" />
            <span>Charities</span>
          </Link>
          <Link
            href="/#membership"
            className="hover:text-amber-400 transition"
          >
            Membership
          </Link>
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 transition"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 px-4 py-2 rounded-lg transition shadow-md shadow-amber-500/20"
          >
            <span>Join Now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-[#090D16]/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-3">
          <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-300">
            <Link
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-amber-400 transition"
            >
              How It Works
            </Link>
            <Link
              href="/#draw-mechanics"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-amber-400 transition"
            >
              Draw Mechanics
            </Link>
            <Link
              href="/charities"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-emerald-400 transition flex items-center gap-2"
            >
              <Heart className="h-4 w-4 text-emerald-400 fill-current" />
              <span>Charities</span>
            </Link>
            <Link
              href="/#membership"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-amber-400 transition"
            >
              Membership
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 transition"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 px-4 py-2.5 rounded-lg transition shadow-md shadow-amber-500/20"
            >
              <span>Join Now</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
