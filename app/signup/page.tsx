import type { Metadata } from "next";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import SignUpForm from "@/components/auth/SignUpForm";
import { safeRedirectPath } from "@/lib/auth-redirect";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "إنشاء حساب — بنّاء",
  description: "أنشئ حسابك في بنّاء عبر Google أو GitHub أو بالبريد الإلكتروني.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);

  return (
    <AuthLayout
      eyebrow="ابدأ مجانًا"
      title="أنشئ حسابك في بنّاء"
      subtitle="دقيقة واحدة تكفي: اربط Google أو GitHub، أو استخدم بريدك الإلكتروني."
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link
            href={
              next === DEFAULT_SIGNED_IN_PATH
                ? "/login"
                : `/login?next=${encodeURIComponent(next)}`
            }
            className="font-semibold text-accent transition-opacity hover:opacity-80"
          >
            سجّل الدخول
          </Link>
        </>
      }
    >
      <SignUpForm next={next === DEFAULT_SIGNED_IN_PATH ? undefined : next} />
    </AuthLayout>
  );
}
