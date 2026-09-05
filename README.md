# بنّاء (Bannaa) 🏗️ — Lovable-Style React Generator

أداة ذكاء اصطناعي تحوّل وصفك النصي إلى **مشروع React + TypeScript كامل ومتعدد المكوّنات** يعمل فورًا — تمامًا مثل منصات **Lovable.dev** و **v0.dev** — مبنية بـ Next.js 16 ومدعومة بنموذج **Gemini 2.5/3.5 Flash**.

---

## ✨ المميزات الرئيسية

1. ⚛️ **مشاريع React حقيقية ومعيارية**:
   - لا مزيد من صفحات HTML البسيطة! يُنتج التطبيق هيكلية مشروع متكاملة:
     - `src/App.tsx`: المكوّن الرئيسي وتجميع الحالة
     - `src/components/Navbar.tsx`: شريط التنقل المتجاوب
     - `src/components/Hero.tsx`: قسم الواجهة الرئيسية
     - `src/components/Features.tsx`: المزايا والبطاقات
     - `src/components/Pricing.tsx`: جداول الأسعار
     - `src/types.ts`: أنواع TypeScript ونماذج البيانات
2. 👁️ **معاينة حيّة فورية داخل المتصفح**:
   - مُجمّع (Bundler) ومحلل وحدات في الذاكرة يقوم بترجمة TypeScript وJSX عبر Babel Standalone وتشغيل React وTailwind CSS وLucide Icons فورًا في المتصفح دون الحاجة لخادم بناء خارجي.
3. 💻 **مستعرض كود تفاعلي شبيه بـ Lovable**:
   - شجرة ملفات تفاعلية (File Explorer)
   - تبويبات للملفات المفتوحة (Tabs)
   - تلوين برمجي متطور لكود TSX/CSS/JSON
   - أزرار نسخ لكل ملف أو لكامل المشروع
4. 📱 **التحكم بأحجام العرض المتجاوبة**:
   - سطح المكتب (Desktop 100%)
   - أجهزة لوحية (Tablet 768px)
   - هواتف ذكية (Mobile 375px)
5. 📦 **تصدير كود المشروع بضغطة زر كـ Vite + React ZIP**:
   - يمكنك تنزيل ملف `.zip` يحتوي على مشروع Vite + React + TypeScript + Tailwind جاهز تمامًا للتشغيل محليًا عبر:
     ```bash
     npm install
     npm run dev
     ```
6. 🔄 **تعديلات وتكرارات ذكية**:
   - يمكنك الاستمرار في تحسين وتعديل التطبيق عبر المحادثة (مثل: "أضف وضع ليلي"، "أضف زر فلترة"، "غيّر الألوان إلى الزمردي").

---

## 🚀 التشغيل محليًا

1. تثبيت الحزم:
```bash
npm install
```

2. أنشئ ملف `.env.local` (انسخه من `.env.example`) وضع فيه مفاتيح Omnirouter:
```env
OMNIROUTER_API_KEY_1=your_first_key
OMNIROUTER_API_KEY_2=your_second_key
OMNIROUTER_API_KEY_3=your_third_key
```
> المفاتيح تُقرأ من متغيّرات البيئة على الخادم فقط، ولا تُضمَّن في كود المتصفح.
> ملف `.env.local` مستثنى من Git ولا يجب رفعه أبدًا.

3. تشغيل خادم التطوير:
```bash
npm run dev
```

4. افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

---

## 🔐 تسجيل الدخول (Supabase)

تسجيل الدخول **اختياري**: بدون متغيّرات Supabase يعمل التوليد كما هو، وتظهر شاشات
الدخول برسالة توضّح المتغيّر الناقص بدلًا من أن تتعطّل.

### 1. المتغيّرات

أضف إلى `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
# مطلوب في الإنتاج فقط، لبناء روابط OAuth والبريد بعنوان الموقع الصحيح
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

المفتاح أعلاه **عام بطبيعته** — الحماية الفعلية للبيانات تأتي من Row Level
Security على الجداول. مفتاح `service_role` لا يُوضع في متغيّر `NEXT_PUBLIC_*`
ولا في كود العميل أبدًا.

### 2. إعدادات لوحة Supabase

في **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` للتطوير، وعنوان النشر في الإنتاج.
- **Redirect URLs** — أضف كل عنوان يُستخدم فعلًا:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/auth/confirm`

عنوان غير مُسجَّل في هذه القائمة يُرفض، فيعود المستخدم إلى
`/login?error=exchange_failed`.

### 3. مزوّدو الدخول

في **Authentication → Sign In / Providers** فعّل:

| المزوّد | ما تحتاجه | عنوان العودة (Callback) في لوحة المزوّد |
| --- | --- | --- |
| Google | Client ID و Client Secret من Google Cloud Console | `https://<project-ref>.supabase.co/auth/v1/callback` |
| GitHub | Client ID و Client Secret من GitHub → Developer settings → OAuth Apps | `https://<project-ref>.supabase.co/auth/v1/callback` |

