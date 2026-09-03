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

## 📁 هيكلية المشروع

```
app/
  layout.tsx              التخطيط العام والخطوط
  page.tsx                 الصفحة الرئيسية وإدارة الحالة
  api/generate/route.ts    مسار التوليد عبر Gemini
components/
  Hero.tsx                 شاشة الترحيب والبدء
  ChatSidebar.tsx          شريط المحادثة وسجل الإصدارات
  PreviewPanel.tsx         المعاينة الحية والتحكم بأحجام العرض
  CodeViewer.tsx           مستعرض الملفات والكود التفاعلي
lib/
  gemini.ts                هندسة التوليد لـ React متعدد المكوّنات
  bundler.ts               مُجمّع React ومعالج الأيقونات في المتصفح
  zip.ts                   مُنشئ أرشيف Vite + React ZIP
  highlight.ts              مُلوّن الكود
  types.ts                 أنواع البيانات المشتركة
```
