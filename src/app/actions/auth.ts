"use server";

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

  const supabase = await createClient();

  // The on_auth_user_created trigger on auth.users will automatically
  // insert into public.profiles with the metadata provided here.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
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

  // If Supabase project requires email confirmation and no session is returned
  if (data.user && !data.session) {
    return {
      success: true,
      message:
        "Registration successful! Please check your email inbox to confirm your account.",
    };
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