> عنوان العودة يُسجَّل عند Google/GitHub بعنوان **Supabase** لا بعنوان موقعك؛
> Supabase هي التي تعيد التوجيه بعدها إلى `/auth/callback` عندك.

مزوّد غير مُفعَّل يُنتج رسالة عربية واضحة («هذا المزوّد غير مُفعَّل على المشروع»)
بدل خطأ عام.

### 4. قوالب البريد

هذا المشروع يتحقّق من الروابط على الخادم عبر `token_hash`، وهو الشكل الموصى به.
في **Authentication → Email Templates** اجعل الرابط في كل قالب:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Email.ActionType }}">
  تأكيد
</a>
```

القوالب الافتراضية التي تستخدم `{{ .ConfirmationURL }}` تعمل أيضًا: تصل إلى
`/auth/callback` بمعامل `code`، وهو مسار مدعوم كذلك.

### 5. المسارات

| المسار | الوظيفة |
| --- | --- |
| `/login` | دخول بالبريد أو عبر Google / GitHub |
| `/signup` | إنشاء حساب |
| `/forgot-password` | إرسال رابط إعادة التعيين |
| `/account` | بيانات الحساب وتسجيل الخروج |
| `/account/password` | تعيين كلمة مرور جديدة |
| `/auth/callback` | تبديل `code` بجلسة (PKCE / OAuth) |
| `/auth/confirm` | التحقّق من `token_hash` لروابط البريد |

`/account` و`/account/password` محميّان في `proxy.ts` وتُعاد التحقّق منهما داخل
الصفحة نفسها، فلا يكفي تعديل الـ matcher لتجاوزهما.

---

## 📁 هيكلية المشروع

```
proxy.ts                     تحديث الجلسة على كل طلب وحماية المسارات
app/
  layout.tsx                 التخطيط العام والخطوط
  page.tsx                   قراءة الجلسة ثم تمريرها إلى الواجهة
  api/generate/route.ts      مسار التوليد والبثّ (NDJSON)
  auth/actions.ts            إجراءات الخادم: دخول، تسجيل، OAuth، خروج
  auth/callback/route.ts     عودة OAuth: تبديل code بجلسة
  auth/confirm/route.ts      روابط البريد: التحقّق من token_hash
  login/, signup/, forgot-password/, account/
components/
  AppShell.tsx               حالة الواجهة: الترحيب أو ورشة العمل
  Hero.tsx                   شاشة الترحيب والبدء
  ChatSidebar.tsx            شريط المحادثة وسجل الإصدارات
  PreviewPanel.tsx           المعاينة الحية والتحكم بأحجام العرض
  Icons.tsx                  أيقونات الواجهة وشعارات المزوّدين
  auth/                      AuthLayout، الحقول، النماذج، قائمة المستخدم
lib/
  omnirouter.ts              هندسة التوليد والاتصال بالمزوّد (خادم فقط)
  bundler.ts                 مُجمّع React ومعالج الأيقونات في المتصفح
  project.ts                 تطبيع مخرجات النموذج ودمج التعديلات
  useGeneration.ts           دورة حياة التوليد: البثّ، الإلغاء، الإصلاح
  supabase/                  عميل المتصفح، عميل الخادم، الإعدادات
  auth-messages.ts           رسائل الأخطاء العربية والتحقّق من المدخلات
  auth-redirect.ts           تأمين وجهة التوجيه بعد الدخول
  zip.ts                     مُنشئ أرشيف Vite + React ZIP
  types.ts                   أنواع البيانات المشتركة
tests/                       اختبارات node:test لوحدات lib
```

---

## ✅ الفحص

```bash
npx tsc --noEmit    # فحص الأنواع
npm run lint        # ESLint
npm test            # اختبارات الوحدات
npm run build       # بناء الإنتاج
```

