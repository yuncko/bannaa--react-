import test from "node:test";
import assert from "node:assert/strict";
import { MODELS } from "../lib/models.ts";
import {
  CENTS_PER_DOLLAR,
  RUN_COSTS,
  SOLD_OUT_LABEL,
  WELCOME_GRANT_CENTS,
  WELCOME_PERKS,
  balanceState,
  canAffordAnything,
  costForRun,
  flagshipCosts,
  formatMoney,
  formatMoneyShort,
  projectsAffordable,
  shouldShowWelcomeGift,
  type WalletView,
} from "../lib/billing.ts";
import {
  PLANS,
  RECOMMENDED_PLAN,
  bonusPercent,
  findPlan,
  planPriceLabel,
  planPriceParts,
  planProjects,
} from "../lib/plans.ts";

/* ── The gift ── */

test("the welcome grant is exactly $5", () => {
  assert.equal(WELCOME_GRANT_CENTS, 500);
  assert.equal(formatMoneyShort(WELCOME_GRANT_CENTS), "$5");
});

test("the gift is worth a real number of projects, not a token", () => {
  // The whole pitch is "build something today". One project would not be a gift.
  assert.ok(
    projectsAffordable(WELCOME_GRANT_CENTS) >= 3,
    `$5 should buy at least 3 projects, buys ${projectsAffordable(WELCOME_GRANT_CENTS)}`
  );
});

test("the gift runs out — it is a trial, not a free tier", () => {
  const { create, edit } = flagshipCosts();
  const spend = create + edit * 4;
  assert.ok(spend > 0);
  // Bounded above so the grant cannot quietly become an unlimited plan.
  assert.ok(
    projectsAffordable(WELCOME_GRANT_CENTS) <= 6,
    "a grant that buys more than six projects has stopped being a trial"
  );
});

test("the gift dialog lists five perks, as the design requires", () => {
  assert.equal(WELCOME_PERKS.length, 5);
  for (const perk of WELCOME_PERKS) {
    assert.ok(perk.title.trim().length > 0, "every row needs a name");
    assert.ok(perk.description.trim().length > 0, "every row needs its one line");
  }
});

/* ── Showing the dialog ── */

function wallet(patch: Partial<WalletView> = {}): WalletView {
  return {
    balanceCents: WELCOME_GRANT_CENTS,
    planId: null,
    planRenewsAt: null,
    welcomeGrantedAt: "2026-01-01T00:00:00Z",
    welcomeSeenAt: null,
    ...patch,
  };
}

test("the gift dialog opens once: granted but not yet seen", () => {
  assert.equal(shouldShowWelcomeGift(wallet()), true);
  assert.equal(
    shouldShowWelcomeGift(wallet({ welcomeSeenAt: "2026-01-01T00:00:01Z" })),
    false,
    "a dialog that reappears after being dismissed is a bug, not a reminder"
  );
});

test("no wallet, no dialog", () => {
  assert.equal(shouldShowWelcomeGift(null), false);
  assert.equal(
    shouldShowWelcomeGift(wallet({ welcomeGrantedAt: null })),
    false,
    "nothing was granted, so there is nothing to announce"
  );
});

test("an unreachable wallet cannot pop the dialog on every page load", () => {
  // `UNAVAILABLE_WALLET` reports the sentinel rather than null precisely for this.
  assert.equal(
    shouldShowWelcomeGift(wallet({ welcomeGrantedAt: "unavailable", welcomeSeenAt: "unavailable" })),
    false
  );
});

test("the dialog still opens on a spent balance, because the credit was real", () => {
  assert.equal(shouldShowWelcomeGift(wallet({ balanceCents: 0 })), true);
});

/* ── Pricing a run ── */

test("every model has a price for every kind of run", () => {
  for (const id of MODELS) {
    const cost = RUN_COSTS[id];
    assert.ok(cost, `${id} has no price`);
    for (const kind of ["create", "edit", "repair"] as const) {
      assert.ok(Number.isInteger(cost[kind]), `${id}.${kind} must be integer cents`);
      assert.ok(cost[kind] > 0, `${id}.${kind} must cost something`);
    }
  }
});

test("within a model: creating costs more than editing, editing more than repairing", () => {
  for (const id of MODELS) {
    const { create, edit, repair } = RUN_COSTS[id];
    assert.ok(create > edit, `${id}: a whole project must cost more than an edit`);
    assert.ok(edit > repair, `${id}: an edit must cost more than a repair`);
  }
});

test("repair is discounted but never free", () => {
  for (const id of MODELS) {
    const { edit, repair } = RUN_COSTS[id];
    assert.ok(repair > 0, `${id}: a free lane is a forgeable one`);
    assert.ok(repair <= Math.ceil(edit / 2), `${id}: repair should be about half an edit`);
  }
});

test("the flagship is the most expensive model", () => {
  const flagship = flagshipCosts();
  for (const id of MODELS) {
    assert.ok(
      flagship.create >= RUN_COSTS[id].create,
      `${id} costs more than the flagship, so failover order and price order disagree`
    );
  }
  assert.deepEqual(flagship, RUN_COSTS[MODELS[0]]);
});

