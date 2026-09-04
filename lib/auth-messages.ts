/**
 * Arabic messages for auth failures, plus the input validation the sign-up and
 * sign-in forms share.
 *
 * Supabase returns English strings with a stable `code`. Mapping on the code
 * keeps the UI in the site's language and stops provider wording changes from
 * leaking through. Anything unmapped falls back to a generic message rather than
 * echoing raw provider text, which can carry internal detail.
 */

/** Errors surfaced through a `?error=` query parameter on `/login`. */
export const REDIRECT_ERRORS: Record<string, string> = {
  oauth_failed: "تعذّر إكمال تسجيل الدخول عبر المزوّد. حاول مرة أخرى.",
  oauth_denied: "أُلغي الإذن من صفحة المزوّد، لم يتم تسجيل الدخول.",
  missing_code: "رابط العودة غير مكتمل. ابدأ تسجيل الدخول من جديد.",
  exchange_failed: "انتهت صلاحية رابط تسجيل الدخول. جرّب مرة أخرى.",
  link_expired: "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطًا جديدًا.",
  session_required: "هذه الصفحة تتطلّب تسجيل الدخول أولًا.",
  not_configured: "لم يُضبط Supabase على هذا الخادم، تسجيل الدخول غير متاح حاليًا.",
};

/** Supabase `AuthError.code` → user-facing Arabic. */
const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  email_not_confirmed: "لم يتم تأكيد بريدك بعد. افتح رسالة التأكيد في بريدك.",
  email_exists: "هذا البريد مسجَّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب.",
  user_already_exists: "هذا البريد مسجَّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب.",
  weak_password: "كلمة المرور ضعيفة. اجعلها أطول وأضف أرقامًا وحروفًا.",
  over_email_send_rate_limit:
    "أُرسلت رسائل كثيرة إلى هذا البريد. انتظر دقيقة ثم أعد المحاولة.",
  over_request_rate_limit: "عدد كبير من المحاولات. انتظر قليلًا ثم أعد المحاولة.",
  otp_expired: "انتهت صلاحية الرابط. اطلب رابطًا جديدًا.",
  signup_disabled: "التسجيل مُعطَّل على هذا المشروع حاليًا.",
  email_provider_disabled: "تسجيل الدخول بالبريد مُعطَّل على هذا المشروع.",
  provider_disabled: "هذا المزوّد غير مُفعَّل على المشروع. فعّله من لوحة Supabase.",
  oauth_provider_not_supported: "هذا المزوّد غير مُفعَّل على المشروع.",
  validation_failed: "تحقّق من البيانات المُدخلة وأعد المحاولة.",
  email_address_invalid: "هذا البريد الإلكتروني غير مقبول. استخدم بريدًا آخر.",
  user_banned: "هذا الحساب موقوف. تواصل مع الدعم.",
  same_password: "كلمة المرور الجديدة مطابقة للحالية. اختر كلمة مرور مختلفة.",
  captcha_failed: "فشل التحقق من أنك لست روبوتًا. أعد المحاولة.",
};

const NETWORK_MESSAGE =
  "تعذّر الوصول إلى خدمة تسجيل الدخول. تحقّق من اتصالك بالإنترنت.";
const GENERIC_MESSAGE = "تعذّر إكمال الطلب. حاول مرة أخرى بعد قليل.";

/** Translates any thrown or returned auth error into one Arabic sentence. */
export function describeAuthError(error: unknown): string {
  if (!error) return GENERIC_MESSAGE;

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|network|enotfound|econnrefused|timeout/i.test(message)) {
    return NETWORK_MESSAGE;
  }
  // No `code` and HTTP 4xx usually means a validation problem the form can fix.
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return CODE_MESSAGES.validation_failed;
  }
  return GENERIC_MESSAGE;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Email shape check.
 *
 * Deliberately loose — the authoritative validation is Supabase's, and the only
 * job here is to catch obvious typos before spending a network round trip.
 */
export function isValidEmail(value: string): boolean {
  if (value.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

export interface FieldErrors {
  email?: string;
  password?: string;
  name?: string;
  form?: string;
}

/** Validates the sign-up form. Returns `{}` when everything passes. */
export function validateSignUp(input: {
  email: string;
  password: string;
  name?: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.email.trim()) errors.email = "أدخل بريدك الإلكتروني.";
  else if (!isValidEmail(input.email.trim())) errors.email = "صيغة البريد غير صحيحة.";

  if (!input.password) errors.password = "أدخل كلمة مرور.";
  else if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`;
  } else if (input.password.length > 72) {
    // bcrypt truncates past 72 bytes, so anything longer is silently ignored.
    errors.password = "كلمة المرور طويلة جدًا (الحد 72 حرفًا).";
  }

  if (input.name !== undefined && input.name.trim().length > 80) {
    errors.name = "الاسم طويل جدًا.";
  }

  return errors;
}

/** Validates the sign-in form: presence only, so a changed policy can't lock users out. */
export function validateSignIn(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.email.trim()) errors.email = "أدخل بريدك الإلكتروني.";
  else if (!isValidEmail(input.email.trim())) errors.email = "صيغة البريد غير صحيحة.";
  if (!input.password) errors.password = "أدخل كلمة المرور.";
  return errors;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/**
 * Rough strength meter for the sign-up field.
 *
 * Feedback for the user, not a gate — length carries most of the weight because
 * it is what actually resists guessing.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score++;

  const labels = ["ضعيفة جدًا", "ضعيفة", "مقبولة", "جيدة", "قوية"] as const;
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped] };
}
