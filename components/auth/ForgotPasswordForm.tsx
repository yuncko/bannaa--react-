"use client";

import { useActionState } from "react";
import { MailIcon } from "@/components/Icons";
import { FormAlert, FormNotice, SubmitButton, TextField } from "./FormFields";
import { requestPasswordReset, type AuthFormState } from "@/app/auth/actions";

export default function ForgotPasswordForm() {
  const [state, action] = useActionState<AuthFormState | undefined, FormData>(
    requestPasswordReset,
    undefined
  );

  if (state?.notice) {
    return <FormNotice message={state.notice} />;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state?.errors?.form} />

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

      <SubmitButton pendingLabel="جارٍ الإرسال...">أرسل رابط إعادة التعيين</SubmitButton>
    </form>
  );
}
