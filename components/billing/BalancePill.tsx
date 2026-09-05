"use client";

/**
 * The balance, wherever it needs to be small.
 *
 * Three states, because a number alone does not tell a user what to do: healthy is
 * quiet, low is a nudge, and empty is a link to the only thing that fixes it. The
 * empty state carries the `SOLD OUT` stamp the same way the profile card does, so
 * the two never disagree about what "empty" looks like.
 */

import Link from "next/link";
import {
  SOLD_OUT_LABEL,
  balanceState,
  formatMoney,
  type BalanceState,
} from "@/lib/billing";
import { WalletIcon } from "@/components/Icons";

const TONE: Record<BalanceState, string> = {
  healthy: "border-border-subtle bg-bg-panel/60 text-ink-muted hover:border-accent/40 hover:text-ink",
  low: "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:border-amber-400/70",
  empty: "border-red-400/40 bg-red-500/10 text-red-200 hover:border-red-400/70",
};

export default function BalancePill({
  balanceCents,
  className = "",
}: {
  balanceCents: number;
  className?: string;
}) {
  const state = balanceState(balanceCents);

  return (
    <Link
      href="/pricing"
      title={state === "empty" ? "نفد رصيدك — اختر خطة للمتابعة" : "رصيدك المتاح"}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${TONE[state]} ${className}`}
    >
      <WalletIcon className="h-3.5 w-3.5 flex-shrink-0" />
      {state === "empty" ? (
        <span className="dir-ltr text-[10px] font-bold tracking-wide">{SOLD_OUT_LABEL}</span>
      ) : (
        <span className="dir-ltr">{formatMoney(balanceCents)}</span>
      )}
    </Link>
  );
}
