import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/server";
import { getWallet } from "@/lib/credits";
import {
  RUN_COSTS,
  SOLD_OUT_LABEL,
  WELCOME_GRANT_CENTS,
  balanceState,
  formatMoney,
  formatMoneyShort,
  projectsAffordable,
} from "@/lib/billing";
import { MODEL_INFO } from "@/lib/models";
import {
  PLANS,
  bonusPercent,
  planPriceParts,
  planProjects,
  type Plan,
} from "@/lib/plans";
import {
  ArrowForwardIcon,
  BoltIcon,
  CheckIcon,
  CrownIcon,
  GiftIcon,
  LogoMark,
  WalletIcon,
} from "@/components/Icons";

export const metadata: Metadata = {
  title: "الخطط والأسعار — بنّاء",
  description:
    "ابدأ برصيد ترحيبي مجاني بقيمة 5$، ثم اختر خطة شهرية تمنحك رصيدًا أكبر من قيمتها.",
};

export default async function PricingPage() {
  const user = await getSessionUser();
  const wallet = user ? await getWallet() : null;
  const depleted = wallet !== null && balanceState(wallet.balanceCents) === "empty";

  return (
    <main className="relative min-h-dvh overflow-hidden px-5 py-12 sm:px-8">
      <div className="pointer-events-none absolute -top-40 right-[-6%] h-[420px] w-[420px] rounded-full bg-accent/15 blur-[130px] animate-glow-drift" />
      <div
        className="pointer-events-none absolute bottom-[-14%] left-[-8%] h-[380px] w-[380px] rounded-full bg-accent-deep/10 blur-[120px] animate-glow-drift"
        style={{ animationDelay: "-5s" }}
      />

      <div className="animate-fade-up relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 px-3.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <LogoMark className="h-5 w-5" />
            <span>العودة إلى بنّاء</span>
          </Link>

          {wallet && (
            <span className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 px-3.5 py-1.5 text-xs text-ink-muted">
              <WalletIcon className="h-3.5 w-3.5" />
              رصيدك
              {depleted ? (
                <span className="dir-ltr font-bold tracking-wide text-red-300">
                  {SOLD_OUT_LABEL}
                </span>
              ) : (
                <span className="dir-ltr font-bold text-ink">
                  {formatMoney(wallet.balanceCents)}
                </span>
              )}
            </span>
          )}
        </div>

        {depleted && (
          <div
            role="status"
            className="mb-8 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-center"
          >
            <p className="text-sm font-bold text-red-200">نفد رصيدك الترحيبي</p>
            <p className="mt-1.5 text-xs leading-relaxed text-red-200/70">
              كل مشاريعك محفوظة كما هي. اختر خطة وستتابع التعديل من نفس النقطة خلال
              ثوانٍ.
            </p>
          </div>
        )}

        <header className="text-center">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            ابنِ أكثر.{" "}
            <span className="bg-gradient-to-l from-accent to-accent-soft bg-clip-text text-transparent">
              بأقل مما تتوقّع.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-ink-muted">
            كل خطة تمنحك رصيدًا أكبر من سعرها. تدفع مرة في الشهر، وتُنفق الرصيد على ما
            تبنيه فعلًا — لا على ميزات لا تستخدمها.
          </p>

          {!user && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200">
              <GiftIcon className="h-4 w-4" />
              جديد هنا؟ أنشئ حسابًا وخُذ{" "}
              <span className="dir-ltr">{formatMoneyShort(WELCOME_GRANT_CENTS)}</span> رصيدًا
              مجانيًا — بلا بطاقة
            </p>
          )}
        </header>

        <div className="mt-12 grid gap-5 lg:grid-cols-3 lg:items-start">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} signedIn={Boolean(user)} />
          ))}
        </div>

        <CostTable />

        <p className="mt-10 text-center text-xs leading-relaxed text-ink-faint">
          الرصيد يُجدَّد كل شهر مع تجديد الخطة. يمكنك الإلغاء في أي وقت، ومشاريعك تبقى
          لك.
        </p>
      </div>
    </main>
  );
}

