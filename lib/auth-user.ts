/**
 * The signed-in user as the UI renders it.
 *
 * Lives in its own module because both server code (`lib/supabase/server.ts`,
 * which is `server-only`) and client components need this shape. Importing the
 * type from the server module would drag a `server-only` import into the client
 * graph the moment someone forgets the `type` keyword.
 */
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

/** First character of the best available display name, for the avatar fallback. */
export function userInitial(user: AuthUser): string {
  const source = user.name?.trim() || user.email?.trim() || "";
  return source ? source.charAt(0).toUpperCase() : "?";
}

/** Display name, falling back to the local part of the email. */
export function userLabel(user: AuthUser): string {
  if (user.name?.trim()) return user.name.trim();
  const email = user.email?.trim();
  if (!email) return "حسابي";
  return email.split("@")[0] || email;
}
