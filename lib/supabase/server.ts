import "server-only";

/**
 * Server-side Supabase clients.
 *
 * A client must be built per request — it is configured around that request's
 * cookies, so sharing one across requests would leak sessions between users.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { AuthUser } from "@/lib/auth-user";
import {
  AUTH_COOKIE_OPTIONS,
  SUPABASE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./config";

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase غير مُهيّأ: أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }
}

/**
 * Client for Server Components, Server Actions, and Route Handlers.
 *
 * Server Components cannot write cookies, so a token refresh that lands during a
 * render throws when it tries to persist. That is swallowed here rather than
 * failing the page: the proxy refreshes the session on every request, so the
 * written-back cookie is not lost, only deferred by one hop.
 */
export async function createClient() {
  assertConfigured();
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — see the note above.
        }
      },
    },
  });
}

/**
 * The signed-in user, or `null`.
 *
 * `getClaims` verifies the JWT signature (against the project's published keys,
 * or via the auth server for symmetric secrets) instead of trusting the cookie,
 * which is what makes this safe to gate on. It returns claims rather than a
 * `User`, so the fields the UI needs are mapped out explicitly.
 *
 * Never throws: an unconfigured project or an expired session is "no user", and
 * a caller that must have one redirects on `null`.
 *
 * Wrapped in `cache` so the layout and the page it renders share one signature
 * verification instead of doing the work per component.
 */
export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) return null;

    const claims = data.claims;
    const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
    const str = (key: string) =>
      typeof metadata[key] === "string" ? (metadata[key] as string) : undefined;

    return {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      name: str("full_name") ?? str("name") ?? str("user_name"),
      avatarUrl: str("avatar_url") ?? str("picture"),
    };
  } catch {
    return null;
  }
});

export type { AuthUser };
