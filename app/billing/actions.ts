"use server";

/**
 * Billing server actions.
 *
 * Deliberately thin: the money lives in Postgres and every mutation goes through
 * a SECURITY DEFINER function that derives the account from `auth.uid()`, so an
 * action never takes a user id as an argument. There is nothing here a caller
 * could point at somebody else's wallet.
 */

import { revalidatePath } from "next/cache";
import { claimWelcomeGrant, markWelcomeSeen } from "@/lib/credits";

/**
 * Retires the welcome dialog.
 *
 * Called by every exit from it — the button, the `×`, the backdrop — because the
 * credit was granted when the wallet was first read, not by this call. Accepting
 * the gift and postponing it therefore end in the same place, and a dialog that
 * says "here is $5" should not come back to say it again.
 */
export async function dismissWelcomeGift(): Promise<void> {
  // Claiming first covers the one case the read path can miss: a wallet row that
  // was provisioned by the sign-up trigger while the first page render was
  // already in flight. Idempotent, so a second call grants nothing.
  await claimWelcomeGrant();
  await markWelcomeSeen();
  // The balance chip is rendered from the server, so the layout has to re-render
  // or it keeps showing the number from before the grant.
  revalidatePath("/", "layout");
}
