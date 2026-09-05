/**
 * The plans, and the story each one tells.
 *
 * Three prices, not seven. The middle one is the recommendation and is priced to
 * be the obvious answer — it carries the best credit-per-dollar of the two lower
 * tiers, so "most popular" is a fact about the value, not a sticker we stuck on
 * it. The cheapest tier exists to make the middle one look reasonable; the top
 * tier exists to make it look safe.
 *
 * Client-safe: the pricing page and the top-up prompts both read this.
 */

import { CENTS_PER_DOLLAR, formatMoney, projectsAffordable } from "./billing.ts";

export type PlanId = "go" | "premium" | "premium_plus";

export interface Plan {
  id: PlanId;
  /** Latin name, shown as-is in the RTL layout. */
  name: string;
  /** Monthly price in cents. */
  priceCents: number;
  /** Credit granted each month, in cents. Above the price — that is the offer. */
  creditCents: number;
  /** One line on who this is for. */
  tagline: string;
  features: readonly string[];
  /** The single visual emphasis on the pricing page. Exactly one plan sets this. */
  highlighted?: boolean;
  /** Ribbon copy, e.g. "الأكثر شعبية". */
  badge?: string;
}

export const PLANS: readonly Plan[] = [
  {
    id: "go",
    name: "Go",
    priceCents: 14_99,
    creditCents: 18_00,
    tagline: "للبدء الجدّي بعد أن انتهت التجربة.",
    features: [
      "رصيد شهري بقيمة 18$ — أكثر مما تدفع",
      "كل النماذج متاحة، بدون قيود",
      "معاينة حيّة وتصحيح تلقائي للأخطاء",
      "تنزيل المشروع كملف ZIP جاهز",
      "سجل إصدارات كامل لكل مشروع",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceCents: 20_00,
    creditCents: 28_00,
    tagline: "الخيار الذي يختاره معظم الناس — أفضل قيمة لكل دولار.",
    features: [
      "رصيد شهري بقيمة 28$ — أعلى قيمة لكل دولار",
      "أولوية في التوليد وقت الذروة",
      "مشاريع أكبر وتعديلات غير محدودة عمليًا",
      "قوالب تصميم احترافية جاهزة",
      "كل ما في Go",
    ],
    highlighted: true,
    badge: "الأكثر شعبية",
  },
  {
    id: "premium_plus",
    name: "Premium+",
    priceCents: 29_99,
    creditCents: 48_00,
    tagline: "لمن يبني كل يوم، ويريد من يسانده.",
    features: [
      "رصيد شهري بقيمة 48$ — الأعلى على الإطلاق",
      "دعم مباشر من فريق بنّاء",
      "تصاميم احترافية مُعدّة خصيصًا لمشروعك",
      "أعلى أولوية في الطابور دائمًا",
      "وصول مبكر إلى كل ميزة جديدة",
      "كل ما في Premium",
    ],
  },
] as const;

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** The plan we recommend, resolved from the data rather than hard-coded twice. */
export const RECOMMENDED_PLAN: Plan =
  PLANS.find((p) => p.highlighted) ?? PLANS[0];

/**
 * Extra credit as a percentage of the price, e.g. `40` for "+40%".
 *
 * Derived, never written down: a price change must not be able to leave a stale
 * promise on the page.
 */
export function bonusPercent(plan: Plan): number {
  return Math.round(((plan.creditCents - plan.priceCents) / plan.priceCents) * 100);
}

/** "$14.99" */
export function planPriceLabel(plan: Plan): string {
  return formatMoney(plan.priceCents);
}

/** Whole dollars, for the oversized numeral on a pricing card. */
export function planPriceParts(plan: Plan): { dollars: string; cents: string } {
  return {
    dollars: String(Math.floor(plan.priceCents / CENTS_PER_DOLLAR)),
    cents: String(plan.priceCents % CENTS_PER_DOLLAR).padStart(2, "0"),
  };
}

/** Roughly how many finished projects a month on this plan buys. */
export function planProjects(plan: Plan): number {
  return projectsAffordable(plan.creditCents);
}
