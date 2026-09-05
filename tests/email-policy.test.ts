import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_EMAIL_DOMAINS,
  PRIMARY_EMAIL_DOMAIN,
  describeEmailPolicy,
  emailDomain,
  isAllowedEmailDomain,
  mailboxFingerprint,
} from "../lib/email-policy.ts";

test("accepts Gmail and its googlemail alias", () => {
  assert.equal(isAllowedEmailDomain("someone@gmail.com"), true);
  assert.equal(isAllowedEmailDomain("someone@googlemail.com"), true);
  assert.equal(isAllowedEmailDomain("SomeOne@GMAIL.COM"), true, "case must not matter");
  assert.equal(isAllowedEmailDomain("  someone@gmail.com  "), true, "whitespace must not matter");
});

test("rejects everything else, disposable or not", () => {
  for (const email of [
    "someone@mailinator.com",
    "someone@10minutemail.com",
    "someone@outlook.com",
    "someone@company.co",
    // The allowed domain as a subdomain or a prefix must not pass.
    "someone@gmail.com.evil.net",
    "someone@notgmail.com",
    "someone@gmail.co",
  ]) {
    assert.equal(isAllowedEmailDomain(email), false, `${email} must be rejected`);
  }
});

test("a malformed address is rejected rather than throwing", () => {
  assert.equal(emailDomain("no-at-sign"), "");
  assert.equal(isAllowedEmailDomain("no-at-sign"), false);
  assert.equal(isAllowedEmailDomain(""), false);
  assert.equal(isAllowedEmailDomain("@gmail.com"), true, "domain check is only about the domain");
});

test("the domain is read from the last @, so an @ in the local part cannot spoof it", () => {
  assert.equal(emailDomain("we\"ir@d\"@gmail.com"), "gmail.com");
  assert.equal(isAllowedEmailDomain("someone@gmail.com@evil.net"), false);
});

test("dots and plus tags collapse onto one mailbox", () => {
  const canonical = "john@gmail.com";
  for (const alias of [
    "john@gmail.com",
    "John@Gmail.com",
    "j.o.h.n@gmail.com",
    "john+throwaway@gmail.com",
    "j.o.h.n+a+b@gmail.com",
    "john@googlemail.com",
    "  john+x@GOOGLEMAIL.com  ",
  ]) {
    assert.equal(
      mailboxFingerprint(alias),
      canonical,
      `${alias} is the same inbox and must not earn a second welcome grant`
    );
  }
});

test("different mailboxes keep different fingerprints", () => {
  assert.notEqual(mailboxFingerprint("john@gmail.com"), mailboxFingerprint("jane@gmail.com"));
  // Digits are part of the local name; only dots are ignored by Gmail.
  assert.notEqual(mailboxFingerprint("john1@gmail.com"), mailboxFingerprint("john2@gmail.com"));
});

test("fingerprint is null for anything it cannot deduplicate", () => {
  assert.equal(mailboxFingerprint("someone@outlook.com"), null);
  assert.equal(mailboxFingerprint("not-an-email"), null);
  // A local part that is entirely dots or a bare tag would collapse to "", which
  // would make every such address share one fingerprint.
  assert.equal(mailboxFingerprint("...@gmail.com"), null);
  assert.equal(mailboxFingerprint("+tag@gmail.com"), null);
});

test("fingerprint always normalises onto the primary domain", () => {
  const fingerprint = mailboxFingerprint("john@googlemail.com");
  assert.equal(fingerprint, `john@${PRIMARY_EMAIL_DOMAIN}`);
  assert.equal(
    ALLOWED_EMAIL_DOMAINS.includes(PRIMARY_EMAIL_DOMAIN),
    true,
    "the domain we normalise onto must itself be allowed"
  );
});

test("the rejection message names the required domain and stays quiet while typing", () => {
  assert.equal(describeEmailPolicy(""), undefined, "an empty field is not yet an error");
  assert.equal(describeEmailPolicy("   "), undefined);
  assert.equal(describeEmailPolicy("someone@gmail.com"), undefined);

  const message = describeEmailPolicy("someone@mailinator.com");
  assert.ok(message, "a rejected address must be explained");
  assert.ok(
    message.includes(PRIMARY_EMAIL_DOMAIN),
    "the user has to be told which domain to use, not just that theirs is wrong"
  );
});
