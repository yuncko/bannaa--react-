/**
 * Credit economics: what a run costs, what the welcome gift buys, what the plans
 * are worth.
 *
 * Client-safe — the pricing page, the balance chip, and the welcome modal all read
 * from here, so it must never contain credentials or server-only logic. The
 * authoritative arithmetic still happens in Postgres (see
 * `supabase/migrations/0001_credits.sql`); this module is the single source of the
 * *numbers* both sides agree on.
 *
 * Everything is integer cents. Money in floating point drifts — `0.1 + 0.2` is
 * not `0.3` — and a drifting balance is a billing dispute.
 */

import { MODEL_INFO, MODELS, isKnownModel, type ModelId } from "./models.ts";

/** Cents per dollar. Named so the intent is visible at the call sites. */
export const CENTS_PER_DOLLAR = 100;

/** The welcome gift: $5.00, granted once per real mailbox. */
export const WELCOME_GRANT_CENTS = 5_00;

/**
 * The wallet as the UI sees it.
 *
 * Declared here rather than in `lib/credits.ts` because client components need the
 * shape and that module is `server-only`. A type-only import would compile today
 * but would break the moment someone reached for a value from it.
 */
export interface WalletView {
  balanceCents: number;
  planId: string | null;
  planRenewsAt: string | null;
  /** Null until the welcome gift has been resolved for this account. */
  welcomeGrantedAt: string | null;
  /** Null until the user has actually been shown the gift. */
  welcomeSeenAt: string | null;
}

/**
 * Should the welcome dialog open?
 *
 * Both timestamps must be *readable* for this to be true. An unreachable wallet
 * reports the sentinel `"unavailable"` rather than null precisely so a missing
 * table cannot pop a "here is $5" dialog on every page load.
 */
export function shouldShowWelcomeGift(wallet: WalletView | null): boolean {
  if (!wallet) return false;
  return wallet.welcomeGrantedAt !== null && wallet.welcomeSeenAt === null;
}

/** One line in the welcome dialog. */
export interface GiftPerk {
  title: string;
  description: string;
}

/**
 * What the gift unlocks, in the order the dialog lists it.
 *
 * The names come from `MODEL_INFO` so a rename cannot leave a stale promise in the
 * dialog, but the descriptions are written for this moment rather than reused from
 * the picker: the picker warns you that a model may be slower, and a gift is not
 * the place to hedge.
 */
export const WELCOME_PERKS: readonly GiftPerk[] = [
  { title: MODEL_INFO[0].name, description: "استدلال متقدّم وقدرة تحليلية عالية" },
  { title: MODEL_INFO[1].name, description: "سريع وذكي وعالي الاستجابة" },
  { title: MODEL_INFO[2].name, description: "إبداعي، دقيق، ويفهم السياق" },
  { title: MODEL_INFO[3].name, description: "مساعدك الذكي لكل مهمة" },
  { title: "معاينة حيّة وإصلاح تلقائي", description: "أقوى ما نقدّمه حتى الآن" },
] as const;

/** What a single run costs, by model and by kind of run. */
export interface RunCost {
  /** A brand-new project from a prompt. */
  create: number;
  /** A follow-up modification of an existing project. */
  edit: number;
  /**
   * An automatic fix after the preview crashed.
   *
   * Discounted, not free. Free would be the honest price — the crash was not the
   * user's doing — but the client decides what counts as a repair, so a free lane
   * is a forgeable one. Halving it keeps the incentive to cheat small and the
   * worst case bounded: a failed generation costs `create + 2 × repair`, since the
   * client caps automatic attempts at two.
   */
  repair: number;
}

/**
 * Per-model prices.
 *
 * Ordered like `MODELS`, cheapest capability last. The spread is deliberate: it
 * gives a user on a thin balance a real way to keep working instead of a wall.
 */
