"use server";

/**
 * Auth server actions.
 *
 * Credentials are handled on the server so they never sit in a client bundle or
 * a fetch body the page can read back, and every action re-validates its input
 * rather than trusting the form that called it.
 *
 * `useActionState` shape: each action returns `AuthFormState`, so the forms can
 * render field-level errors and a form-level message from one object.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  describeAuthError,
  validateSignIn,
  validateSignUp,
  type FieldErrors,
} from "@/lib/auth-messages";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { DEFAULT_SIGNED_IN_PATH, isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthFormState {
  errors?: FieldErrors;
  /** Success notice, e.g. "check your inbox" — no redirect happened. */
  notice?: string;
  /** Echoed back so a failed submit does not clear the field the user typed. */
  email?: string;
}

/** OAuth providers wired into the UI. */
const ENABLED_PROVIDERS: readonly Provider[] = ["google", "github"];

/**
 * Absolute origin for redirect URLs built inside an action.
 *
 * An action has no `Request`, so the forwarded headers are read directly.
 * `NEXT_PUBLIC_SITE_URL` takes priority for deployments that strip them.
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const NOT_CONFIGURED: AuthFormState = {
  errors: {
    form: "لم يُضبط Supabase على هذا الخادم. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  },
};

function readCommon(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(
    typeof formData.get("next") === "string" ? String(formData.get("next")) : null
  );
  return { email, password, next };
}

export async function signInWithPassword(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const { email, password, next } = readCommon(formData);
  const errors = validateSignIn({ email, password });
  if (Object.keys(errors).length > 0) return { errors, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { errors: { form: describeAuthError(error) }, email };
  }

  // The header renders the signed-in user, so the shell has to re-render before
  // the navigation or it shows a stale "sign in" button.
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpWithPassword(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const { email, password, next } = readCommon(formData);
  const name = String(formData.get("name") ?? "").trim();

  const errors = validateSignUp({ email, password, name });
  if (Object.keys(errors).length > 0) return { errors, email };

  const origin = await siteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Confirmation links land on the route that verifies a `token_hash`, then
      // continue to wherever the user was originally headed.
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: name ? { full_name: name } : undefined,
    },
  });

  if (error) {
    return { errors: { form: describeAuthError(error) }, email };
  }

  // With email confirmation on, `signUp` returns a user but no session. Telling
  // the user to check their inbox is the only correct next step.
  if (!data.session) {
    return {
      notice: `أرسلنا رابط تأكيد إلى ${email}. افتحه لتفعيل حسابك.`,
      email,
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

/**
 * Starts an OAuth flow.
 *
 * Run server-side with `skipBrowserRedirect` so the PKCE verifier is written to
 * an HttpOnly cookie by the same client that will read it back in the callback.
 * Driving this from the browser instead would put the verifier in a
 * script-readable store for no benefit.
 */
export async function signInWithProvider(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const raw = String(formData.get("provider") ?? "");
  const provider = ENABLED_PROVIDERS.find((p) => p === raw);
  if (!provider) return { errors: { form: "مزوّد غير مدعوم." } };

  const next = safeRedirectPath(
    typeof formData.get("next") === "string" ? String(formData.get("next")) : null
  );
  const origin = await siteOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { errors: { form: describeAuthError(error) } };
  }

  // Absolute, off-origin destination — `redirect` handles external URLs.
  redirect(data.url);
}

/** Sends a password-reset link. */
export async function requestPasswordReset(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  const errors = validateSignIn({ email, password: "placeholder" });
  delete errors.password;
  if (Object.keys(errors).length > 0) return { errors, email };

  const origin = await siteOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/account/password")}`,
  });

  // Rate limiting is worth reporting; "no such user" is not. Confirming which
  // addresses have accounts would turn this form into an account enumerator.
  if (error && error.code === "over_email_send_rate_limit") {
    return { errors: { form: describeAuthError(error) }, email };
  }

  return {
    notice: `إن كان ${email} مسجَّلًا لدينا، فسيصل رابط إعادة التعيين إليه بعد لحظات.`,
    email,
  };
}

/** Sets a new password for the user who arrived via a recovery link. */
export async function updatePassword(
  _prev: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const errors = validateSignUp({ email: "placeholder@example.com", password });
  delete errors.email;
  if (!errors.password && password !== confirm) {
    errors.password = "الكلمتان غير متطابقتين.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { errors: { form: describeAuthError(error) } };

  revalidatePath("/", "layout");
  redirect("/account?updated=password");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect(DEFAULT_SIGNED_IN_PATH);
}
