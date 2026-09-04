import test from "node:test";
import assert from "node:assert/strict";
import { authErrorUrl, resolveOrigin, safeRedirectPath } from "../lib/auth-redirect.ts";

test("passes through an ordinary same-origin path", () => {
  assert.equal(safeRedirectPath("/account"), "/account");
  assert.equal(safeRedirectPath("/account/password?tab=1"), "/account/password?tab=1");
  assert.equal(safeRedirectPath("/%D9%85%D8%B4%D8%B1%D9%88%D8%B9"), "/مشروع");
});

test("falls back when there is nothing to redirect to", () => {
  assert.equal(safeRedirectPath(undefined), "/");
  assert.equal(safeRedirectPath(null), "/");
  assert.equal(safeRedirectPath(""), "/");
  assert.equal(safeRedirectPath("/x", "/fallback"), "/x");
  assert.equal(safeRedirectPath("", "/fallback"), "/fallback");
});

test("rejects destinations that would leave the site", () => {
  for (const payload of [
    "https://evil.example",
    "http://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "account",
    " https://evil.example",
  ]) {
    assert.equal(safeRedirectPath(payload), "/", `must reject ${JSON.stringify(payload)}`);
  }
});

test("rejects an off-site payload hidden behind percent-encoding", () => {
  // The raw form starts with "/" and would pass a naive check; only the decoded
  // value shows the scheme-relative URL.
  assert.equal(safeRedirectPath("%2F%2Fevil.example"), "/");
  assert.equal(safeRedirectPath("%2f%2fevil.example/path"), "/");
  assert.equal(safeRedirectPath("/%09/evil.example"), "/");
});

test("rejects malformed encoding rather than guessing", () => {
  assert.equal(safeRedirectPath("%E0%A4%A"), "/");
  assert.equal(safeRedirectPath("/%"), "/");
});

test("rejects control characters used to smuggle headers", () => {
  assert.equal(safeRedirectPath("/account%0d%0aSet-Cookie:%20a=b"), "/");
  assert.equal(safeRedirectPath("/account\u0000"), "/");
  assert.equal(safeRedirectPath("/account%7f"), "/");
});

test("origin prefers the forwarded host over the request URL", () => {
  const request = new Request("http://10.0.0.7:3000/auth/callback", {
    headers: { "x-forwarded-host": "bannaa.example", "x-forwarded-proto": "https" },
  });
  assert.equal(resolveOrigin(request), "https://bannaa.example");
});

test("origin defaults to https when only the host is forwarded", () => {
  const request = new Request("http://10.0.0.7:3000/auth/callback", {
    headers: { "x-forwarded-host": "bannaa.example" },
  });
  assert.equal(resolveOrigin(request), "https://bannaa.example");
});

test("origin falls back to the request URL when nothing is forwarded", () => {
  const request = new Request("http://localhost:3000/auth/callback?code=x");
  assert.equal(resolveOrigin(request), "http://localhost:3000");
});

test("configured site URL wins and loses its trailing slash", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://bannaa.app//";
  try {
    const request = new Request("http://localhost:3000/auth/callback", {
      headers: { "x-forwarded-host": "ignored.example" },
    });
    assert.equal(resolveOrigin(request), "https://bannaa.app");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("error URL carries the code and only a non-default destination", () => {
  const withNext = authErrorUrl("https://bannaa.app", "oauth_failed", "/account");
  assert.equal(withNext.pathname, "/login");
  assert.equal(withNext.searchParams.get("error"), "oauth_failed");
  assert.equal(withNext.searchParams.get("next"), "/account");

  const bare = authErrorUrl("https://bannaa.app", "oauth_failed", "/");
  assert.equal(bare.searchParams.has("next"), false, "the default path adds nothing");
  assert.equal(authErrorUrl("https://bannaa.app", "x").searchParams.has("next"), false);
});
