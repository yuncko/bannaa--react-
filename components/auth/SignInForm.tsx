"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockIcon, MailIcon } from "@/components/Icons";
import {
  AuthDivider,
  FormAlert,
  PasswordField,
  SubmitButton,
  TextField,
} from "./FormFields";
import OAuthButtons from "./OAuthButtons";
import { signInWithPassword, type AuthFormState } from "@/app/auth/actions";

interface SignInFormProps {
  /** Where to land after signing in; already reduced to a safe path server-side. */
  next?: string;
  /** Message from a `?error=` redirect, e.g. a failed OAuth callback. */
  redirectError?: string;
}

export default function SignInForm({ next, redirectError }: SignInFormProps) {
  const [state, action] = useActionState<AuthFormState | undefined, FormData>(
    signInWithPassword,
    undefined
  );

  // A fresh submission error replaces the stale one carried in the URL.
  const formError = state?.errors?.form ?? redirectError;

  return (
    <div className="space-y-5">
      <OAuthButtons next={next} />

      <AuthDivider label="أو بالبريد الإلكتروني" />

      <form action={action} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        <FormAlert message={formError} />

        <TextField
          name="email"
          label="البريد الإلكتروني"
          type="email"
          placeholder="you@example.com"
          defaultValue={state?.email}
          autoComplete="email"
          error={state?.errors?.email}
          icon={<MailIcon className="h-4 w-4" />}
          required
          autoFocus
          ltr
        />

        <PasswordField
          name="password"
          label="كلمة المرور"
          placeholder="••••••••"
          autoComplete="current-password"
          error={state?.errors?.password}
          icon={<LockIcon className="h-4 w-4" />}
          action={
            <Link
              href="/forgot-password"
              className="text-[11px] text-ink-faint transition-colors hover:text-accent"
            >
              نسيت كلمة المرور؟
            </Link>
          }
        />

        <SubmitButton pendingLabel="جارٍ الدخول...">تسجيل الدخول</SubmitButton>
      </form>
    </div>
  );
}
