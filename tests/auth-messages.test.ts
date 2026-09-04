import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_PASSWORD_LENGTH,
  REDIRECT_ERRORS,
  describeAuthError,
  isValidEmail,
  passwordStrength,
  validateSignIn,
  validateSignUp,
} from "../lib/auth-messages.ts";

test("accepts ordinary addresses and rejects obvious typos", () => {
  for (const good of ["a@b.co", "user.name+tag@example.co.uk", "u@sub.domain.io"]) {
    assert.equal(isValidEmail(good), true, `${good} should pass`);
  }
  for (const bad of [
    "",
    "user",
    "user@",
    "@example.com",
    "user@example",
    "user@.com",
    "user@example..com",
    "user name@example.com",
    "user@exam ple.com",
    `${"a".repeat(250)}@example.com`,
  ]) {
    assert.equal(isValidEmail(bad), false, `${JSON.stringify(bad)} should fail`);
  }
});

test("sign-up validation reports one error per bad field", () => {
  assert.deepEqual(validateSignUp({ email: "a@b.co", password: "longenough1" }), {});

  const empty = validateSignUp({ email: "", password: "" });
  assert.ok(empty.email);
  assert.ok(empty.password);

  assert.ok(validateSignUp({ email: "nope", password: "longenough1" }).email);
  assert.ok(
    validateSignUp({ email: "a@b.co", password: "a".repeat(MIN_PASSWORD_LENGTH - 1) }).password,
    "below the minimum length must be rejected"
  );
  // bcrypt silently truncates past 72 bytes, so a longer password would not be
  // the one that gets stored.
  assert.ok(validateSignUp({ email: "a@b.co", password: "a".repeat(73) }).password);
  assert.equal(validateSignUp({ email: "a@b.co", password: "a".repeat(72) }).password, undefined);
});

test("sign-up validation bounds the optional display name", () => {
  assert.equal(validateSignUp({ email: "a@b.co", password: "longenough1", name: "" }).name, undefined);
  assert.equal(
    validateSignUp({ email: "a@b.co", password: "longenough1", name: "أحمد" }).name,
    undefined
  );
  assert.ok(validateSignUp({ email: "a@b.co", password: "longenough1", name: "x".repeat(81) }).name);
});

test("sign-in validation checks presence, not policy", () => {
  assert.deepEqual(validateSignIn({ email: "a@b.co", password: "x" }), {});
  assert.ok(validateSignIn({ email: "a@b.co", password: "" }).password);
  assert.ok(validateSignIn({ email: "", password: "x" }).email);
  assert.ok(validateSignIn({ email: "bad", password: "x" }).email);
});

test("known Supabase codes map to Arabic, unknown ones do not leak provider text", () => {
  assert.match(describeAuthError({ code: "invalid_credentials" }), /كلمة المرور/);
  assert.match(describeAuthError({ code: "email_exists" }), /مسجَّل بالفعل/);

  const leaky = describeAuthError(new Error("Internal: pgbouncer pool 10.1.2.3 exhausted"));
  assert.doesNotMatch(leaky, /pgbouncer|10\.1\.2\.3/);
  assert.ok(leaky.length > 0);
});

test("network failures are distinguished from validation failures", () => {
  assert.match(describeAuthError(new TypeError("fetch failed")), /اتصالك بالإنترنت/);
  assert.match(describeAuthError({ status: 422, message: "unprocessable" }), /البيانات المُدخلة/);
  assert.ok(describeAuthError(undefined).length > 0, "a missing error still needs a message");
  assert.ok(describeAuthError(null).length > 0);
});

test("password strength rises with length and variety", () => {
  assert.equal(passwordStrength("").score, 0);
  assert.equal(passwordStrength("").label, "");

  const short = passwordStrength("abc");
  const min = passwordStrength("abcdefgh");
  const long = passwordStrength("abcdefghijkl");
  const mixed = passwordStrength("Abcdefghijkl");
  const full = passwordStrength("Abcdefghijk1!");

  assert.equal(short.score, 0);
  assert.ok(min.score > short.score);
  assert.ok(long.score > min.score);
  assert.ok(mixed.score > long.score);
  assert.equal(full.score, 4);
  assert.ok(full.label.length > 0);
});

test("every redirect error code has a message", () => {
  for (const code of [
    "oauth_failed",
    "oauth_denied",
    "missing_code",
    "exchange_failed",
    "link_expired",
    "session_required",
    "not_configured",
  ]) {
    assert.ok(REDIRECT_ERRORS[code], `${code} must be renderable on /login`);
  }
  assert.equal(REDIRECT_ERRORS["<script>alert(1)</script>"], undefined);
});
