/**
 * Auth redirect helpers.
 *
 * Both the OAuth callback and the email-confirmation route carry a `next`
 * parameter through an external redirect (the provider, or a link in an email),
 * which makes it attacker-controllable. Everything that decides *where* to send
 * the browser after sign-in lives here so there is one place to audit.
 */

// The explicit extension keeps this module runnable under Node's type stripping,
// which `npm test` uses — ESM there has no extensionless resolution.
import { DEFAULT_SIGNED_IN_PATH } from "./supabase/config.ts";

/**
 * Reduces a caller-supplied `next` value to a safe same-origin path.
 *
 * Rejects anything that could leave the site: absolute URLs (`https://evil.com`),
 * scheme-relative ones (`//evil.com`), backslash variants that some browsers
 * normalise to `//`, and control characters used to smuggle a second header.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH
): string {
  if (!next) return fallback;

  // A percent-encoded payload only becomes dangerous once decoded, so validate
  // the decoded form. Malformed encoding is not worth salvaging.
  let candidate: string;
  try {
    candidate = decodeURIComponent(next);
  } catch {
    return fallback;
  }

  candidate = candidate.trim();
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // CR/LF/NUL and friends: a decoded newline here would let a caller append a
  // second header to a redirect built from this value.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  return candidate;
}

/**
 * The origin to build auth redirect URLs from.
 *
 * Behind a proxy `request.url` often shows the internal address (`localhost:3000`
 * on Vercel), which would send users to a host that is not theirs, so the
 * forwarded headers win when present. `NEXT_PUBLIC_SITE_URL` is the escape hatch
 * for deployments that strip them.
 */
export function resolveOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = request.headers.get("x-forwarded-host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/** Builds `/login?error=…`, preserving the destination the user was headed to. */
export function authErrorUrl(origin: string, code: string, next?: string): URL {
  const url = new URL("/login", origin);
  url.searchParams.set("error", code);
  if (next && next !== DEFAULT_SIGNED_IN_PATH) url.searchParams.set("next", next);
  return url;
}
