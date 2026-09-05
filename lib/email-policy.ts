/**
 * Which mailboxes may hold an account.
 *
 * The welcome credit makes a throwaway inbox worth money, so sign-up is limited
 * to Gmail. That is a deliberate product restriction, not a spam heuristic: a
 * blocklist of disposable domains is a losing race (new ones appear daily),
 * while an allowlist of one provider is exact.
 *
 * Client-safe on purpose — the sign-up form needs the same rule the server
 * enforces so a rejection is shown before a round trip.
 */

/**
 * Accepted domains.
 *
 * `googlemail.com` is the same Google mailbox under an older name, so treating
 * it as a separate provider would reject a legitimate address while doing
 * nothing about abuse.
 */
export const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "googlemail.com"] as const;

/** The domain shown to the user; the alias above is an implementation detail. */
export const PRIMARY_EMAIL_DOMAIN = "gmail.com";

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function isAllowedEmailDomain(email: string): boolean {
  const domain = emailDomain(email);
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

/**
 * Collapses every alias of one Gmail mailbox onto a single string.
 *
 * Gmail ignores dots in the local part and everything after a `+`, so
 * `j.o.h.n+throwaway@gmail.com` and `john@gmail.com` are the same inbox. Without
 * this, one mailbox mints unlimited accounts and unlimited welcome credit — the
 * exact hole the Gmail-only rule is meant to close.
 *
 * Returns `null` for an address outside the allowed domains, so a caller cannot
 * accidentally treat an unrecognised provider as deduplicated.
 */
export function mailboxFingerprint(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!isAllowedEmailDomain(trimmed)) return null;

  const local = trimmed.slice(0, trimmed.lastIndexOf("@"));
  const base = local.split("+")[0].replaceAll(".", "");
  if (!base) return null;

  return `${base}@${PRIMARY_EMAIL_DOMAIN}`;
}

/** Arabic explanation for a rejected address, or `undefined` when it passes. */
export function describeEmailPolicy(email: string): string | undefined {
  if (!email.trim()) return undefined;
  if (isAllowedEmailDomain(email)) return undefined;
  return `نقبل حاليًا عناوين ${PRIMARY_EMAIL_DOMAIN}@ فقط. استخدم بريد Gmail لإنشاء حسابك.`;
}
