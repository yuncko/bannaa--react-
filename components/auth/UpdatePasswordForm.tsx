"use client";

import { useActionState } from "react";
import { LockIcon } from "@/components/Icons";
import { FormAlert, PasswordField, SubmitButton } from "./FormFields";
import { updatePassword, type AuthFormState } from "@/app/auth/actions";

export default function UpdatePasswordForm() {
  const [state, action] = useActionState<AuthFormState | undefined, FormData>(
    updatePassword,
    undefined
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormAlert message={state?.errors?.form} />

      <PasswordField
        name="password"
        label="كلمة المرور الجديدة"
        placeholder="••••••••"
        autoComplete="new-password"
        error={state?.errors?.password}
        icon={<LockIcon className="h-4 w-4" />}
        showStrength
      />

      <PasswordField
        name="confirm"
        label="تأكيد كلمة المرور"
        placeholder="••••••••"
        autoComplete="new-password"
        icon={<LockIcon className="h-4 w-4" />}
      />

      <SubmitButton pendingLabel="جارٍ الحفظ...">حفظ كلمة المرور</SubmitButton>
    </form>
  );
}
