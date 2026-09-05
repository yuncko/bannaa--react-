import "server-only";

/**
 * Post-sign-in enforcement of the Gmail-only rule.
 *
 * The forms validate before submitting, but OAuth does not go through a form: a
 * GitHub account can carry any address, and the first this app hears of it is
 * after the session already exists. So the check runs on the return leg, and a
 * rejected address is signed straight back out.
 *
 * Shared by `/auth/callback` and `/auth/confirm` so the two cannot disagree about
 * who is allowed in.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedEmailDomain } from "@/lib/email-policy";

/**
 * Signs the user out and reports rejection when their address is not allowed.
 *
 * Returns `true` when the caller should redirect to `?error=email_not_allowed`.
 *
 * A user whose email cannot be read is allowed through. Phone-only accounts have
 * no address to judge, and failing closed on an unreadable claim would lock out
 * every user the moment the auth server hiccups — the cost of the rare wrong
 * "allow" here is one account that starts with no welcome credit, since the
 * database applies the same domain rule before granting it.
 */
export async function rejectDisallowedEmail(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  const email = data?.user?.email;
  if (error || !email) return false;

  if (isAllowedEmailDomain(email)) return false;

  // The session was created by the exchange a moment ago; revoke it rather than
  // leaving a signed-in account that every page then has to re-reject.
  await supabase.auth.signOut();
  return true;
}
