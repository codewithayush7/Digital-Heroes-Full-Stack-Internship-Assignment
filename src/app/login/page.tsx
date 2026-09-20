"use client";

import { useActionState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, type AuthActionResult } from "@/app/actions/auth";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const urlError = searchParams.get("error");

  const [state, formAction, isPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(loginAction, null);

  return (
    <div className="w-full max-w-md space-y-8 glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 mb-2 border border-amber-500/20">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Welcome back
        </h1>
        <p className="text-sm text-slate-400">
          Sign in to manage your scores, view draws, and support your charity.
        </p>
      </div>

      {/* Global Error Banner */}
      {(state?.error || urlError) && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <p>
            {state?.error ||
              (urlError === "unauthorized"
                ? "Access denied. Administrator privileges required."
                : "Authentication error. Please try again.")}
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={next} />

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-300 uppercase tracking-wider"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-slate-300 uppercase tracking-wider"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-2.5 px-4 text-sm transition duration-150 disabled:opacity-50 shadow-lg shadow-amber-500/20"
        >
          {isPending ? (
            <span>Signing in...</span>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="border-t border-slate-800/80 pt-6 text-center text-xs text-slate-400">
        Don&apos;t have an account yet?{" "}
        <Link
          href="/signup"
          className="font-medium text-amber-400 hover:text-amber-300 transition underline underline-offset-4"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 text-center text-slate-400 glass-panel rounded-2xl border border-slate-800">
            Loading...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
