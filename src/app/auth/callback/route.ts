import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const VALID_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(type: string): type is EmailOtpType {
  return (VALID_OTP_TYPES as readonly string[]).includes(type);
}

export function getSafeRedirectPath(nextParam: string | null): string {
  if (!nextParam) return "/dashboard";
  if (
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.includes("\\") &&
    !nextParam.includes("://")
  ) {
    return nextParam;
  }
  return "/dashboard";
}

export type CallbackDeps = {
  exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>;
  verifyOtp: (params: {
    token_hash: string;
    type: EmailOtpType;
  }) => Promise<{ error: unknown }>;
};

export async function handleAuthCallback(
  requestUrl: string,
  deps: CallbackDeps
): Promise<string> {
  const { searchParams, origin } = new URL(requestUrl);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = getSafeRedirectPath(searchParams.get("next"));

  // 1. PKCE Code flow: exchange code for active session
  if (code) {
    const { error } = await deps.exchangeCodeForSession(code);
    if (!error) {
      return `${origin}${next}`;
    }
    return `${origin}/login?error=verification_link_invalid`;
  }

  // 2. Token hash + OTP type flow: verify OTP using valid EmailOtpType
  if (token_hash && typeParam) {
    if (isEmailOtpType(typeParam)) {
      const { error } = await deps.verifyOtp({
        token_hash,
        type: typeParam,
      });
      if (!error) {
        return `${origin}${next}`;
      }
    }
    return `${origin}/login?error=verification_link_invalid`;
  }

  // Missing or invalid parameters
  return `${origin}/login?error=verification_link_invalid`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const redirectUrl = await handleAuthCallback(request.url, {
    exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
    verifyOtp: (params) => supabase.auth.verifyOtp(params),
  });

  return NextResponse.redirect(redirectUrl);
}
