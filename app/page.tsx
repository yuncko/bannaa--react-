import AppShell from "@/components/AppShell";
import WelcomeGift from "@/components/billing/WelcomeGift";
import { getSessionUser } from "@/lib/supabase/server";
import { getWallet } from "@/lib/credits";
import { shouldShowWelcomeGift } from "@/lib/billing";

// The session and the wallet are read here rather than in the shell so the account
// chip and the balance are both correct in the first HTML response instead of
// appearing after hydration.
export default async function Home() {
  const user = await getSessionUser();
  // Reading the wallet is also what grants the welcome credit, so it must not be
  // attempted for a visitor who has no account to grant it to.
  const wallet = user ? await getWallet() : null;

  return (
    <>
      <AppShell user={user} wallet={wallet} />
      {shouldShowWelcomeGift(wallet) && <WelcomeGift />}
    </>
  );
}
