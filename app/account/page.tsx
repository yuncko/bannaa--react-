import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getWallet } from "@/lib/credits";
import { signOut } from "@/app/auth/actions";
import {
  SOLD_OUT_LABEL,
  WELCOME_GRANT_CENTS,
  balanceState,
  formatMoney,
  formatMoneyShort,
  projectsAffordable,
  type WalletView,
} from "@/lib/billing";
import { findPlan } from "@/lib/plans";
import {
  CheckIcon,
  GiftIcon,
  LockIcon,
  LogOutIcon,
  LogoMark,
  MailIcon,
  ShieldIcon,
  UserIcon,
  WalletIcon,
} from "@/components/Icons";

export const metadata: Metadata = {
  title: "حسابي — بنّاء",
  description: "إدارة حسابك ورصيدك في بنّاء.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const [{ updated }, user] = await Promise.all([searchParams, getSessionUser()]);

  // The proxy already gates `/account`, but re-checking here is what actually
  // protects the data: a matcher change or a direct render would otherwise slip
  // through. Cheap, and it removes the dependency on routing config.
  if (!user) redirect("/login?error=session_required&next=%2Faccount");

  const wallet = await getWallet();
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <main className="relative flex min-h-dvh justify-center overflow-hidden px-5 py-12 sm:px-8">
      <div className="pointer-events-none absolute -top-40 right-[-8%] h-[420px] w-[420px] rounded-full bg-accent/15 blur-[130px] animate-glow-drift" />

      <div className="animate-fade-up relative z-10 w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 px-3.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <LogoMark className="h-5 w-5" />
            <span>العودة إلى بنّاء</span>
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-red-400/40 hover:text-red-300"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              تسجيل الخروج
            </button>
          </form>
        </div>

        {updated === "password" && (
          <div
            role="status"
            className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200"
          >
            <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />
            تم تحديث كلمة المرور بنجاح.
          </div>
        )}

        <section className="rounded-3xl border border-border-subtle bg-bg-panel/60 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary per OAuth provider; next/image would need every one allow-listed in next.config.
              <img
                src={user.avatarUrl}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-2xl border border-border-subtle object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep text-xl font-bold text-white">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{user.name ?? "حسابي"}</h1>
              <p className="dir-ltr truncate text-start text-sm text-ink-muted">
                {user.email}
              </p>
            </div>
          </div>

          <dl className="mt-7 space-y-3">
            <Row icon={<UserIcon className="h-4 w-4" />} label="مُعرّف المستخدم">
              <span className="dir-ltr font-code text-xs text-ink-muted">{user.id}</span>
            </Row>
            <Row icon={<MailIcon className="h-4 w-4" />} label="البريد الإلكتروني">
              <span className="dir-ltr text-sm">{user.email ?? "—"}</span>
            </Row>
          </dl>

          <div className="mt-7 flex flex-wrap gap-2.5 border-t border-border-subtle pt-6">
            <Link
              href="/account/password"
              className="flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-panel/70 px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent/40"
            >
              <LockIcon className="h-4 w-4 text-accent" />
              تغيير كلمة المرور
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-accent to-accent-deep px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-shadow hover:shadow-accent/40"
            >
              <ShieldIcon className="h-4 w-4" />
              ابدأ مشروعًا جديدًا
            </Link>
          </div>
        </section>

        {wallet && <BalanceCard wallet={wallet} />}
      </div>
    </main>
  );
}

/**
 * The balance, on the profile, with the depleted state called out.
 *
 * `SOLD OUT` replaces the number rather than sitting next to it: `$0.00` and a
 * stamp saying the same thing twice is noise, and the stamp is the part that
 * explains why nothing is generating.
 */
function BalanceCard({ wallet }: { wallet: WalletView }) {
  const state = balanceState(wallet.balanceCents);
  const plan = wallet.planId ? findPlan(wallet.planId) : undefined;
  const projects = projectsAffordable(wallet.balanceCents);
  // The sentinel from an unreadable wallet is a non-null string too, so this is
  // "we know a grant happened" rather than "we could not tell".
  const gifted = wallet.welcomeGrantedAt !== null && wallet.welcomeGrantedAt !== "unavailable";

  return (
    <section className="mt-6 rounded-3xl border border-border-subtle bg-bg-panel/60 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <WalletIcon className="h-4 w-4 text-accent" />
            الرصيد
          </h2>
          <p className="mt-1.5 text-xs text-ink-faint">
            {plan ? (
              <>
                خطة <span className="dir-ltr font-semibold text-ink-muted">{plan.name}</span>
                {wallet.planRenewsAt && <> — تتجدّد تلقائيًا</>}
              </>
            ) : (
              "لا توجد خطة نشطة — أنت على الرصيد الترحيبي"
            )}
          </p>
        </div>

        {state === "empty" ? (
          <span className="dir-ltr flex-shrink-0 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold tracking-wider text-red-300">
            {SOLD_OUT_LABEL}
          </span>
        ) : (
          <span
            className={`dir-ltr flex-shrink-0 text-3xl font-bold leading-none ${
              state === "low" ? "text-amber-300" : "text-ink"
            }`}
          >
            {formatMoney(wallet.balanceCents)}
          </span>
        )}
      </div>

      {/* A bar against the welcome grant, not against a plan: it is the yardstick
          every account starts with, so the same drawing means the same thing to
          everyone. It clamps rather than overflowing on a topped-up balance. */}
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-bg-panel-soft">
        <div
          className={`h-full rounded-full transition-all ${
            state === "empty"
              ? "bg-red-400/60"
              : state === "low"
                ? "bg-amber-400"
                : "bg-gradient-to-l from-accent to-accent-soft"
          }`}
          style={{
            width: `${Math.min(100, Math.max(2, (wallet.balanceCents / WELCOME_GRANT_CENTS) * 100))}%`,
          }}
        />
      </div>

      {state === "empty" ? (
        <>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            نفد رصيدك، ولا يمكن بدء طلبات جديدة حتى تشترك. كل مشاريعك السابقة محفوظة
            ولن تفقد شيئًا.
          </p>
          <Link
            href="/pricing"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-accent to-accent-deep px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-shadow hover:shadow-accent/40"
          >
            <WalletIcon className="h-4 w-4" />
            اشترك لمتابعة البناء
          </Link>
        </>
      ) : (
        <>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            {projects > 0
              ? `يكفي لنحو ${projects} مشاريع كاملة على النموذج الأقوى.`
              : "يكفي لتعديلات قليلة — يُنصح بالاشتراك قبل أن ينفد."}
          </p>
          {gifted && !plan && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300/80">
              <GiftIcon className="h-3.5 w-3.5" />
              حصلت على{" "}
              <span className="dir-ltr">{formatMoneyShort(WELCOME_GRANT_CENTS)}</span> رصيدًا
              ترحيبيًا مجانيًا
            </p>
          )}
          <Link
            href="/pricing"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-panel/70 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-accent/40"
          >
            <WalletIcon className="h-4 w-4 text-accent" />
            {plan ? "إدارة الخطة" : "استعرض الخطط"}
          </Link>
        </>
      )}
    </section>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-panel-soft/40 px-3.5 py-2.5">
      <dt className="flex flex-shrink-0 items-center gap-2 text-xs text-ink-muted">
        <span className="text-ink-faint">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}
