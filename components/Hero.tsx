"use client";

import { useState } from "react";
import { ArrowForwardIcon, LogoMark, SparkleIcon } from "./Icons";
import { MODEL_INFO } from "@/lib/models";

const EXAMPLES = [
  "صفحة هبوط أنيقة لمقهى اختصاصي يقدّم قهوة مختصة",
  "لوحة تحكم لتتبع مهام الفريق اليومية",
  "متجر إلكتروني بسيط لبيع الأحذية الرياضية",
  "صفحة تعريفية لتطبيق جوّال لتعلّم اللغات",
  "بورتفوليو شخصي لمصمم جرافيك",
];

interface HeroProps {
  onSubmit: (prompt: string, modelId: string) => void;
  isGenerating: boolean;
}

export default function Hero({ onSubmit, isGenerating }: HeroProps) {
  const [value, setValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_INFO[0].id);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed, selectedModel);
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute -top-40 right-[-8%] h-[440px] w-[440px] rounded-full bg-accent/20 blur-[130px] animate-glow-drift" />
      <div
        className="pointer-events-none absolute bottom-[-18%] left-[-10%] h-[400px] w-[400px] rounded-full bg-accent-deep/15 blur-[120px] animate-glow-drift"
        style={{ animationDelay: "-4s" }}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center animate-fade-up">
        <div className="mb-7 flex items-center gap-2 rounded-full border border-border-subtle bg-bg-panel/60 px-4 py-1.5 text-xs text-ink-muted backdrop-blur">
          <LogoMark className="h-5 w-5" />
          <span>بنّاء — مدعوم بنموذج Gemini 3.7 Flash</span>
        </div>

        <h1 className="text-4xl font-bold leading-[1.35] sm:text-5xl">
          صِف{" "}
          <span className="bg-gradient-to-l from-accent to-accent-soft bg-clip-text text-transparent">
            تطبيقك
          </span>
          ،
          <br />
          وشاهده يُبنى أمامك
        </h1>
        <p className="mt-4 max-w-md text-pretty leading-relaxed text-ink-muted">
          اكتب فكرتك بجملة أو جملتين، وسنقوم بتصميم وبرمجة تطبيق React متكامل
          وجاهز للعرض خلال ثوانٍ.
        </p>

        <div className="mt-10 w-full rounded-2xl border border-border-subtle bg-bg-panel/70 p-2 shadow-2xl shadow-black/40 backdrop-blur">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="مثال: صفحة هبوط لتطبيق توصيل طعام، بتصميم عصري وألوان دافئة..."
            rows={3}
            autoFocus
            className="w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
          />
          
          {/* Model selector */}
          <div className="mb-3 flex gap-2 overflow-x-auto px-2 pb-1">
            {MODEL_INFO.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`flex-shrink-0 rounded-lg border px-3 py-2 text-right text-xs transition-all ${
                  selectedModel === model.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-subtle bg-bg-panel/50 text-ink-muted hover:border-accent/50 hover:text-ink"
                }`}
              >
                <div className="font-semibold">{model.name}</div>
                <div className="mt-0.5 text-[10px] opacity-70">{model.description}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-2 pb-1">
            <span className="text-xs text-ink-faint">⌘ + Enter للإرسال</span>
            <button
              onClick={submit}
              disabled={!value.trim() || isGenerating}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-l from-accent to-accent-deep px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-accent/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جارٍ البناء...
                </>
              ) : (
                <>
                  ابدأ البناء
                  <ArrowForwardIcon className="transition-transform group-hover:-translate-x-1" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-1.5 text-xs text-ink-faint">
          <SparkleIcon className="h-3.5 w-3.5" />
          <span>أمثلة سريعة للبدء</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setValue(ex)}
              className="rounded-full border border-border-subtle bg-bg-panel/40 px-3.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
