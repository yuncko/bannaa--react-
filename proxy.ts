/**
 * Refreshes the Supabase session on every request and gates protected routes.
 *
 * This exists because Server Components cannot write cookies. Without a hop that
 * can, a refreshed access token is computed during render and then thrown away,
 * so users get logged out at random once the old token expires.
 *
 * The auth check here is optimistic and runs on prefetches too, so it only reads
 * the cookie — never the database. Anything that touches user data re-verifies
 * with `getSessionUser()` (which validates the JWT) at the point of use.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  AUTH_COOKIE_OPTIONS,
  AUTH_ONLY_PATHS,
  DEFAULT_SIGNED_IN_PATH,
  PROTECTED_PREFIXES,
  SIGN_IN_PATH,
  SUPABASE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { safeRedirectPath } from "@/lib/auth-redirect";

export async function proxy(request: NextRequest) {
  // A deployment without Supabase keys still has to serve the generator.
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Written to both sides: `request` so a downstream render sees the fresh
        // token in this same pass, `response` so the browser keeps it.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Supabase supplies no-store headers with the first cookie write. Losing
        // them lets a CDN cache one user's Set-Cookie and serve it to another.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // This call is the point of the proxy: it refreshes an expiring token and
  // triggers `setAll` above. It must happen before the response is finalised.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;

  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN_PATH;
    url.search = "";
    url.searchParams.set("error", "session_required");
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (signedIn && (AUTH_ONLY_PATHS as readonly string[]).includes(pathname)) {
    // Honour `?next=` so a gated link resumes instead of dumping the user home,
    // but only after it is reduced to a same-origin path. It may carry a query
    // string, so it is parsed rather than assigned straight to `pathname` —
    // otherwise `/account?tab=1` becomes the literal path `/account%3Ftab=1`.
    const target = new URL(
      safeRedirectPath(request.nextUrl.searchParams.get("next"), DEFAULT_SIGNED_IN_PATH),
      request.nextUrl.origin
    );
    const url = request.nextUrl.clone();
    url.pathname = target.pathname;
    url.search = target.search;
    url.hash = target.hash;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. `/api` is left in
     * deliberately: route handlers read the session too, and they need the same
     * refreshed cookie.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
