"use client";

import { useEffect, useRef, useState } from "react";
import type { Version } from "@/lib/types";
import type { AuthUser } from "@/lib/auth-user";
import { MODEL_INFO } from "@/lib/models";
import UserMenu from "./auth/UserMenu";
import {
  CheckIcon,
  ErrorIcon,
  LayersIcon,
  LogoMark,
  PlusIcon,
  StopIcon,
  WrenchIcon,
} from "./Icons";

interface ChatSidebarProps {
  versions: Version[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  isGenerating: boolean;
  onNewProject: () => void;
  modelId: string;
  onModelChange: (modelId: string) => void;
  user: AuthUser | null;
}

export default function ChatSidebar({
  versions,
  activeId,
  onSelect,
  onSubmit,
  onCancel,
  isGenerating,
  onNewProject,
  modelId,
  onModelChange,
  user,
}: ChatSidebarProps) {
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
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

  const selectedModel = MODEL_INFO.find((m) => m.id === modelId) ?? MODEL_INFO[0];

  return (
    <aside className="flex w-full max-w-[340px] flex-shrink-0 flex-col border-l border-border-subtle bg-bg-elevated/70 sm:max-w-[380px]">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-7" />
          <span className="font-semibold">بنّاء</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewProject}
            className="flex items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            مشروع جديد
          </button>
          {/* Below `sm` the account chip lives in the page header instead — this
              row is already tight at 340px. */}
          <div className="hidden sm:block">
            <UserMenu user={user} variant="compact" />
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {versions.map((v, i) => (
          <VersionRow
            key={v.id}
            version={v}
            index={i}
            isActive={activeId === v.id}
            onSelect={() => onSelect(v.id)}
          />
        ))}
      </div>

      <div className="border-t border-border-subtle p-3">
        {/* The picker lives here, not only on the landing screen — before this the
            first prompt chose the model and every later edit silently reused it. */}
        <div className="relative mb-2">
          <button
            onClick={() => setModelOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-panel/50 px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
            aria-expanded={modelOpen}
            aria-haspopup="listbox"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <LayersIcon className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
              <span className="truncate">{selectedModel.name}</span>
            </span>
            <span className="text-[10px] opacity-60">{modelOpen ? "▲" : "▼"}</span>
          </button>

          {modelOpen && (
            <div
              role="listbox"
              className="absolute bottom-full left-0 right-0 z-30 mb-1.5 overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated shadow-2xl shadow-black/50"
            >
              {MODEL_INFO.map((model) => (
                <button
                  key={model.id}
                  role="option"
                  aria-selected={model.id === modelId}
                  onClick={() => {
                    onModelChange(model.id);
                    setModelOpen(false);
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-right transition-colors ${
                    model.id === modelId
                      ? "bg-accent/10 text-accent"
                      : "text-ink-muted hover:bg-bg-panel/60 hover:text-ink"
                  }`}
                >
                  <span className="text-xs font-semibold">{model.name}</span>
                  <span className="text-[10px] opacity-70">{model.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
            {isGenerating ? (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-red-400/40 hover:text-red-300"
              >
                <StopIcon className="h-3 w-3" />
                إيقاف
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!value.trim()}
                className="rounded-lg bg-gradient-to-l from-accent to-accent-deep px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
              >
                إرسال
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function VersionRow({
  version,
  index,
  isActive,
  onSelect,
}: {
  version: Version;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  const selectable = version.status === "done";
  const streamedFiles = version.streaming ? Object.keys(version.streaming.files).length : 0;

  return (
    <div className="animate-fade-up space-y-2">
      <div className="mr-auto max-w-[92%] rounded-2xl rounded-tl-md bg-bg-panel-soft px-3.5 py-2.5 text-sm leading-relaxed">
        {version.repairOf && (
          <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
            <WrenchIcon className="h-3 w-3" />
            إصلاح تلقائي
          </span>
        )}
        {version.prompt}
      </div>

      <button
        onClick={() => selectable && onSelect()}
        disabled={!selectable}
        className={`flex w-full items-center gap-2 rounded-2xl rounded-tr-md border px-3.5 py-2.5 text-start text-sm transition-colors ${
          isActive
            ? "border-accent/50 bg-accent/10 text-ink"
            : "border-border-subtle bg-bg-panel/40 text-ink-muted hover:border-border-strong"
        } ${selectable ? "cursor-pointer" : "cursor-default"}`}
      >
        {version.status === "pending" && (
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
            {/* A real count beats a fake progress bar: it is what actually arrived. */}
            {streamedFiles > 0 ? `جارٍ الكتابة… ${streamedFiles} ملف` : "جارٍ البناء…"}
          </>
        )}
        {version.status === "done" && (
          <>
            <CheckIcon className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
            <span>الإصدار {index + 1} — جاهز للمعاينة</span>
          </>
        )}
        {version.status === "cancelled" && (
          <span className="text-ink-faint">أُلغي الطلب</span>
        )}
        {version.status === "error" && (
          <>
            <ErrorIcon className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
            <span className="truncate text-red-300">
              {version.errorMessage || "حدث خطأ أثناء التوليد"}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
