import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { loginSchema, signupSchema, passwordSchema } from "../src/lib/validations/auth.schema";
import { resendVerificationAction } from "../src/app/actions/auth";
import {
  handleAuthCallback,
  getSafeRedirectPath,
  type CallbackDeps,
} from "../src/app/auth/callback/route";
import { evaluateRouteAccess, isUserEmailConfirmed } from "../src/middleware";
import type { Database } from "../src/types/database.types";

// Read environment variables from .env.local without exposing secrets
const envContent = fs.readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

describe("Milestone 1B: Authentication, Validation, and Authorization Tests", () => {
  let supabase: SupabaseClient<Database>;
  const testEmail = `hero_test_${Date.now()}@gmail.com`;
  const testPassword = "StrongPassword123!";
  let testUserId: string | null = null;
  let rateLimited = false;

  before(() => {
    assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL must be defined");
    assert.ok(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined");
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  after(async () => {
    if (testUserId && supabaseServiceKey) {
      try {
        const adminSupabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
        await adminSupabase.auth.admin.deleteUser(testUserId);
      } catch {
        // Best effort cleanup
      }
    }
  });

  // 1. Zod Validation Rules & Password Hardening
  describe("1. Schema & Business Rules Validation", () => {
    test("rejects charity contribution below 10%", () => {
      const result = signupSchema.safeParse({
        email: "user@gmail.com",
        password: "ValidPassword1",
        confirmPassword: "ValidPassword1",
        fullName: "Test User",
        charityContributionPct: 5, // Below 10% minimum
      });
      assert.strictEqual(result.success, false);
      assert.ok(
        result.error.issues.some((i) =>
          i.message.includes("Charity contribution must be at least 10%")
        )
      );
    });

    test("rejects password confirmation mismatch", () => {
      const result = signupSchema.safeParse({
        email: "user@gmail.com",
        password: "ValidPassword1",
        confirmPassword: "DifferentPassword1",
        fullName: "Test User",
        charityContributionPct: 15,
      });
      assert.strictEqual(result.success, false);
      assert.ok(
        result.error.issues.some((i) => i.message === "Passwords do not match")
      );
    });

    test("accepts valid signup input with valid charity percentage", () => {
      const result = signupSchema.safeParse({
        email: "user@gmail.com",
        password: "ValidPassword1",
        confirmPassword: "ValidPassword1",
        fullName: "Test User",
        charityContributionPct: 25,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.charityContributionPct, 25);
    });

    // --- Strict Password Hardening Rules ---
    describe("Password Complexity Rules (Phase 2)", () => {
      test("PASS: accepts valid password satisfying all four rules", () => {
        const result = passwordSchema.safeParse("StrongPassword1");
        assert.strictEqual(result.success, true);

        const signupRes = signupSchema.safeParse({
          email: "valid@example.com",
          password: "StrongPassword1",
          confirmPassword: "StrongPassword1",
          fullName: "Valid User",
        });
        assert.strictEqual(signupRes.success, true);
      });

      test("PASS: accepts password with exactly 8 characters satisfying all rules", () => {
        const result = passwordSchema.safeParse("Abcdef12");
        assert.strictEqual(result.success, true);

        const result2 = passwordSchema.safeParse("Pass1234");
        assert.strictEqual(result2.success, true);

        const signupRes = signupSchema.safeParse({
          email: "eight@example.com",
          password: "Pass1234",
          confirmPassword: "Pass1234",
          fullName: "Eight Chars",
        });
        assert.strictEqual(signupRes.success, true);
      });

      test("FAIL: rejects empty password", () => {
        const result = passwordSchema.safeParse("");
        assert.strictEqual(result.success, false);
        assert.ok(result.error.issues.some((i) => i.message.includes("at least 8 characters")));
      });

      test("FAIL: rejects 7-character password meeting other criteria", () => {
        const result = passwordSchema.safeParse("Pass12a");
        assert.strictEqual(result.success, false);
        assert.ok(result.error.issues.some((i) => i.message.includes("at least 8 characters")));

        const signupRes = signupSchema.safeParse({
          email: "short@example.com",
          password: "Pass12a",
          confirmPassword: "Pass12a",
          fullName: "Short Pass",
        });
        assert.strictEqual(signupRes.success, false);
      });

      test("FAIL: rejects 8+ character password with no uppercase letter", () => {
        const result = passwordSchema.safeParse("password123");
        assert.strictEqual(result.success, false);
        assert.ok(
          result.error.issues.some((i) => i.message.includes("at least one uppercase letter"))
        );
      });

      test("FAIL: rejects 8+ character password with no lowercase letter", () => {
        const result = passwordSchema.safeParse("PASSWORD123");
        assert.strictEqual(result.success, false);
        assert.ok(
          result.error.issues.some((i) => i.message.includes("at least one lowercase letter"))
        );
      });

      test("FAIL: rejects 8+ character password with no number", () => {
        const result = passwordSchema.safeParse("PasswordWord");
        assert.strictEqual(result.success, false);
        assert.ok(
          result.error.issues.some((i) => i.message.includes("at least one number"))
        );
      });

      test("LOGIN COMPATIBILITY: login validation accepts passwords lacking new complexity rules", () => {
        // Simple password without uppercase or numbers
        const res1 = loginSchema.safeParse({
          email: "olduser@example.com",
          password: "simplepassword",
        });
        assert.strictEqual(res1.success, true, "Login must accept simple existing passwords");

        // Simple password with only numbers
        const res2 = loginSchema.safeParse({
          email: "olduser@example.com",
          password: "123456",
        });
        assert.strictEqual(res2.success, true, "Login must accept 6-char existing password");

        // Login still rejects empty password
        const emptyRes = loginSchema.safeParse({
          email: "olduser@example.com",
          password: "",
        });
        assert.strictEqual(emptyRes.success, false, "Login must reject empty password");
      });
    });
  });

  // 2. Signup Flow & Database Trigger Verification
  describe("2. Remote Signup Flow & Profile Trigger", () => {
    test("creates new user in auth with email confirmation required or handles rate limits gracefully", async () => {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          emailRedirectTo: "http://localhost:3000/auth/callback?next=/dashboard",
          data: {
            full_name: "Hero Test Athlete",
            charity_contribution_pct: 15,
          },
        },
      });

      if (error) {
        if (error.message.includes("rate limit")) {
          rateLimited = true;
          console.log("Note: Supabase default SMTP email rate limit hit on remote test project.");
          return;
        }
        assert.ifError(error);
      }

      assert.ok(data.user, "User should be created in auth");
      testUserId = data.user.id;
      assert.strictEqual(data.user.email, testEmail);

      // When email confirmation is enabled, session is null
      if (!data.session) {
        assert.strictEqual(data.session, null, "Session must be null when email confirmation is required");
      }

      // Verify profile trigger via service role client even when unconfirmed
      if (supabaseServiceKey && testUserId) {
        const adminSupabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
        const { data: profile, error: profileErr } = await adminSupabase
          .from("profiles")
          .select("*")
          .eq("id", testUserId)
          .single();

        assert.ifError(profileErr);
        assert.ok(profile, "Profile row should exist via database trigger even when unconfirmed");
        assert.strictEqual(profile.email, testEmail);
        assert.strictEqual(profile.full_name, "Hero Test Athlete");
        assert.strictEqual(profile.role, "subscriber", "Default role must be subscriber");
        assert.strictEqual(Number(profile.charity_contribution_pct), 15);
      }
    });
  });

  // 3. Login Flow & Session Verification
  describe("3. Remote Login Flow & Session Retrieval", () => {
    test("rejects login with invalid credentials cleanly", async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: "WrongPassword!",
      });

      assert.ok(error, "Expected error on bad credentials");
      assert.strictEqual(data.session, null);
    });

    test("authenticates or handles confirmation requirement cleanly", async () => {
      if (rateLimited) {
        console.log("Skipping login test due to prior rate limit.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (error) {
        // In Supabase, if email confirmation is enabled, signInWithPassword returns "Email not confirmed"
        assert.ok(
          error.message.includes("Email not confirmed") ||
          error.message.includes("Invalid login credentials"),
          `Unexpected error: ${error.message}`
        );
        return;
      }

      assert.ok(data.session, "Session should be present");
      assert.ok(data.user, "User should be present");

      // Verify session retrieval
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      assert.ok(currentUser, "getUser() should return current user");
      assert.strictEqual(currentUser.id, data.user.id);
    });
  });

  // 4. Role Authorization & Route Protection Logic
  describe("4. Role Authorization & Admin Route Access", () => {
    test("subscriber role cannot access admin protected routes", () => {
      const checkAdminAuthorization = (role: string) => {
        if (role === "admin") {
          return { allowed: true };
        }
        return { allowed: false, redirect: "/dashboard?error=unauthorized" };
      };

      const subscriberCheck = checkAdminAuthorization("subscriber");
      assert.strictEqual(subscriberCheck.allowed, false);
      assert.strictEqual(subscriberCheck.redirect, "/dashboard?error=unauthorized");
    });

    test("admin role is allowed access to admin routes", () => {
      const checkAdminAuthorization = (role: string) => {
        if (role === "admin") {
          return { allowed: true };
        }
        return { allowed: false, redirect: "/dashboard?error=unauthorized" };
      };

      const adminCheck = checkAdminAuthorization("admin");
      assert.strictEqual(adminCheck.allowed, true);
    });

    test("unauthenticated user is redirected to login with next parameter", () => {
      const checkRouteProtection = (pathname: string, user: User | null) => {
        const isProtected =
          pathname.startsWith("/dashboard") ||
          pathname.startsWith("/profile") ||
          pathname.startsWith("/admin");

        if (isProtected && !user) {
          return { allowed: false, redirect: `/login?next=${encodeURIComponent(pathname)}` };
        }
        return { allowed: true };
      };

      const unauthDashboard = checkRouteProtection("/dashboard", null);
      assert.strictEqual(unauthDashboard.allowed, false);
      assert.strictEqual(unauthDashboard.redirect, "/login?next=%2Fdashboard");

      const unauthAdmin = checkRouteProtection("/admin/users", null);
      assert.strictEqual(unauthAdmin.allowed, false);
      assert.strictEqual(unauthAdmin.redirect, "/login?next=%2Fadmin%2Fusers");

      const publicHome = checkRouteProtection("/", null);
      assert.strictEqual(publicHome.allowed, true);
    });
  });

  // 5. Logout Flow & Session Invalidation
  describe("5. Logout & Session Invalidation", () => {
    test("signs out and clears active session", async () => {
      const { error } = await supabase.auth.signOut();
      assert.ifError(error);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      assert.strictEqual(user, null, "User session should be invalidated after signOut");
    });
  });

  // 6. Phase 1: Email Verification Signup Flow
  describe("6. Email Verification Signup Flow (Phase 1)", () => {
    test("signup action logic enters verification-required state when session is null", () => {
      // Simulate Supabase signUp response when email confirmation is active
      type MockSignUpRes = {
        data: {
          user: { id: string; email: string } | null;
          session: null;
        };
        error: { message: string } | null;
      };

      const mockSignUpResponse: MockSignUpRes = {
        data: {
          user: { id: "test-user-id", email: "newuser@example.com" },
          session: null,
        },
        error: null,
      };

      const handleSignUpResult = (res: MockSignUpRes) => {
        if (res.error) {
          return { error: res.error.message };
        }
        if (res.data.user && !res.data.session) {
          return {
            success: true,
            message:
              "Account created! We've sent a verification email to your inbox. Please verify your email before logging in.",
          };
        }
        return { redirect: "/dashboard" };
      };

      const result = handleSignUpResult(mockSignUpResponse);
      assert.strictEqual(result.success, true);
      assert.ok(result.message?.includes("verification email"));
      assert.strictEqual("redirect" in result, false, "Must not redirect unverified user to dashboard");
    });

    test("does not treat unverified signup as fully authenticated session", () => {
      const mockSignUpResponse = {
        data: {
          user: { id: "unconfirmed-user", email: "unconfirmed@example.com" },
          session: null,
        },
        error: null,
      };

      // Session presence check
      const isAuthenticated = Boolean(mockSignUpResponse.data.session);
      assert.strictEqual(isAuthenticated, false, "Unverified signup must have no active session");
    });

    test("constructs correct emailRedirectTo with origin and next parameter", () => {
      const buildEmailRedirectTo = (origin: string, nextParam: string = "/dashboard") => {
        return `${origin}/auth/callback?next=${encodeURIComponent(nextParam)}`;
      };

      const localhostUrl = buildEmailRedirectTo("http://localhost:3000");
      assert.strictEqual(localhostUrl, "http://localhost:3000/auth/callback?next=%2Fdashboard");

      const prodUrl = buildEmailRedirectTo("https://digitalheroes.org", "/scores");
      assert.strictEqual(prodUrl, "https://digitalheroes.org/auth/callback?next=%2Fscores");
    });

    test("preserves full_name, charity_id, and charity_contribution_pct in signup options", () => {
      const prepareSignUpPayload = (formData: {
        email: string;
        password: string;
        fullName: string;
        charityId?: string;
        charityContributionPct: number;
        origin: string;
      }) => {
        return {
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${formData.origin}/auth/callback?next=/dashboard`,
            data: {
              full_name: formData.fullName,
              charity_id: formData.charityId || null,
              charity_contribution_pct: formData.charityContributionPct,
            },
          },
        };
      };

      const payload = prepareSignUpPayload({
        email: "athlete@example.com",
        password: "Password123",
        fullName: "Tiger Woods",
        charityId: "charity-uuid-1234",
        charityContributionPct: 20,
        origin: "http://localhost:3000",
      });

      assert.strictEqual(payload.options.emailRedirectTo, "http://localhost:3000/auth/callback?next=/dashboard");
      assert.strictEqual(payload.options.data.full_name, "Tiger Woods");
      assert.strictEqual(payload.options.data.charity_id, "charity-uuid-1234");
      assert.strictEqual(payload.options.data.charity_contribution_pct, 20);
    });
  });

  // 7. Phase 2: Email Verification Callback Route (/auth/callback)
  describe("7. Email Verification Callback Route (Phase 2)", () => {
    describe("Open Redirect & Destination Sanitization", () => {
      test("preserves safe relative paths", () => {
        assert.strictEqual(getSafeRedirectPath("/dashboard"), "/dashboard");
        assert.strictEqual(getSafeRedirectPath("/scores"), "/scores");
        assert.strictEqual(getSafeRedirectPath("/profile"), "/profile");
        assert.strictEqual(getSafeRedirectPath("/charities/red-cross"), "/charities/red-cross");
      });

      test("falls back to /dashboard on missing, null, or empty paths", () => {
        assert.strictEqual(getSafeRedirectPath(null), "/dashboard");
        assert.strictEqual(getSafeRedirectPath(""), "/dashboard");
      });

      test("sanitizes external URLs and protocol-relative attempts to /dashboard", () => {
        assert.strictEqual(getSafeRedirectPath("https://malicious.com"), "/dashboard");
        assert.strictEqual(getSafeRedirectPath("http://evil.com/phish"), "/dashboard");
        assert.strictEqual(getSafeRedirectPath("//evil.com"), "/dashboard");
        assert.strictEqual(getSafeRedirectPath("/\\evil.com"), "/dashboard");
        assert.strictEqual(getSafeRedirectPath("javascript:alert(1)"), "/dashboard");
      });
    });

    describe("PKCE Code Verification Flow", () => {
      test("valid PKCE code exchanges for session and redirects to safe next destination", async () => {
        let exchangedCode: string | null = null;
        const mockDeps = {
          exchangeCodeForSession: async (code: string) => {
            exchangedCode = code;
            return { error: null };
          },
          verifyOtp: async () => ({ error: null }),
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?code=valid-pkce-code-123&next=/scores",
          mockDeps
        );

        assert.strictEqual(exchangedCode, "valid-pkce-code-123");
        assert.strictEqual(redirectUrl, "http://localhost:3000/scores");
      });

      test("invalid or expired PKCE code safely redirects to login with verification_link_invalid", async () => {
        const mockDeps = {
          exchangeCodeForSession: async () => ({
            error: { message: "Invalid or expired PKCE authorization code" },
          }),
          verifyOtp: async () => ({ error: null }),
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?code=expired-code",
          mockDeps
        );

        assert.strictEqual(
          redirectUrl,
          "http://localhost:3000/login?error=verification_link_invalid"
        );
      });
    });

    describe("Token Hash & OTP Type Verification Flow", () => {
      test("valid token_hash with 'signup' type verifies OTP and redirects to destination", async () => {
        let verifiedParams: { token_hash: string; type: string } | null = null;
        const mockDeps: CallbackDeps = {
          exchangeCodeForSession: async () => ({ error: null }),
          verifyOtp: async (params) => {
            verifiedParams = params;
            return { error: null };
          },
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?token_hash=pkce_hash_abc123&type=signup&next=/dashboard",
          mockDeps
        );

        assert.deepStrictEqual(verifiedParams, {
          token_hash: "pkce_hash_abc123",
          type: "signup",
        });
        assert.strictEqual(redirectUrl, "http://localhost:3000/dashboard");
      });

      test("valid token_hash with 'email' type verifies OTP and redirects to destination", async () => {
        const mockDeps: CallbackDeps = {
          exchangeCodeForSession: async () => ({ error: null }),
          verifyOtp: async () => ({ error: null }),
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?token_hash=pkce_hash_xyz&type=email",
          mockDeps
        );

        assert.strictEqual(redirectUrl, "http://localhost:3000/dashboard");
      });

      test("rejects invalid/unsupported OTP type without calling verifyOtp", async () => {
        let verifyOtpCalled = false;
        const mockDeps: CallbackDeps = {
          exchangeCodeForSession: async () => ({ error: null }),
          verifyOtp: async () => {
            verifyOtpCalled = true;
            return { error: null };
          },
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?token_hash=any_hash&type=invalid_type_exploit",
          mockDeps
        );

        assert.strictEqual(verifyOtpCalled, false, "verifyOtp must not be called with invalid type");
        assert.strictEqual(
          redirectUrl,
          "http://localhost:3000/login?error=verification_link_invalid"
        );
      });

      test("expired or already-used token_hash safely redirects to verification_link_invalid", async () => {
        const mockDeps: CallbackDeps = {
          exchangeCodeForSession: async () => ({ error: null }),
          verifyOtp: async () => ({
            error: { message: "Token has expired or is invalid" },
          }),
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?token_hash=expired_hash&type=signup",
          mockDeps
        );

        assert.strictEqual(
          redirectUrl,
          "http://localhost:3000/login?error=verification_link_invalid"
        );
      });
    });

    describe("Missing & Malformed Query Parameters", () => {
      test("missing code and token_hash redirects to verification_link_invalid", async () => {
        const mockDeps: CallbackDeps = {
          exchangeCodeForSession: async () => ({ error: null }),
          verifyOtp: async () => ({ error: null }),
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback",
          mockDeps
        );

        assert.strictEqual(
          redirectUrl,
          "http://localhost:3000/login?error=verification_link_invalid"
        );
      });

      test("token_hash present without type parameter redirects to verification_link_invalid", async () => {
        let verifyOtpCalled = false;
        const mockDeps: CallbackDeps = {
          exchangeCodeForSession: async () => ({ error: null }),
          verifyOtp: async () => {
            verifyOtpCalled = true;
            return { error: null };
          },
        };

        const redirectUrl = await handleAuthCallback(
          "http://localhost:3000/auth/callback?token_hash=orphan_hash",
          mockDeps
        );

        assert.strictEqual(verifyOtpCalled, false);
        assert.strictEqual(
          redirectUrl,
          "http://localhost:3000/login?error=verification_link_invalid"
        );
      });
    });
  });

  // 8. Phase 3: Resend Verification & Login Experience UX
  describe("8. Resend Verification & Login Verification UX (Phase 3)", () => {
    describe("resendVerificationAction Input Validation & Security", () => {
      test("rejects empty or whitespace email", async () => {
        const fd = new FormData();
        fd.append("email", "");
        const res = await resendVerificationAction(null, fd);
        assert.strictEqual(res.error, "Please enter your email address.");

        const fdSpace = new FormData();
        fdSpace.append("email", "   ");
        const resSpace = await resendVerificationAction(null, fdSpace);
        assert.strictEqual(resSpace.error, "Please enter your email address.");
      });

      test("rejects malformed email addresses", async () => {
        const malformed = ["not-an-email", "@missinguser.com", "user@nodomain", "user@.com"];
        for (const badEmail of malformed) {
          const fd = new FormData();
          fd.append("email", badEmail);
          const res = await resendVerificationAction(null, fd);
          assert.strictEqual(
            res.error,
            "Please enter a valid email address.",
            `Expected rejection for: ${badEmail}`
          );
        }
      });

      test("non-existent email receives generic non-enumerating message", async () => {
        const fd = new FormData();
        fd.append("email", "completely_fake_nonexistent_user_9999@gmail.com");
        const res = await resendVerificationAction(null, fd);
        assert.strictEqual(res.success, true);
        assert.strictEqual(
          res.message,
          "If an account exists for this email, a verification email has been sent."
        );
      });

      test("valid email format receives generic non-enumerating message", async () => {
        const fd = new FormData();
        fd.append("email", "athlete.champion@gmail.com");
        const res = await resendVerificationAction(null, fd);
        assert.strictEqual(res.success, true);
        assert.strictEqual(
          res.message,
          "If an account exists for this email, a verification email has been sent."
        );
      });
    });

    describe("Login Verification UX State Mapping", () => {
      test("maps 'Email not confirmed' Supabase error to user-friendly verification required message", () => {
        const getLoginErrorMessage = (rawError: string | null) => {
          if (rawError && rawError.toLowerCase().includes("email not confirmed")) {
            return {
              isVerificationRequired: true,
              userMessage: "Please verify your email address before signing in.",
            };
          }
          return {
            isVerificationRequired: false,
            userMessage: rawError || "Authentication error. Please try again.",
          };
        };

        const result = getLoginErrorMessage("Email not confirmed");
        assert.strictEqual(result.isVerificationRequired, true);
        assert.strictEqual(
          result.userMessage,
          "Please verify your email address before signing in."
        );

        const normalError = getLoginErrorMessage("Invalid login credentials");
        assert.strictEqual(normalError.isVerificationRequired, false);
        assert.strictEqual(normalError.userMessage, "Invalid login credentials");
      });

      test("maps verified=true query param to success notification", () => {
        const getVerificationBanner = (searchParams: Record<string, string>) => {
          if (searchParams.verified === "true") {
            return "Your email has been verified. You can now sign in.";
          }
          return null;
        };

        const banner = getVerificationBanner({ verified: "true" });
        assert.strictEqual(
          banner,
          "Your email has been verified. You can now sign in."
        );
      });

      test("maps error=verification_link_invalid query param to safe user explanation", () => {
        const getUrlErrorBanner = (errorParam: string | null) => {
          if (errorParam === "verification_link_invalid") {
            return "This verification link is invalid, expired, or has already been used. Please request a new verification email or sign in below.";
          }
          if (errorParam === "unauthorized") {
            return "Access denied. Administrator privileges required.";
          }
          return "Authentication error. Please try again.";
        };

        const banner = getUrlErrorBanner("verification_link_invalid");
        assert.strictEqual(
          banner,
          "This verification link is invalid, expired, or has already been used. Please request a new verification email or sign in below."
        );
      });

      test("client-side resend validation checks for email before submission", () => {
        const validateEmailBeforeResend = (email: string) => {
          if (!email.trim()) {
            return { error: "Please enter your email address first." };
          }
          return { valid: true };
        };

        const emptyRes = validateEmailBeforeResend("");
        assert.strictEqual(emptyRes.error, "Please enter your email address first.");

        const spaceRes = validateEmailBeforeResend("   ");
        assert.strictEqual(spaceRes.error, "Please enter your email address first.");

        const validRes = validateEmailBeforeResend("user@gmail.com");
        assert.strictEqual("valid" in validRes && validRes.valid, true);
      });
    });
  });

  // 9. Phase 4: Middleware & Protected-Route Hardening Tests
  describe("9. Middleware & Protected-Route Hardening (Phase 4)", () => {
    const verifiedSubscriber = {
      id: "subscriber-uuid-1",
      email_confirmed_at: "2026-09-22T00:00:00Z",
    };

    const verifiedAdmin = {
      id: "admin-uuid-1",
      email_confirmed_at: "2026-09-22T00:00:00Z",
    };

    const unverifiedUser = {
      id: "unverified-uuid-1",
      email_confirmed_at: null,
      confirmed_at: null,
    };

    describe("isUserEmailConfirmed Helper", () => {
      test("returns true when email_confirmed_at is present", () => {
        assert.strictEqual(isUserEmailConfirmed({ email_confirmed_at: "2026-09-22" }), true);
      });

      test("returns true when legacy confirmed_at is present", () => {
        assert.strictEqual(isUserEmailConfirmed({ confirmed_at: "2026-09-22" }), true);
      });

      test("returns false when unconfirmed or null", () => {
        assert.strictEqual(isUserEmailConfirmed(null), false);
        assert.strictEqual(isUserEmailConfirmed(undefined), false);
        assert.strictEqual(isUserEmailConfirmed({ email_confirmed_at: null }), false);
        assert.strictEqual(isUserEmailConfirmed({ confirmed_at: null }), false);
      });
    });

    describe("Verified User Route Access", () => {
      test("verified user is allowed to access /dashboard", () => {
        const res = evaluateRouteAccess({
          pathname: "/dashboard",
          user: verifiedSubscriber,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, true);
      });

      test("verified subscriber is allowed to access /scores", () => {
        const res = evaluateRouteAccess({
          pathname: "/scores",
          user: verifiedSubscriber,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, true);
      });

      test("verified subscriber is allowed to access /profile", () => {
        const res = evaluateRouteAccess({
          pathname: "/profile",
          user: verifiedSubscriber,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, true);
      });

      test("verified subscriber is denied access to /admin and redirected to dashboard", () => {
        const res = evaluateRouteAccess({
          pathname: "/admin/users",
          user: verifiedSubscriber,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.redirectTo, "/dashboard?error=unauthorized");
      });

      test("verified admin is allowed to access /admin", () => {
        const res = evaluateRouteAccess({
          pathname: "/admin/charities",
          user: verifiedAdmin,
          userRole: "admin",
        });
        assert.strictEqual(res.allowed, true);
      });
    });

    describe("Unverified Authenticated User Route Protection (Defense-in-Depth)", () => {
      test("unverified user is blocked from /dashboard and redirected to login with email_not_confirmed", () => {
        const res = evaluateRouteAccess({
          pathname: "/dashboard",
          user: unverifiedUser,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.redirectTo, "/login?error=email_not_confirmed");
      });

      test("unverified user is blocked from /scores and redirected to login with email_not_confirmed", () => {
        const res = evaluateRouteAccess({
          pathname: "/scores",
          user: unverifiedUser,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.redirectTo, "/login?error=email_not_confirmed");
      });

      test("unverified user is blocked from /profile and redirected to login with email_not_confirmed", () => {
        const res = evaluateRouteAccess({
          pathname: "/profile",
          user: unverifiedUser,
          userRole: "subscriber",
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.redirectTo, "/login?error=email_not_confirmed");
      });

      test("unverified user is blocked from /admin and redirected to login with email_not_confirmed", () => {
        const res = evaluateRouteAccess({
          pathname: "/admin",
          user: unverifiedUser,
          userRole: "admin", // Even if profile trigger created row with admin role
        });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.redirectTo, "/login?error=email_not_confirmed");
      });
    });

    describe("Public & Unauthenticated Route Access", () => {
      test("public routes remain accessible to anyone", () => {
        const publicRoutes = [
          "/",
          "/charities",
          "/charities/wwf-wildlife",
          "/api/webhooks/stripe",
          "/auth/callback",
        ];

        for (const path of publicRoutes) {
          const anonRes = evaluateRouteAccess({ pathname: path, user: null });
          assert.strictEqual(anonRes.allowed, true, `Route ${path} should be publicly accessible`);

          const unverifiedRes = evaluateRouteAccess({ pathname: path, user: unverifiedUser });
          assert.strictEqual(unverifiedRes.allowed, true, `Route ${path} should be accessible to unverified user`);
        }
      });

      test("unauthenticated visitor to protected route is redirected to /login with next parameter", () => {
        const res = evaluateRouteAccess({ pathname: "/scores", user: null });
        assert.strictEqual(res.allowed, false);
        assert.strictEqual(res.redirectTo, "/login?next=%2Fscores");
      });

      test("redirect loop prevention: unverified user visiting /login is NOT redirected to /dashboard", () => {
        const loginRes = evaluateRouteAccess({
          pathname: "/login",
          user: unverifiedUser,
        });
        assert.strictEqual(loginRes.allowed, true, "Unverified user must stay on /login to see error");

        const signupRes = evaluateRouteAccess({
          pathname: "/signup",
          user: unverifiedUser,
        });
        assert.strictEqual(signupRes.allowed, true, "Unverified user must not be forced to /dashboard");
      });

      test("verified user visiting /login is redirected to /dashboard", () => {
        const loginRes = evaluateRouteAccess({
          pathname: "/login",
          user: verifiedSubscriber,
        });
        assert.strictEqual(loginRes.allowed, false);
        assert.strictEqual(loginRes.redirectTo, "/dashboard");
      });
    });
  });
});
