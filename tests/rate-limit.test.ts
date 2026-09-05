import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clientKey, resetRateLimits } from "../lib/rate-limit.ts";

test("allows a burst up to the limit then blocks", () => {
  resetRateLimits();
  const now = 1_000_000;

  for (let i = 0; i < 8; i++) {
    const res = checkRateLimit("1.2.3.4", now + i);
    assert.equal(res.allowed, true, `request ${i + 1} should pass`);
    assert.equal(res.remaining, 7 - i);
  }

  const blocked = checkRateLimit("1.2.3.4", now + 8);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfter >= 1, "must tell the caller when to retry");
});

test("the window slides rather than resetting on a fixed schedule", () => {
  resetRateLimits();
  const start = 2_000_000;
  for (let i = 0; i < 8; i++) checkRateLimit("ip", start + i * 1000);

  assert.equal(checkRateLimit("ip", start + 7999).allowed, false);
  // The first hit ages out 60s after it was made, freeing exactly one slot.
  assert.equal(checkRateLimit("ip", start + 60_001).allowed, true);
  assert.equal(checkRateLimit("ip", start + 60_002).allowed, false);
});

test("limits are tracked per key", () => {
  resetRateLimits();
  const now = 3_000_000;
  for (let i = 0; i < 8; i++) checkRateLimit("a", now);
  assert.equal(checkRateLimit("a", now).allowed, false);
  assert.equal(checkRateLimit("b", now).allowed, true, "a different IP is unaffected");
});

test("retryAfter counts down as the window ages", () => {
  resetRateLimits();
  const now = 4_000_000;
  for (let i = 0; i < 8; i++) checkRateLimit("ip", now);

  const immediate = checkRateLimit("ip", now).retryAfter;
  const later = checkRateLimit("ip", now + 30_000).retryAfter;
  assert.ok(later < immediate, `${later} should be less than ${immediate}`);
});

test("client key prefers the first x-forwarded-for hop", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18", "x-real-ip": "10.0.0.1" });
  assert.equal(clientKey(headers), "203.0.113.7");
});

test("client key falls back through the proxy headers", () => {
  assert.equal(clientKey(new Headers({ "x-real-ip": "10.0.0.2" })), "10.0.0.2");
  assert.equal(clientKey(new Headers({ "cf-connecting-ip": "10.0.0.3" })), "10.0.0.3");
  assert.equal(clientKey(new Headers()), "unknown");
  assert.equal(
    clientKey(new Headers({ "x-forwarded-for": "  , 1.1.1.1" })),
    "unknown",
    "an empty first hop must not become the key"
  );
});
