import AppShell from "@/components/AppShell";
import { getSessionUser } from "@/lib/supabase/server";

// The session is read here rather than in the shell so the account chip is
// correct in the first HTML response instead of appearing after hydration.
export default async function Home() {
  const user = await getSessionUser();
  return <AppShell user={user} />;
}
