import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Signal Strike — Subscription Gating Middleware (v2)
 *
 * Public routes always pass through.
 * Authenticated routes require an active or trialing subscription.
 *
 * Status routing:
 *   no row              → /trial
 *   trialing | active   → allow
 *   incomplete          → allow (mid-checkout)
 *   canceled | past_due | unpaid | incomplete_expired → /account
 */

const PUBLIC_PATHS = [
  "/landing",
  "/login",
  "/signup",
  "/trial",
  "/account",
  "/auth",
  "/api",
  "/terms",
  "/privacy",
];

const ALLOWED_STATUSES = new Set(["trialing", "active", "incomplete"]);
const BILLING_ISSUE_STATUSES = new Set([
  "canceled",
  "past_due",
  "unpaid",
  "incomplete_expired",
]);

function isPublicPath(pathname: string): boolean {
  // Exact root is public (landing redirect happens elsewhere).
  if (pathname === "/") return true;

  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip Next.js internals and static files quickly.
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    console.log(`[mw] ${pathname} — public, allow`);
    return NextResponse.next();
  }

  // Build a Supabase server client wired to the request cookies.
  // Uses the newer getAll/setAll interface to match the rest of the codebase.
  const res = NextResponse.next();

  let supabase;
  try {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );
  } catch (err) {
    console.error(`[mw] ${pathname} — createServerClient threw:`, err);
    // Fail open to /login so the user can re-authenticate.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 1. Auth check.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log(
      `[mw] ${pathname} — no user (${userError?.message ?? "no session"}), → /login`
    );
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Subscription lookup.
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subError) {
    console.error(
      `[mw] ${pathname} — subscription lookup failed for ${user.email}:`,
      subError.message
    );
    // Fail closed to /account so the user can see something.
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    return NextResponse.redirect(url);
  }

  // 3. No subscription row → push to /trial.
  if (!subscription) {
    console.log(
      `[mw] ${pathname} — ${user.email} has no subscription row, → /trial`
    );
    const url = req.nextUrl.clone();
    url.pathname = "/trial";
    return NextResponse.redirect(url);
  }

  const status = subscription.status as string;

  // 4. Healthy status → allow through.
  if (ALLOWED_STATUSES.has(status)) {
    console.log(`[mw] ${pathname} — ${user.email} status=${status}, allow`);
    return res;
  }

  // 5. Billing issue → /account.
  if (BILLING_ISSUE_STATUSES.has(status)) {
    console.log(
      `[mw] ${pathname} — ${user.email} status=${status}, → /account`
    );
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    return NextResponse.redirect(url);
  }

  // 6. Unknown status — fail closed to /account.
  console.warn(
    `[mw] ${pathname} — ${user.email} unknown status=${status}, → /account`
  );
  const url = req.nextUrl.clone();
  url.pathname = "/account";
  return NextResponse.redirect(url);
}

// Run on every path. Fast-path filtering for static assets is inside
// the function above (cleaner than fighting matcher regex syntax).
export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