test("an unknown model is charged the most, so a typo is never a discount", () => {
  const flagship = flagshipCosts();
  for (const kind of ["create", "edit", "repair"] as const) {
    assert.equal(costForRun("claude-sonnet-9", kind), flagship[kind]);
    assert.equal(costForRun("", kind), flagship[kind]);
    assert.equal(costForRun(undefined, kind), flagship[kind]);
    // A prototype-chain name must not resolve to an object either.
    assert.equal(costForRun("toString", kind), flagship[kind]);
    assert.equal(costForRun("constructor", kind), flagship[kind]);
  }
});

test("a known model is charged its own price", () => {
  for (const id of MODELS) {
    assert.equal(costForRun(id, "create"), RUN_COSTS[id].create);
    assert.equal(costForRun(id, "edit"), RUN_COSTS[id].edit);
    assert.equal(costForRun(id, "repair"), RUN_COSTS[id].repair);
  }
});

test("the worst case of a failed generation stays inside the welcome grant", () => {
  // create + two automatic repairs is the most one prompt can cost.
  const { create, repair } = flagshipCosts();
  assert.ok(
    create + repair * 2 < WELCOME_GRANT_CENTS,
    "one bad prompt must not be able to consume the whole gift"
  );
});

/* ── Formatting ── */

test("formatMoney always shows two decimals", () => {
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney(5), "$0.05");
  assert.equal(formatMoney(50), "$0.50");
  assert.equal(formatMoney(500), "$5.00");
  assert.equal(formatMoney(1499), "$14.99");
  assert.equal(formatMoney(2000), "$20.00");
  assert.equal(formatMoney(123456), "$1234.56");
});

test("formatMoney keeps the sign outside the dollar mark", () => {
  assert.equal(formatMoney(-25), "-$0.25");
  assert.equal(formatMoney(-500), "-$5.00");
});

test("formatMoneyShort drops trailing zeros and only those", () => {
  assert.equal(formatMoneyShort(500), "$5");
  assert.equal(formatMoneyShort(2000), "$20");
  assert.equal(formatMoneyShort(0), "$0");
  assert.equal(formatMoneyShort(1499), "$14.99");
  assert.equal(formatMoneyShort(2999), "$29.99");
  assert.equal(formatMoneyShort(50), "$0.50");
  assert.equal(formatMoneyShort(-2000), "-$20");
});

test("both formatters agree on whole dollars", () => {
  for (const cents of [0, 100, 500, 2000, 4800]) {
    assert.equal(
      formatMoneyShort(cents) + ".00",
      formatMoney(cents),
      `the two labels for ${cents} must describe the same amount`
    );
  }
});

/* ── Balance states ── */

test("zero and below is empty, and empty is what SOLD OUT means", () => {
  assert.equal(balanceState(0), "empty");
  assert.equal(balanceState(-1), "empty", "an overdrawn wallet is not healthy");
  assert.equal(SOLD_OUT_LABEL, "SOLD OUT");
});

test("the warning fires before the balance is gone", () => {
  assert.equal(balanceState(1), "low");
  assert.equal(balanceState(149), "low");
  assert.equal(balanceState(150), "healthy", "30% of the grant is the threshold");
  assert.equal(balanceState(WELCOME_GRANT_CENTS), "healthy");
});

test("the low band is wide enough to still buy something", () => {
  const cheapest = Math.min(...MODELS.map((id) => RUN_COSTS[id].repair));
  assert.equal(
    balanceState(cheapest),
    "low",
    "a balance that can only afford one repair must already be warning"
  );
});

test("canAffordAnything tracks the cheapest possible run", () => {
  const cheapest = Math.min(...MODELS.map((id) => RUN_COSTS[id].repair));
  assert.equal(canAffordAnything(cheapest), true);
  assert.equal(canAffordAnything(cheapest - 1), false);
  assert.equal(canAffordAnything(0), false);
  assert.equal(canAffordAnything(WELCOME_GRANT_CENTS), true);
});

test("projectsAffordable never promises a project the balance cannot pay for", () => {
  assert.equal(projectsAffordable(0), 0);
  assert.equal(projectsAffordable(-100), 0, "a negative balance must not promise projects");

  const { create, edit } = flagshipCosts();
  const one = create + edit * 4;
  assert.equal(projectsAffordable(one - 1), 0, "it must floor, never round up");
  assert.equal(projectsAffordable(one), 1);
  assert.equal(projectsAffordable(one * 3), 3);
});

test("a cheaper model buys at least as many projects", () => {
  for (const id of MODELS) {
    assert.ok(
      projectsAffordable(WELCOME_GRANT_CENTS, id) >= projectsAffordable(WELCOME_GRANT_CENTS),
      `${id} is cheaper than the flagship but buys fewer projects`
    );
  }
});

/* ── The plans ── */

