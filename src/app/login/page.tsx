"use client";

import { useActionState, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  loginAction,
  resendVerificationAction,
  type AuthActionResult,
} from "@/app/actions/auth";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const urlError = searchParams.get("error");
  const verified = searchParams.get("verified") === "true";

  const [email, setEmail] = useState("");
  const [resendPending, startResendTransition] = useTransition();
  const [resendResult, setResendResult] = useState<AuthActionResult | null>(null);

  const [state, formAction, isPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(loginAction, null);

  const isEmailNotConfirmed = Boolean(
    (state?.error && state.error.toLowerCase().includes("email not confirmed")) ||
      urlError === "email_not_confirmed"
  );

  const handleResend = () => {
    if (!email.trim()) {
      setResendResult({ error: "Please enter your email address first." });
      return;
    }
    setResendResult(null);
    startResendTransition(async () => {
      const fd = new FormData();
      fd.append("email", email.trim());
      const res = await resendVerificationAction(null, fd);
      setResendResult(res);
    });
  };

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

      {/* 1. Verified Success Banner */}
      {verified && !resendResult && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p>Your email has been verified. You can now sign in.</p>
        </div>
      )}

      {/* 2. Resend Success Banner */}
      {resendResult?.success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p>{resendResult.message}</p>
        </div>
      )}

      {/* 3. Resend Error Banner */}
      {resendResult?.error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <p>{resendResult.error}</p>
        </div>
      )}

      {/* 4. Email Not Confirmed Verification Required Banner */}
      {isEmailNotConfirmed && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">
                Email Verification Required
              </p>
              <p className="text-xs text-amber-300/90 mt-0.5">
                Please verify your email address before signing in.
              </p>
            </div>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendPending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-4 disabled:opacity-50 transition"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${resendPending ? "animate-spin" : ""}`}
              />
              <span>
                {resendPending
                  ? "Sending verification email..."
                  : "Resend verification email"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Generic / URL Error Banner */}
      {!isEmailNotConfirmed &&
        (state?.error || urlError) &&
        !resendResult?.success && (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            <div className="space-y-1">
              <p>
                {state?.error ||
                  (urlError === "verification_link_invalid"
                    ? "This verification link is invalid, expired, or has already been used. Please request a new verification email or sign in below."
                    : urlError === "unauthorized"
                    ? "Access denied. Administrator privileges required."
                    : "Authentication error. Please try again.")}
              </p>
              {urlError === "verification_link_invalid" && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendPending}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-4 mt-1 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${resendPending ? "animate-spin" : ""}`}
                  />
                  <span>
                    {resendPending
                      ? "Sending..."
                      : "Resend verification email"}
                  </span>
                </button>
              )}
            </div>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
