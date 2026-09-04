import type { Metadata } from "next";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "إعادة تعيين كلمة المرور — بنّاء",
  description: "اطلب رابطًا لإعادة تعيين كلمة مرور حسابك في بنّاء.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      eyebrow="استعادة الحساب"
      title="نسيت كلمة المرور؟"
      subtitle="أدخل بريدك الإلكتروني وسنرسل إليك رابطًا لتعيين كلمة مرور جديدة."
      footer={
        <Link
          href="/login"
          className="font-semibold text-accent transition-opacity hover:opacity-80"
        >
          العودة إلى تسجيل الدخول
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
