"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction, type AuthActionResult } from "@/app/actions/auth";
import type { Charity } from "@/lib/services/charity.service";
import { AlertCircle, CheckCircle2, ArrowRight, Heart, Check, Circle, Mail } from "lucide-react";
import {
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "@/lib/config/constants";

interface SignupFormProps {
  charities: Charity[];
  preSelectedCharityId: string | null;
  preSelectedPlan: string | null;
}

export function SignupForm({
  charities,
  preSelectedCharityId,
  preSelectedPlan,
}: SignupFormProps) {
  const [selectedCharityId, setSelectedCharityId] = useState<string>(
    preSelectedCharityId || ""
  );
  const [contributionPct, setContributionPct] = useState<number>(
    MIN_CHARITY_CONTRIBUTION_PCT
  );
  const [password, setPassword] = useState<string>("");

  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
  ];

  const [state, formAction, isPending] = useActionState<
    AuthActionResult | null,
    FormData
  >(signupAction, null);

  const activeCharity = charities.find((c) => c.id === selectedCharityId);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#090D16]">
      <div className="w-full max-w-md space-y-6 glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
        {state?.success ? (
          <div className="text-center space-y-6 py-2">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
              <Mail className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Check your email
              </h1>
              <p className="text-sm text-slate-300">
                Your account has been created successfully! A verification email has been sent to your address.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 text-xs text-slate-400 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Verification Required</span>
              </div>
              <p className="leading-relaxed">
                Before you can sign in and access the dashboard, you must verify your email address by clicking the link in the message sent to your inbox.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 px-4 text-sm transition duration-150 shadow-lg shadow-emerald-500/20"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-2 border border-emerald-500/20">
                <Heart className="h-6 w-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Join Digital Heroes
              </h1>
              <p className="text-sm text-slate-400">
                Track your golf scores, enter monthly draws, and make an impact.
              </p>
            </div>

            {/* Global Error Banner */}
            {state?.error && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <p>{state.error}</p>
              </div>
            )}

            <form action={formAction} className="space-y-4">
            {preSelectedPlan && (
              <input type="hidden" name="plan" value={preSelectedPlan} />
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="fullName"
                className="block text-xs font-medium text-slate-300 uppercase tracking-wider"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Alex Morgan"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
              />
            </div>

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
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
            </div>

            {/* Dynamic Password Requirements Checklist */}
            <div
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2"
              data-testid="password-requirements"
            >
              <span className="block text-xs font-medium text-slate-400">
                Password requirements:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {passwordRules.map((rule) => (
                  <div
                    key={rule.label}
                    className={`flex items-center gap-1.5 transition-colors duration-150 ${
                      rule.met
                        ? "text-emerald-400 font-medium"
                        : "text-slate-500"
                    }`}
                  >
                    {rule.met ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="h-2.5 w-2.5 shrink-0 text-slate-600 fill-slate-800" />
                    )}
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Charity Selection Dropdown */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="charityId"
                  className="block text-xs font-medium text-slate-300 uppercase tracking-wider"
                >
                  Designated Charity Partner
                </label>
                {activeCharity && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Selected
                  </span>
                )}
              </div>
              <select
                id="charityId"
                name="charityId"
                value={selectedCharityId}
                onChange={(e) => setSelectedCharityId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
              >
                <option value="">Select a partner charity (optional)</option>
                {charities.map((charity) => (
                  <option key={charity.id} value={charity.id}>
                    {charity.name} {charity.is_featured ? "★ Featured" : ""}
                  </option>
                ))}
              </select>
              {activeCharity?.tagline && (
                <p className="text-[11px] text-emerald-400 italic">
                  &ldquo;{activeCharity.tagline}&rdquo;
                </p>
              )}
            </div>

            {/* Charity Contribution Percentage Slider */}
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">
                  Charity Giving Percentage
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {contributionPct}% (Min {MIN_CHARITY_CONTRIBUTION_PCT}%)
                </span>
              </div>
              <input
                id="charityContributionPct"
                name="charityContributionPct"
                type="range"
                min={MIN_CHARITY_CONTRIBUTION_PCT}
                max={MAX_CHARITY_CONTRIBUTION_PCT}
                step="5"
                value={contributionPct}
                onChange={(e) => setContributionPct(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Minimum 10% of your membership fee directly supports your designated non-profit. You can adjust this anytime on your dashboard.
              </p>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2.5 px-4 text-sm transition duration-150 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              {isPending ? (
                <span>Creating account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
          </>
        )}

        <div className="border-t border-slate-800/80 pt-4 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition underline underline-offset-4"
          >
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
