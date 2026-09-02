"use client";

import { useEffect, useRef, useState } from "react";
import type { Version } from "@/lib/types";
import { CheckIcon, ErrorIcon, LogoMark, PlusIcon } from "./Icons";

interface ChatSidebarProps {
  versions: Version[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  onNewProject: () => void;
}

export default function ChatSidebar({
  versions,
  activeId,
  onSelect,
  onSubmit,
  isGenerating,
  onNewProject,
}: ChatSidebarProps) {
  const [value, setValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [versions.length]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <aside className="flex w-full max-w-[340px] flex-shrink-0 flex-col border-l border-border-subtle bg-bg-elevated/70 sm:max-w-[380px]">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-semibold">بنّاء</span>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          مشروع جديد
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {versions.map((v, i) => (
          <div key={v.id} className="animate-fade-up space-y-2">
            <div className="mr-auto max-w-[92%] rounded-2xl rounded-tl-md bg-bg-panel-soft px-3.5 py-2.5 text-sm leading-relaxed">
              {v.prompt}
            </div>

            <button
              onClick={() => v.status === "done" && onSelect(v.id)}
              disabled={v.status !== "done"}
              className={`flex w-full items-center gap-2 rounded-2xl rounded-tr-md border px-3.5 py-2.5 text-start text-sm transition-colors ${
                activeId === v.id
                  ? "border-accent/50 bg-accent/10 text-ink"
                  : "border-border-subtle bg-bg-panel/40 text-ink-muted hover:border-border-strong"
              } ${v.status !== "done" ? "cursor-default" : "cursor-pointer"}`}
            >
              {v.status === "pending" && (
                <>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent" />
                    <span
                      className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </span>
                  جارٍ البناء...
                </>
              )}
              {v.status === "done" && (
                <>
                  <CheckIcon className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                  <span>الإصدار {i + 1} — جاهز للمعاينة</span>
                </>
              )}
              {v.status === "error" && (
                <>
                  <ErrorIcon className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                  <span className="truncate text-red-300">
                    {v.errorMessage || "حدث خطأ أثناء التوليد"}
                  </span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-border-subtle p-3">
        <div className="rounded-xl border border-border-subtle bg-bg-panel/60 p-1.5 transition-colors focus-within:border-accent/40">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="اطلب تعديلاً... مثال: غيّر اللون الأساسي إلى أزرق"
            rows={2}
            className="w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed placeholder:text-ink-faint focus:outline-none"
          />
          <div className="flex justify-end px-1 pb-1">
            <button
              onClick={submit}
              disabled={!value.trim() || isGenerating}
              className="rounded-lg bg-gradient-to-l from-accent to-accent-deep px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              إرسال
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
