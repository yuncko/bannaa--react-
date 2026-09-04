/**
 * Shared chrome for the auth screens.
 *
 * A split layout: the form on one side, a showcase panel on the other that
 * carries the same warm glow and gradient language as the hero. Below `lg` the
 * showcase is dropped rather than stacked — on a phone it would push the form
 * below the fold, and signing in is the only thing that matters there.
 */

import Link from "next/link";
import { CheckIcon, LogoMark, SparkleIcon } from "@/components/Icons";

const HIGHLIGHTS = [
  "وصف واحد بالعربية يكفي لبناء تطبيق React كامل",
  "معاينة حيّة تعمل داخل المتصفح بلا إعداد",
  "تعديلات لاحقة بالمحادثة، مع حفظ كل إصدار",
  "تنزيل المشروع كملف مضغوط جاهز للتطوير",
];

interface AuthLayoutProps {
  /** Small label above the title, e.g. "مرحبًا بعودتك". */
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
  /** Sign-in ⇄ sign-up cross link under the card. */
  footer?: React.ReactNode;
}

export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div className="pointer-events-none absolute -top-44 right-[-10%] h-[460px] w-[460px] rounded-full bg-accent/20 blur-[140px] animate-glow-drift" />
      <div
        className="pointer-events-none absolute bottom-[-20%] left-[-12%] h-[420px] w-[420px] rounded-full bg-accent-deep/15 blur-[130px] animate-glow-drift"
        style={{ animationDelay: "-5s" }}
      />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border-subtle bg-bg-panel/60 shadow-2xl shadow-black/50 backdrop-blur-xl lg:grid-cols-[1.05fr_1fr]">
        <section className="animate-fade-up flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12">
          <Link
            href="/"
            className="mb-8 flex w-fit items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 px-3.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <LogoMark className="h-5 w-5" />
            <span>بنّاء</span>
          </Link>

          <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <SparkleIcon className="h-3.5 w-3.5" />
            {eyebrow}
          </p>
          <h1 className="mt-2.5 text-2xl font-bold leading-[1.4] sm:text-3xl">{title}</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-7 text-center text-sm text-ink-muted">{footer}</div>}
        </section>

        {/* Decorative — hidden from assistive tech so the form is the whole page. */}
        <aside
          aria-hidden="true"
          className="relative hidden flex-col justify-between overflow-hidden border-r border-border-subtle bg-gradient-to-br from-accent/12 via-bg-panel-soft to-bg-elevated p-10 lg:flex"
        >
          <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-accent/25 blur-[90px]" />

          <div className="relative">
            <LogoMark className="h-11 w-11" />
            <h2 className="mt-6 text-xl font-bold leading-[1.5]">
              صِف تطبيقك،
              <br />
              <span className="bg-gradient-to-l from-accent to-accent-soft bg-clip-text text-transparent">
                وشاهده يُبنى أمامك
              </span>
            </h2>
            <ul className="mt-7 space-y-3.5">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-muted">
                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <CheckIcon className="h-2.5 w-2.5" />
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-10 rounded-2xl border border-border-subtle bg-bg-panel/50 p-4">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-faint/30" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 w-4/5 rounded-full bg-white/8 animate-shimmer" />
              <div className="h-2 w-3/5 rounded-full bg-white/8 animate-shimmer" />
              <div className="h-2 w-2/3 rounded-full bg-white/8 animate-shimmer" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
