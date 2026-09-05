"use client";

/**
 * The welcome gift dialog.
 *
 * A light card on a dark site, deliberately: this is the one surface that is not
 * part of the workspace, and the contrast is what makes it read as something handed
 * to you rather than another panel the app drew.
 *
 * The $5 is already in the account before this ever opens — the grant happens the
 * first time the wallet is read (`lib/credits.ts`). So every exit does the same
 * thing and none of them can fail: closing a dialog must not cost the user money.
 * The button confirms a gift, it does not perform one.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { dismissWelcomeGift } from "@/app/billing/actions";
import {
  WELCOME_GRANT_CENTS,
  WELCOME_PERKS,
  formatMoneyShort,
  projectsAffordable,
} from "@/lib/billing";
import { CheckIcon, CloseIcon } from "@/components/Icons";
import GiftArtwork from "./GiftArtwork";

const AMOUNT = formatMoneyShort(WELCOME_GRANT_CENTS);

export default function WelcomeGift() {
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();
  const settled = useRef(false);
  const ctaRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    // Escape, the backdrop, the `×`, and both buttons all land here; without the
    // guard a second dismiss would fire the action again.
    if (settled.current) return;
    settled.current = true;
    setOpen(false);
    startTransition(async () => {
      await dismissWelcomeGift();
    });
  }, []);

  useEffect(() => {
    ctaRef.current?.focus();

    const restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = restoreOverflow;
    };
  }, [close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-gift-title"
        className="animate-fade-up relative w-full max-w-[420px] overflow-hidden rounded-[24px] bg-white shadow-2xl shadow-black/60"
      >
        <div className="relative bg-white">
          <GiftArtwork className="block h-[164px] w-full" />

          {/* Inline-end, so it mirrors with the layout. The picture puts it at the
              top-right of an LTR card; the right-hand side of an RTL one is where
              the heading starts. */}
          <button
            type="button"
            onClick={close}
            aria-label="إغلاق"
            className="absolute end-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white transition-opacity hover:opacity-80"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="welcome-gift-title"
              className="text-[21px] font-extrabold leading-snug tracking-tight text-slate-900"
            >
              هديّة ترحيبية خاصة بك!
            </h2>
            <span className="mt-1 flex-shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
              رصيد <span className="dir-ltr inline-block">{AMOUNT}</span> مجانًا
            </span>
          </div>

          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            شكرًا لانضمامك إلينا! هذه <span className="dir-ltr inline-block">{AMOUNT}</span> منّا
            لتجرّب أقوى ميزات الذكاء الاصطناعي — تكفي لبناء{" "}
            {projectsAffordable(WELCOME_GRANT_CENTS)} مشاريع كاملة.
          </p>

          <h3 className="mt-5 text-[13px] font-bold text-teal-600">
            وصولك المميّز يشمل:
          </h3>

          <ul className="mt-3 space-y-2.5">
            {WELCOME_PERKS.map((perk) => (
              <li key={perk.title} className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-900">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-slate-900">
                    {perk.title}
                  </span>
                  <span className="block text-[12px] leading-snug text-slate-500">
                    {perk.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <button
            ref={ctaRef}
            type="button"
            onClick={close}
            className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            استلم <span className="dir-ltr inline-block">{AMOUNT}</span> الآن
          </button>

          <button
            type="button"
            onClick={close}
            className="mt-3 w-full text-center text-[12px] font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            ربما لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
}
