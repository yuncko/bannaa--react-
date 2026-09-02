import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بنّاء — صِف تطبيقك، وشاهده يُبنى",
  description:
    "بنّاء أداة ذكاء اصطناعي تحوّل وصفك النصي إلى صفحة ويب كاملة وجاهزة خلال ثوانٍ، مدعومة بنموذج Gemini من Google.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- next/font/google fetches at build time, which needs network access to Google Fonts that isn't guaranteed in every build environment; a plain <link> keeps this portable across dev, this sandbox, and any deploy target. */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