export const RUN_COSTS: Record<ModelId, RunCost> = {
  "claude-sonnet-5": { create: 45, edit: 25, repair: 12 },
  "claude-sonnet-4-6": { create: 30, edit: 18, repair: 9 },
  "gpt-5-6-luna": { create: 25, edit: 15, repair: 8 },
  "gpt-5-6-terra": { create: 25, edit: 15, repair: 8 },
};

export type RunKind = keyof RunCost;

/**
 * Price of one run, in cents.
 *
 * An unrecognised `modelId` is charged the *highest* price rather than a default
 * one. The API accepts `modelId` unvalidated, so any fallback that is cheaper
 * than the flagship turns a typo into a discount.
 *
 * The membership test is `isKnownModel`, not `modelId in RUN_COSTS`: `in` walks
 * the prototype chain, so `"constructor"` would "exist" and index to a function
 * whose `.create` is `undefined` — a request that costs `NaN`.
 *
 * The price follows the model the user *asked for*, not the one that ended up
 * serving the request after provider failover. Failover is our problem, and a
 * bill that changes because our first choice was down is not a bill anyone can
 * predict.
 */
export function costForRun(modelId: string | undefined, kind: RunKind): number {
  const costs = modelId && isKnownModel(modelId) ? RUN_COSTS[modelId] : mostExpensiveCost();
  return costs[kind];
}

function mostExpensiveCost(): RunCost {
  return MODELS.map((id) => RUN_COSTS[id]).reduce((a, b) =>
    b.create > a.create ? b : a
  );
}

/** `500` → `"$5.00"`. Latin numerals: it is a price, and the site renders those LTR. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / CENTS_PER_DOLLAR)}.${String(abs % CENTS_PER_DOLLAR).padStart(2, "0")}`;
}

/**
 * `500` → `"$5"`, `1499` → `"$14.99"`.
 *
 * For headlines and badges, where trailing zeros are noise. Prices in a table keep
 * `formatMoney` so the decimal points line up.
 */
export function formatMoneyShort(cents: number): string {
  return cents % CENTS_PER_DOLLAR === 0
    ? `${cents < 0 ? "-" : ""}$${Math.abs(cents) / CENTS_PER_DOLLAR}`
    : formatMoney(cents);
}

/**
 * How many complete projects a balance buys, for honest marketing copy.
 *
 * A "complete project" is one generation plus four edits on the flagship model —
 * which is what building something real actually looks like. Computed rather than
 * written into the copy so the promise cannot drift away from the price list.
 *
 * Clamped at zero: an overdrawn wallet would otherwise floor to a negative count,
 * and "‑1 projects" is a sentence no user should ever be shown.
 */
export function projectsAffordable(
  cents: number,
  modelId: ModelId = "claude-sonnet-5"
): number {
  const { create, edit } = RUN_COSTS[modelId];
  return Math.max(0, Math.floor(cents / (create + edit * 4)));
}

export type BalanceState = "healthy" | "low" | "empty";

/** Below this share of the welcome gift, the balance chip starts warning. */
const LOW_BALANCE_RATIO = 0.3;

export function balanceState(cents: number): BalanceState {
  if (cents <= 0) return "empty";
  if (cents < WELCOME_GRANT_CENTS * LOW_BALANCE_RATIO) return "low";
  return "healthy";
}

/** Can this balance cover the cheapest thing the user could ask for? */
export function canAffordAnything(cents: number): boolean {
  const cheapest = Math.min(...MODELS.map((id) => RUN_COSTS[id].repair));
  return cents >= cheapest;
}

/**
 * The label for a depleted balance.
 *
 * The user asked for a "sold" label. `SOLD OUT` is the English original because it
 * is the phrase they specified, and it reads as a stamp rather than a sentence —
 * which is what it is.
 */
export const SOLD_OUT_LABEL = "SOLD OUT";

/** What a run of each kind costs on the flagship model, for the pricing copy. */
export function flagshipCosts(): RunCost {
  return RUN_COSTS[MODELS[0]];
}
