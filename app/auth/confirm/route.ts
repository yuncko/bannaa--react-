/**
 * Email link landing route: sign-up confirmations, magic links, and recovery.
 *
 * Supabase's email templates can point either here with a `token_hash` (the
 * recommended server-side form) or at `/auth/callback` with a `code`. Both are
 * handled so the flow works whichever template style the project has.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { authErrorUrl, resolveOrigin, safeRedirectPath } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Types this route accepts, so an arbitrary `type` can't be forced through. */
const ALLOWED_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const rawType = params.get("type");
  const type = ALLOWED_TYPES.find((t) => t === rawType);

  // A recovery link must land on the password form, not the home page.
  const fallback = type === "recovery" ? "/account/password" : undefined;
  const next = safeRedirectPath(params.get("next"), fallback);

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(authErrorUrl(origin, "not_configured"));
  }
  if (!tokenHash || !type) {
    return NextResponse.redirect(authErrorUrl(origin, "link_expired", next));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("[auth/confirm] verify failed:", error.code ?? error.message);
      return NextResponse.redirect(authErrorUrl(origin, "link_expired", next));
    }
  } catch (err) {
    console.error("[auth/confirm] unexpected failure:", err);
    return NextResponse.redirect(authErrorUrl(origin, "link_expired", next));
  }

  return NextResponse.redirect(new URL(next, origin));
}
