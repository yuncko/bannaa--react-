import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "تغيير كلمة المرور — بنّاء",
  description: "اختر كلمة مرور جديدة لحسابك في بنّاء.",
};

export default async function UpdatePasswordPage() {
  const user = await getSessionUser();

  // Recovery links land here with a session already established by
  // `/auth/confirm`. Without one there is nothing to update, and `updateUser`
  // would fail with an opaque error instead of an explanation.
  if (!user) {
    redirect("/login?error=session_required&next=%2Faccount%2Fpassword");
  }

  return (
    <AuthLayout
      eyebrow="أمان الحساب"
      title="اختر كلمة مرور جديدة"
      subtitle={
        user.email
          ? `ستُستخدم كلمة المرور الجديدة لتسجيل الدخول بالبريد ${user.email}.`
          : "اختر كلمة مرور قوية لا تستخدمها في مواقع أخرى."
      }
      footer={
        <Link
          href="/account"
          className="font-semibold text-accent transition-opacity hover:opacity-80"
        >
          العودة إلى حسابي
        </Link>
      }
    >
      <UpdatePasswordForm />
    </AuthLayout>
  );
}
