/**
 * Supabase connection settings.
 *
 * Only server code reads these — the proxy, the server client, and the auth
 * actions. They keep the `NEXT_PUBLIC_` names anyway because that is what the
 * Supabase dashboard and every guide hand out, and because the values are
 * public by design; nothing here is a secret that the prefix would leak.
 *
 * Every value is read through a literal `process.env.X` reference on purpose:
 * Next.js inlines `NEXT_PUBLIC_*` variables by static analysis, so a computed
 * lookup like `process.env[name]` resolves to `undefined` in any bundled
 * context even when the variable is set.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Publishable or legacy anon key — both are accepted.
 *
 * Supabase issues `sb_publishable_…` keys for new projects and JWT `anon` keys
 * for older ones. Both are designed to be public (row level security is what
 * actually protects data), and `createServerClient` takes either one in the same
 * argument. Resolving several names keeps this working whichever convention the
 * project's dashboard hands out.
 */
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

/**
 * Whether auth can work at all in this deployment.
 *
 * Generation does not depend on Supabase, so a clone without these variables
 * must still run: the proxy skips session handling and the auth screens explain
 * what is missing instead of throwing on a client that cannot be constructed.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Where a successful sign-in lands when no explicit destination is given. */
export const DEFAULT_SIGNED_IN_PATH = "/";

/** Where the proxy sends an unauthenticated visitor. */
export const SIGN_IN_PATH = "/login";

/**
 * Routes that require a session. Prefix match, so `/account/settings` is covered
 * by `/account`.
 */
export const PROTECTED_PREFIXES = ["/account"] as const;

/** Auth screens a signed-in user has no reason to see. */
export const AUTH_ONLY_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
] as const;

/**
 * Cookie attributes for the session and the PKCE verifier.
 *
 * `@supabase/ssr` defaults to `httpOnly: false` because its browser client reads
 * tokens from `document.cookie`. Nothing here does — sign-in, OAuth, refresh, and
 * sign-out all run on the server — so the tokens are hidden from page scripts
 * instead, which takes an XSS from "steals a refresh token" down to "acts within
 * the current page".
 *
 * `sameSite` stays `lax`: the OAuth callback is a cross-site top-level
 * navigation, and `strict` would withhold the verifier cookie exactly there.
 *
 * `secure` is off in development because dev runs over plain HTTP and not every
 * browser stores a `Secure` cookie on `http://localhost`.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
