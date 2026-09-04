import type { Metadata } from "next";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import SignInForm from "@/components/auth/SignInForm";
import { REDIRECT_ERRORS } from "@/lib/auth-messages";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "تسجيل الدخول — بنّاء",
  description: "سجّل الدخول إلى بنّاء عبر Google أو GitHub أو بالبريد الإلكتروني.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  // Only known codes are rendered; an unrecognised `?error=` is ignored rather
  // than echoed, which would make this a reflected-text sink.
  const redirectError = params.error ? REDIRECT_ERRORS[params.error] : undefined;

  return (
    <AuthLayout
      eyebrow="مرحبًا بعودتك"
      title="سجّل الدخول إلى حسابك"
      subtitle="تابع من حيث توقّفت، واحتفظ بمشاريعك وإصداراتك في مكان واحد."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link
            href={
              next === DEFAULT_SIGNED_IN_PATH
                ? "/signup"
                : `/signup?next=${encodeURIComponent(next)}`
            }
            className="font-semibold text-accent transition-opacity hover:opacity-80"
          >
            أنشئ حسابًا مجانًا
          </Link>
        </>
      }
    >
      <SignInForm
        next={next === DEFAULT_SIGNED_IN_PATH ? undefined : next}
        redirectError={redirectError}
      />
    </AuthLayout>
  );
}
