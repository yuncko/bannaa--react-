"use client";

import { useActionState } from "react";
import { LockIcon, MailIcon, UserIcon } from "@/components/Icons";
import {
  AuthDivider,
  FormAlert,
  FormNotice,
  PasswordField,
  SubmitButton,
  TextField,
} from "./FormFields";
import OAuthButtons from "./OAuthButtons";
import { signUpWithPassword, type AuthFormState } from "@/app/auth/actions";

export default function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthFormState | undefined, FormData>(
    signUpWithPassword,
    undefined
  );

  // With email confirmation enabled, sign-up ends on a notice instead of a
  // redirect. Keeping the form up would invite a duplicate submission.
  if (state?.notice) {
    return (
      <div className="space-y-4">
        <FormNotice message={state.notice} />
        <p className="text-xs leading-relaxed text-ink-faint">
          لم تجد الرسالة؟ تحقّق من مجلد البريد المزعج، أو أعد المحاولة بعد دقيقة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <OAuthButtons next={next} />

      <AuthDivider label="أو أنشئ حسابًا بالبريد" />

      <form action={action} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        <FormAlert message={state?.errors?.form} />

        <TextField
          name="name"
          label="الاسم (اختياري)"
          placeholder="اسمك كما تريد أن يظهر"
          autoComplete="name"
          error={state?.errors?.name}
          icon={<UserIcon className="h-4 w-4" />}
          autoFocus
        />

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
          ltr
        />

        <PasswordField
          name="password"
          label="كلمة المرور"
          placeholder="••••••••"
          autoComplete="new-password"
          error={state?.errors?.password}
          icon={<LockIcon className="h-4 w-4" />}
          showStrength
        />

        <SubmitButton pendingLabel="جارٍ إنشاء الحساب...">إنشاء الحساب</SubmitButton>

        <p className="text-center text-[11px] leading-relaxed text-ink-faint">
          بإنشاء حساب فأنت توافق على الاستخدام العادل للخدمة.
        </p>
      </form>
    </div>
  );
}
