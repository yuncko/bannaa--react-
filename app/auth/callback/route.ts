/**
 * OAuth (and PKCE) return leg: trades the `code` for a session cookie.
 *
 * The provider sends the browser here after Google/GitHub consent. Failures
 * redirect back to `/login?error=…` rather than rendering an error page — the
 * user's next step is always "try signing in again", and a redirect keeps the
 * single-use code out of the address bar.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authErrorUrl, resolveOrigin, safeRedirectPath } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const params = request.nextUrl.searchParams;
  const next = safeRedirectPath(params.get("next"));

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(authErrorUrl(origin, "not_configured"));
  }

  // The provider reports a refused consent screen this way; it is a normal
  // outcome, not a fault, so it gets its own message.
  const providerError = params.get("error");
  if (providerError) {
    const code = providerError === "access_denied" ? "oauth_denied" : "oauth_failed";
    return NextResponse.redirect(authErrorUrl(origin, code, next));
  }

  const code = params.get("code");
  if (!code) {
    return NextResponse.redirect(authErrorUrl(origin, "missing_code", next));
  }

  try {
    const supabase = await createClient();
    // `flowId` disambiguates concurrent PKCE flows (two providers in two tabs);
    // it is only present when the auth server was asked to round-trip it.
    const flowId = params.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined
    );

    if (error) {
      console.error("[auth/callback] exchange failed:", error.code ?? error.message);
      return NextResponse.redirect(authErrorUrl(origin, "exchange_failed", next));
    }
  } catch (err) {
    console.error("[auth/callback] unexpected failure:", err);
    return NextResponse.redirect(authErrorUrl(origin, "exchange_failed", next));
  }

  return NextResponse.redirect(new URL(next, origin));
}
