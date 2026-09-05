import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { findPlan, bonusPercent, planPriceLabel, planProjects } from "@/lib/plans";
import { formatMoneyShort } from "@/lib/billing";
import {
  ArrowForwardIcon,
  CheckIcon,
  LogoMark,
  ShieldIcon,
  WarningIcon,
} from "@/components/Icons";

export const metadata: Metadata = {
  title: "إتمام الاشتراك — بنّاء",
  // Nothing here should ever surface in a search result.
  robots: { index: false, follow: false },
};

/**
 * Plan confirmation.
 *
 * No payment provider is connected to this deployment, so this page stops at the
 * summary and says so. That is deliberate: the alternative — a button that credits
 * the wallet because someone clicked it — is a free-money endpoint, and it would be
 * reachable by anyone with an account. Credit is only ever granted by the welcome
 * grant (once, per mailbox) until a provider's webhook can vouch for a payment.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const [{ plan: planId }, user] = await Promise.all([searchParams, getSessionUser()]);

  const plan = planId ? findPlan(planId) : undefined;
  if (!plan) notFound();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/pricing/checkout?plan=${plan.id}`)}`
    );
  }

  return (
    <main className="relative flex min-h-dvh justify-center overflow-hidden px-5 py-12 sm:px-8">
      <div className="pointer-events-none absolute -top-40 right-[-8%] h-[420px] w-[420px] rounded-full bg-accent/15 blur-[130px] animate-glow-drift" />

      <div className="animate-fade-up relative z-10 w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 px-3.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <LogoMark className="h-5 w-5" />
            <span>العودة إلى الخطط</span>
          </Link>
        </div>

        <section className="rounded-3xl border border-border-subtle bg-bg-panel/60 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <p className="text-xs text-ink-faint">الخطة المختارة</p>
          <h1 className="dir-ltr mt-1 text-start text-2xl font-bold">{plan.name}</h1>

          <dl className="mt-6 space-y-3">
            <Row label="السعر الشهري">
              <span className="dir-ltr font-bold">{planPriceLabel(plan)}</span>
            </Row>
            <Row label="الرصيد الشهري">
              <span className="dir-ltr font-bold text-emerald-300">
                {formatMoneyShort(plan.creditCents)}
              </span>
            </Row>
            <Row label="القيمة الإضافية">
              <span className="dir-ltr font-bold text-emerald-300">
                +{bonusPercent(plan)}%
              </span>
            </Row>
            <Row label="يكفي لنحو">
              <span>{planProjects(plan)} مشاريع كاملة</span>
            </Row>
          </dl>

          <ul className="mt-6 space-y-2 border-t border-border-subtle pt-5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <CheckIcon className="h-2.5 w-2.5" />
                </span>
                <span className="text-ink-muted">{feature}</span>
              </li>
            ))}
          </ul>

          <div
            role="status"
            className="mt-7 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-3"
          >
            <WarningIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <div className="text-xs leading-relaxed text-amber-100/90">
              <p className="font-bold text-amber-200">بوابة الدفع غير مربوطة بعد</p>
              <p className="mt-1">
                لم يُضبط مزوّد دفع على هذا الخادم، فلا يمكن إتمام الاشتراك الآن. لن
                يُضاف أي رصيد إلى حسابك دون عملية دفع مؤكَّدة — وهذا مقصود.
              </p>
            </div>
          </div>

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-ink-faint">
            <ShieldIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            لا نخزّن بيانات بطاقتك على أي حال؛ عند ربط المزوّد ستُتمّ عملية الدفع على
            صفحته الآمنة، ويُضاف الرصيد تلقائيًا بعد تأكيده.
          </p>

          <Link
            href="/"
            className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-panel/70 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-accent/40"
          >
            العودة إلى بنّاء
            <ArrowForwardIcon className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-bg-panel-soft/40 px-3.5 py-2.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
