import Link from "next/link";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 text-center bg-[#090D16]">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-400">
          <span>Digital Heroes Platform</span>
          <span className="text-slate-500">•</span>
          <span>Authentication Active</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-white">
          Give back. Play smart. <br />
          <span className="text-amber-400">Win together.</span>
        </h1>
        <p className="text-lg text-slate-400 leading-relaxed">
          A modern platform combining golf performance tracking, charitable
          fundraising, and algorithm-driven monthly prize draws.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-5 py-2.5 text-sm transition duration-150 shadow-lg shadow-amber-500/20"
          >
            <UserPlus className="h-4 w-4" />
            <span>Join Now</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-white font-medium px-5 py-2.5 text-sm transition duration-150"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium px-5 py-2.5 text-sm transition duration-150"
          >
            <span>Subscriber Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