function PlanCard({ plan, signedIn }: { plan: Plan; signedIn: boolean }) {
  const { dollars, cents } = planPriceParts(plan);
  const featured = Boolean(plan.highlighted);

  return (
    <section
      className={`relative flex flex-col rounded-3xl border p-6 backdrop-blur transition-colors ${
        featured
          ? "border-accent/50 bg-bg-panel/80 shadow-2xl shadow-accent/10 lg:-mt-4 lg:pb-8 lg:pt-8"
          : "border-border-subtle bg-bg-panel/50 hover:border-border-strong"
      }`}
    >
      {plan.badge && (
        <span className="absolute -top-3 right-6 flex items-center gap-1.5 rounded-full bg-gradient-to-l from-accent to-accent-deep px-3 py-1 text-[11px] font-bold text-white shadow-lg shadow-accent/30">
          <CrownIcon className="h-3.5 w-3.5" />
          {plan.badge}
        </span>
      )}

      <h2 className="dir-ltr text-start text-lg font-bold">{plan.name}</h2>
      <p className="mt-1.5 min-h-[2.5rem] text-xs leading-relaxed text-ink-muted">
        {plan.tagline}
      </p>

      <div className="mt-5 flex items-end gap-1">
        <span className="dir-ltr flex items-start text-4xl font-bold leading-none">
          <span className="mt-1 text-xl">$</span>
          {dollars}
          <span className="mt-1 text-xl">.{cents}</span>
        </span>
        <span className="pb-1 text-xs text-ink-faint">/ شهريًا</span>
      </div>

      {/* The offer in one line: what you pay versus what you get to spend. Derived
          from the numbers, so it cannot drift away from the price above it. */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2">
        <BoltIcon className="h-4 w-4 flex-shrink-0 text-emerald-300" />
        <span className="text-[11px] font-semibold text-emerald-200">
          رصيد <span className="dir-ltr">{formatMoneyShort(plan.creditCents)}</span> — أي
          <span className="dir-ltr"> +{bonusPercent(plan)}%</span> فوق ما تدفعه
        </span>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed">
            <span
              className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                featured ? "bg-accent/20 text-accent" : "bg-bg-panel-soft text-ink-muted"
              }`}
            >
              <CheckIcon className="h-2.5 w-2.5" />
            </span>
            <span className="text-ink-muted">{feature}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[11px] text-ink-faint">
        ≈ {planProjects(plan)} مشاريع كاملة شهريًا
      </p>

      {/* Every plan links to checkout; a signed-out visitor is sent to sign-up first
          so the account exists before there is anything to attach a plan to. */}
      <Link
        href={signedIn ? `/pricing/checkout?plan=${plan.id}` : `/signup?next=${encodeURIComponent(`/pricing/checkout?plan=${plan.id}`)}`}
        className={`mt-5 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
          featured
            ? "bg-gradient-to-l from-accent to-accent-deep text-white shadow-lg shadow-accent/20 hover:shadow-accent/40"
            : "border border-border-strong bg-bg-panel/70 text-ink hover:border-accent/40"
        }`}
      >
        اختر {plan.name}
        <ArrowForwardIcon className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

/**
 * What each model costs per run.
 *
 * Published rather than buried: a metered product that hides its meter feels like
 * one that is cheating. It also does the selling — the gap between the flagship and
 * the cheaper models is a real reason to stay inside a plan for longer.
 */
function CostTable() {
  return (
    <section className="mt-14 rounded-3xl border border-border-subtle bg-bg-panel/40 p-6 backdrop-blur sm:p-8">
      <h2 className="text-base font-bold">تكلفة كل طلب، بلا مفاجآت</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        تُخصم القيمة عند بدء الطلب، وتُعاد بالكامل إذا فشل أو ألغيته. الرصيد الترحيبي{" "}
        <span className="dir-ltr">{formatMoneyShort(WELCOME_GRANT_CENTS)}</span> يكفي لنحو{" "}
        {projectsAffordable(WELCOME_GRANT_CENTS)} مشاريع كاملة على النموذج الأقوى.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[420px] text-start text-xs">
          <thead>
            <tr className="text-ink-faint">
              <th className="pb-2.5 text-start font-medium">النموذج</th>
              <th className="pb-2.5 text-start font-medium">مشروع جديد</th>
              <th className="pb-2.5 text-start font-medium">تعديل</th>
              <th className="pb-2.5 text-start font-medium">إصلاح تلقائي</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_INFO.map((model) => {
              const cost = RUN_COSTS[model.id];
              return (
                <tr key={model.id} className="border-t border-border-subtle">
                  <td className="dir-ltr py-2.5 text-start font-semibold">{model.name}</td>
                  <td className="dir-ltr py-2.5 text-start text-ink-muted">
                    {formatMoney(cost.create)}
                  </td>
                  <td className="dir-ltr py-2.5 text-start text-ink-muted">
                    {formatMoney(cost.edit)}
                  </td>
                  <td className="dir-ltr py-2.5 text-start text-ink-muted">
                    {formatMoney(cost.repair)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
