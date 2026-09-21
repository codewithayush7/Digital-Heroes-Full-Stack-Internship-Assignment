"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, signupSchema } from "@/lib/validations/auth.schema";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function loginAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parseResult = loginSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      error: parseResult.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { email, password } = parseResult.data;
  const next = (formData.get("next") as string) || "/dashboard";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signupAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    charityId: formData.get("charityId") || undefined,
    charityContributionPct: formData.get("charityContributionPct") || 10,
  };

  const parseResult = signupSchema.safeParse(rawData);
  if (!parseResult.success) {
    return {
      error: parseResult.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { email, password, fullName, charityId, charityContributionPct } =
    parseResult.data;

  let appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const headerList = await headers();
    const originHeader = headerList.get("origin");
    const host = headerList.get("host");
    const proto = headerList.get("x-forwarded-proto") || "http";
    if (originHeader) {
      appOrigin = originHeader;
    } else if (host) {
      appOrigin = `${proto}://${host}`;
    }
  } catch {
    // Fallback if called outside a Next.js request context (e.g. tests)
    appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }
  const emailRedirectTo = `${appOrigin}/auth/callback?next=/dashboard`;

  const supabase = await createClient();

  // The on_auth_user_created trigger on auth.users will automatically
  // insert into public.profiles with the metadata provided here.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: fullName,
        charity_id: charityId || null,
        charity_contribution_pct: charityContributionPct,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // When email confirmation is enabled in Supabase, signup returns an unverified user
  // without an active session. Treat this as the expected verification-required state.
  if (data.user && !data.session) {
    return {
      success: true,
      message:
        "Account created! We've sent a verification email to your inbox. Please verify your email before logging in.",
    };
  }

  // If a session exists (e.g. if confirmation is off in some environment), proceed to dashboard
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resendVerificationAction(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get("email");

  if (!email || typeof email !== "string" || !email.trim()) {
    return {
      error: "Please enter your email address.",
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return {
      error: "Please enter a valid email address.",
    };
  }

  let appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const headerList = await headers();
    const originHeader = headerList.get("origin");
    const host = headerList.get("host");
    const proto = headerList.get("x-forwarded-proto") || "http";
    if (originHeader) {
      appOrigin = originHeader;
    } else if (host) {
      appOrigin = `${proto}://${host}`;
    }
  } catch {
    appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }
  const emailRedirectTo = `${appOrigin}/auth/callback?next=/dashboard`;

  try {
    const supabase = await createClient();
    await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo,
      },
    });
  } catch {
    // Swallow any unexpected internal network or context exception to avoid leaking errors
  }

  return {
    success: true,
    message:
      "If an account exists for this email, a verification email has been sent.",
  };
}

