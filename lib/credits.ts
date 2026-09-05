import "server-only";

/**
 * Credit balances, the welcome gift, and charging for a run.
 *
 * Every call here runs as the signed-in user against row level security, using
 * the same cookie-bound client as the rest of the auth code. There is no
 * `service_role` key in this project and none is needed: the mutating functions
 * in `supabase/migrations/0001_credits.sql` are SECURITY DEFINER and derive the
 * user from `auth.uid()`, so a caller cannot name someone else's wallet.
 *
 * Nothing here throws. A wallet that cannot be read is reported as "unavailable"
 * rather than as an error, because the generator has to keep working when the
 * migration has not been applied yet — otherwise adding billing would take the
 * whole site down until a SQL script was run by hand.
 */

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { WELCOME_GRANT_CENTS } from "@/lib/billing";
import type { PlanId } from "@/lib/plans";

export interface Wallet {
  balanceCents: number;
  planId: PlanId | null;
  planRenewsAt: string | null;
  /** Null until the welcome gift has been resolved for this account. */
  welcomeGrantedAt: string | null;
  /** Null until the user has actually been shown the gift. */
  welcomeSeenAt: string | null;
}

/** Shown to a signed-in user whose wallet row could not be read. */
export const UNAVAILABLE_WALLET: Wallet = {
  balanceCents: 0,
  planId: null,
  planRenewsAt: null,
  // Not null, so a missing table cannot make the gift modal appear on every load.
  welcomeGrantedAt: "unavailable",
  welcomeSeenAt: "unavailable",
};

interface WalletRow {
  balance_cents: number | null;
  plan_id: string | null;
  plan_renews_at: string | null;
  welcome_granted_at: string | null;
  welcome_seen_at: string | null;
}

function toWallet(row: WalletRow): Wallet {
  return {
    balanceCents: row.balance_cents ?? 0,
    planId: (row.plan_id as PlanId | null) ?? null,
    planRenewsAt: row.plan_renews_at,
    welcomeGrantedAt: row.welcome_granted_at,
    welcomeSeenAt: row.welcome_seen_at,
  };
}

/**
 * Reads the wallet, granting the welcome gift the first time it is missing.
 *
 * The gift is granted on read rather than behind the modal's button on purpose:
 * a user who closes a dialog must not lose $5. The button confirms a gift that is
 * already in the account, which is also why it can never fail.
 */
export async function getWallet(): Promise<Wallet | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wallets")
      .select("balance_cents, plan_id, plan_renews_at, welcome_granted_at, welcome_seen_at")
      .maybeSingle();

    if (error) {
      console.error("[credits] wallet read failed:", error.code ?? error.message);
      return UNAVAILABLE_WALLET;
    }
    if (!data) {
      // No row yet: the trigger runs on sign-up, so this is either a pre-existing
      // account or a first read racing it. Claiming provisions the row.
      return (await claimWelcomeGrant()) ?? UNAVAILABLE_WALLET;
    }

    const wallet = toWallet(data as WalletRow);
    if (wallet.welcomeGrantedAt === null) {
      return (await claimWelcomeGrant()) ?? wallet;
    }
    return wallet;
  } catch (err) {
    console.error("[credits] wallet read threw:", err);
    return UNAVAILABLE_WALLET;
  }
}

/** Just the balance, for the hot path in `/api/generate`. */
export async function getBalanceCents(): Promise<number | null> {
  const wallet = await getWallet();
  return wallet ? wallet.balanceCents : null;
}

/**
 * Claims the welcome gift. Idempotent — a second call grants nothing.
 *
 * Returns the wallet as it stands afterwards, so the caller does not need a
 * second read.
 */
export async function claimWelcomeGrant(): Promise<Wallet | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("claim_welcome_grant", {
      p_amount_cents: WELCOME_GRANT_CENTS,
    });
    if (error) {
      console.error("[credits] welcome grant failed:", error.code ?? error.message);
      return null;
    }

    const { data } = await supabase
      .from("wallets")
      .select("balance_cents, plan_id, plan_renews_at, welcome_granted_at, welcome_seen_at")
      .maybeSingle();

    return data ? toWallet(data as WalletRow) : null;
  } catch (err) {
    console.error("[credits] welcome grant threw:", err);
    return null;
  }
}

/** Records that the gift has been shown, so it stops appearing. */
export async function markWelcomeSeen(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_welcome_seen");
    if (error) console.error("[credits] mark seen failed:", error.code ?? error.message);
  } catch (err) {
    console.error("[credits] mark seen threw:", err);
  }
}

export interface DebitResult {
  /** False when the balance could not cover the charge. */
  charged: boolean;
  /** Balance after the attempt — the current balance when nothing was charged. */
  balanceCents: number;
  /**
   * True when the charge could not be attempted at all (no Supabase, migration
   * not applied, network failure). The caller decides whether to fail closed.
   */
  unavailable?: boolean;
}

/**
 * Charges a run.
 *
 * `reference` makes the call idempotent: a retried request carrying the same
 * reference is charged once, which is what stops a dropped connection from
 * billing twice for one project.
 */
export async function debitCredits(
  amountCents: number,
  metadata: Record<string, string | number | boolean>,
  reference?: string
): Promise<DebitResult> {
  if (!isSupabaseConfigured) return { charged: false, balanceCents: 0, unavailable: true };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("debit_credits", {
      p_amount_cents: amountCents,
      p_reason: "generation",
      p_metadata: metadata,
      p_reference: reference ?? null,
    });

    if (error) {
      console.error("[credits] debit failed:", error.code ?? error.message);
      return { charged: false, balanceCents: 0, unavailable: true };
    }

    // `RETURNS TABLE` arrives as an array of one row.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { charged: false, balanceCents: 0, unavailable: true };

    return {
      charged: Boolean((row as { charged?: boolean }).charged),
      balanceCents: Number((row as { balance_cents?: number }).balance_cents ?? 0),
    };
  } catch (err) {
    console.error("[credits] debit threw:", err);
    return { charged: false, balanceCents: 0, unavailable: true };
  }
}

/**
 * Returns a charge whose work failed.
 *
 * Best-effort by design: the user has already been told their generation failed,
 * and a failed refund must not turn into a second error on top of the first. It
 * is logged loudly instead, because the ledger is where the money is reconciled.
 */
export async function refundCredits(amountCents: number, reference?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("refund_credits", {
      p_amount_cents: amountCents,
      p_reference: reference ?? null,
    });
    if (error) {
      console.error("[credits] REFUND FAILED — reconcile manually:", {
        amountCents,
        reference,
        code: error.code ?? error.message,
      });
    }
  } catch (err) {
    console.error("[credits] REFUND THREW — reconcile manually:", { amountCents, reference, err });
  }
}
