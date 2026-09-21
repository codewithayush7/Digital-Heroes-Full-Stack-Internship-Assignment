import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

export type UserVerificationStatus = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export function isUserEmailConfirmed(
  user: UserVerificationStatus | null | undefined
): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export function evaluateRouteAccess(params: {
  pathname: string;
  user: (UserVerificationStatus & { id?: string }) | null | undefined;
  userRole?: string | null;
}): { allowed: boolean; redirectTo?: string } {
  const { pathname, user, userRole } = params;

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/scores") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const confirmed = isUserEmailConfirmed(user);

  // 1. Protected route but no user session
  if (isProtectedRoute && !user) {
    return {
      allowed: false,
      redirectTo: `/login?next=${encodeURIComponent(pathname)}`,
    };
  }

  // 2. Protected route with authenticated user but unconfirmed email
  if (isProtectedRoute && user && !confirmed) {
    return {
      allowed: false,
      redirectTo: "/login?error=email_not_confirmed",
    };
  }

  // 3. Admin route with confirmed user but non-admin role
  if (pathname.startsWith("/admin") && user && confirmed) {
    if (userRole !== "admin") {
      return {
        allowed: false,
        redirectTo: "/dashboard?error=unauthorized",
      };
    }
  }

  // 4. Auth pages redirect only if authenticated AND email is confirmed
  // (Prevents infinite redirect loop if unverified user visits /login?error=email_not_confirmed)
  if (isAuthPage && user && confirmed) {
    return {
      allowed: false,
      redirectTo: "/dashboard",
    };
  }

  return { allowed: true };
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Securely retrieve and refresh the user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  let userRole: string | null = null;
  if (pathname.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = profile?.role ?? null;
  }

  const access = evaluateRouteAccess({
    pathname,
    user,
    userRole,
  });

  if (!access.allowed && access.redirectTo) {
    return NextResponse.redirect(new URL(access.redirectTo, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