test("the three plans are the prices the product promised", () => {
  assert.deepEqual(
    PLANS.map((p) => [p.id, p.name, p.priceCents]),
    [
      ["go", "Go", 1499],
      ["premium", "Premium", 2000],
      ["premium_plus", "Premium+", 2999],
    ]
  );
});

test("plans are listed cheapest first, and each tier really is more credit", () => {
  for (let i = 1; i < PLANS.length; i++) {
    assert.ok(
      PLANS[i].priceCents > PLANS[i - 1].priceCents,
      `${PLANS[i].id} is not more expensive than ${PLANS[i - 1].id}`
    );
    assert.ok(
      PLANS[i].creditCents > PLANS[i - 1].creditCents,
      `${PLANS[i].id} costs more than ${PLANS[i - 1].id} but grants no more credit`
    );
  }
});

test("every plan grants more credit than it charges", () => {
  for (const plan of PLANS) {
    assert.ok(
      plan.creditCents > plan.priceCents,
      `${plan.id} charges ${plan.priceCents} and grants ${plan.creditCents} — that is not an offer`
    );
    assert.ok(bonusPercent(plan) > 0, `${plan.id} has no bonus to advertise`);
  }
});

test("exactly one plan is highlighted, and it is the recommendation", () => {
  const highlighted = PLANS.filter((p) => p.highlighted);
  assert.equal(highlighted.length, 1, "two emphasised cards emphasise nothing");
  assert.equal(RECOMMENDED_PLAN.id, highlighted[0].id);
  assert.equal(RECOMMENDED_PLAN.id, "premium");
  assert.ok(RECOMMENDED_PLAN.badge, "the recommended plan needs its ribbon copy");
});

test('"most popular" is a fact about the value, not a sticker', () => {
  // The claim on the page is that Premium is the best balance of features for the
  // price. It has to beat the tier below it on credit per dollar to be honest.
  const cheaper = PLANS.filter((p) => p.priceCents < RECOMMENDED_PLAN.priceCents);
  const ratio = (id: string) => {
    const plan = findPlan(id);
    assert.ok(plan);
    return plan.creditCents / plan.priceCents;
  };
  for (const plan of cheaper) {
    assert.ok(
      ratio(RECOMMENDED_PLAN.id) > ratio(plan.id),
      `${RECOMMENDED_PLAN.id} must be better value than ${plan.id} to be called most popular`
    );
  }
});

test("the top tier justifies itself with the most credit overall", () => {
  const top = PLANS[PLANS.length - 1];
  for (const plan of PLANS) {
    assert.ok(top.creditCents >= plan.creditCents);
  }
  assert.ok(
    top.features.length > RECOMMENDED_PLAN.features.length,
    "Premium+ costs more and must visibly offer more"
  );
});

test("every plan beats the welcome grant, so upgrading is always a step up", () => {
  for (const plan of PLANS) {
    assert.ok(
      plan.creditCents > WELCOME_GRANT_CENTS,
      `${plan.id} grants no more than the free trial`
    );
    assert.ok(planProjects(plan) > projectsAffordable(WELCOME_GRANT_CENTS));
  }
});

test("bonusPercent is derived from the numbers on the card", () => {
  for (const plan of PLANS) {
    const expected = Math.round(((plan.creditCents - plan.priceCents) / plan.priceCents) * 100);
    assert.equal(bonusPercent(plan), expected);
  }
  assert.equal(bonusPercent({ ...PLANS[0], priceCents: 1000, creditCents: 1400 }), 40);
});

test("every advertised feature is real copy", () => {
  for (const plan of PLANS) {
    assert.ok(plan.features.length >= 4, `${plan.id} needs enough substance to fill a card`);
    assert.ok(plan.tagline.trim().length > 0, `${plan.id} needs its one line`);
    for (const feature of plan.features) {
      assert.ok(feature.trim().length > 0, `${plan.id} has an empty bullet`);
    }
  }
});

test("findPlan answers only for real plans", () => {
  assert.equal(findPlan("premium")?.name, "Premium");
  assert.equal(findPlan("free"), undefined);
  assert.equal(findPlan(""), undefined);
  // A prototype key must not resolve, or a checkout URL could name one.
  assert.equal(findPlan("toString"), undefined);
  assert.equal(findPlan("constructor"), undefined);
});

test("the split price renders the same amount as the plain label", () => {
  for (const plan of PLANS) {
    const { dollars, cents } = planPriceParts(plan);
    assert.equal(`$${dollars}.${cents}`, planPriceLabel(plan));
    assert.equal(cents.length, 2, "the small numerals must stay two digits");
    assert.equal(
      Number(dollars) * CENTS_PER_DOLLAR + Number(cents),
      plan.priceCents,
      `${plan.id}: the oversized numeral must add back up to the real price`
    );
  }
  assert.deepEqual(planPriceParts(PLANS[0]), { dollars: "14", cents: "99" });
  assert.deepEqual(planPriceParts(PLANS[1]), { dollars: "20", cents: "00" });
});

test("plan ids are unique, since they key the checkout URL", () => {
  assert.equal(new Set(PLANS.map((p) => p.id)).size, PLANS.length);
});
