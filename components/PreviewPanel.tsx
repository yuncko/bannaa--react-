"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewError, ReactProject, Version } from "@/lib/types";
import { generatePreviewHtml } from "@/lib/bundler";
import { isPreviewMessage } from "@/lib/preview-protocol";
import { highlightCode } from "@/lib/highlight";
import { downloadProjectZip } from "@/lib/zip";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  RefreshIcon,
  WarningIcon,
  WrenchIcon,
} from "./Icons";

export type ViewMode = "preview" | "code";

interface PreviewPanelProps {
  version: Version | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** Called when the sandbox reports a runtime error the model could fix. */
  onRuntimeError?: (versionId: string, error: PreviewError) => void;
  isGenerating: boolean;
}

interface PreviewIssue {
  message: string;
  file?: string;
  stack?: string;
  /** Missing packages are a soft warning; the page usually still renders. */
  kind: "error" | "missing-module";
}

export default function PreviewPanel({
  version,
  viewMode,
  onViewModeChange,
  onRuntimeError,
  isGenerating,
}: PreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeFile, setActiveFile] = useState<string>("src/App.tsx");
  const [issue, setIssue] = useState<PreviewIssue | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Prevents one crash from triggering repeated repair requests per render.
  const reportedRef = useRef<string | null>(null);

  const isStreaming = version?.status === "pending";
  const streaming = version?.streaming;

  /**
   * During generation the panel renders the partial file set, so the user watches
   * the project appear instead of a fake progress animation.
   */
  const displayProject: ReactProject | null = useMemo(() => {
    if (version?.project) return version.project;
    if (streaming && Object.keys(streaming.files).length > 0) {
      return {
        title: streaming.title || "جارٍ البناء…",
        description: streaming.description || "",
        files: streaming.files,
      };
    }
    return null;
  }, [version?.project, streaming]);

  const fileKeys = useMemo(
    () => (displayProject?.files ? Object.keys(displayProject.files) : []),
    [displayProject]
  );

  // Follow the file being written, then settle on the entry once it is done.
  useEffect(() => {
    if (isStreaming && streaming?.activeFile) {
      setActiveFile(streaming.activeFile);
      return;
    }
    if (fileKeys.length > 0 && !fileKeys.includes(activeFile)) {
      setActiveFile(fileKeys.find((f) => f.includes("App.")) || fileKeys[0]);
    }
  }, [isStreaming, streaming?.activeFile, fileKeys, activeFile]);

  const activeCode = displayProject?.files?.[activeFile] || "";
  const highlighted = useMemo(
    () => (activeCode ? highlightCode(activeCode, activeFile) : ""),
    [activeCode, activeFile]
  );

  // Only a settled project is executed: transpiling a half-written file would
  // throw a syntax error on every keystroke of the stream.
  const runnableProject = version?.status === "done" ? version.project : null;

  const previewHtml = useMemo(
    () => (runnableProject ? generatePreviewHtml(runnableProject) : ""),
    [runnableProject]
  );

  useEffect(() => {
    setIssue(null);
    reportedRef.current = null;
  }, [version?.id, iframeKey]);

  /**
   * Sandbox messages arrive from an opaque origin, so `event.origin` is "null"
   * and cannot be checked. Identity is established by comparing `event.source`
   * to this panel's own iframe, then validating the envelope.
   */
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      if (!isPreviewMessage(event.data)) return;

      const { payload } = event.data;
      if (payload.kind === "ready") {
        // `ready` only means the app mounted. It must not clear an issue, because
        // a missing module is reported during resolution and the app then mounts
        // anyway — clearing here would erase the warning the instant it arrived.
        // Stale issues are already dropped by the reset effect above.
        return;
      }

      if (payload.kind === "missing-module") {
        setIssue((prev) =>
          prev?.kind === "error"
            ? prev
            : { kind: "missing-module", message: payload.module || payload.message }
        );
        return;
      }

      const next: PreviewIssue = {
        kind: "error",
        message: payload.message,
        file: payload.file,
        stack: [payload.stack, payload.componentStack].filter(Boolean).join("\n\n") || undefined,
      };
      setIssue(next);

      // One automatic repair attempt per distinct failure, and never while
      // another generation is already running.
      const fingerprint = `${version?.id}:${payload.message}`;
      if (version?.id && !isGenerating && reportedRef.current !== fingerprint) {
        reportedRef.current = fingerprint;
        onRuntimeError?.(version.id, {
          message: next.message,
          file: next.file,
          stack: next.stack,
        });
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [version?.id, isGenerating, onRuntimeError]);

  const handleCopy = useCallback(() => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [activeCode]);

  function handleDownload() {
    if (runnableProject) downloadProjectZip(runnableProject);
  }

  function handleOpenNewTab() {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const hasRunnable = Boolean(runnableProject);
  const showCodeStream = isStreaming && fileKeys.length > 0;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-panel/60 p-0.5">
          <button
            onClick={() => onViewModeChange("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "preview" ? "bg-bg-panel-soft text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            <EyeIcon className="h-3.5 w-3.5" />
            معاينة
          </button>
          <button
            onClick={() => onViewModeChange("code")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "code" ? "bg-bg-panel-soft text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            <CodeIcon className="h-3.5 w-3.5" />
            الكود (React)
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            disabled={!hasRunnable}
            title="تحديث المعاينة"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={handleCopy}
            disabled={!activeCode}
            title="نسخ الكود"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <CopyIcon />}
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasRunnable}
            title="تحميل مشروع React (.zip)"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <DownloadIcon />
          </button>
          <button
            onClick={handleOpenNewTab}
            disabled={!hasRunnable}
            title="فتح في نافذة جديدة"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ExternalLinkIcon />
          </button>
        </div>
      </div>

      {issue && (
        <PreviewIssueBanner
          issue={issue}
          onRepair={
            version?.id && !isGenerating && issue.kind === "error"
              ? () =>
                  onRuntimeError?.(version.id, {
                    message: issue.message,
                    file: issue.file,
                    stack: issue.stack,
                  })
              : undefined
          }
          onDismiss={() => setIssue(null)}
        />
      )}

      <div className="relative flex-1 overflow-hidden">
        {isStreaming && !showCodeStream && <StreamingSkeleton model={streaming?.model} />}

        {!isStreaming && !hasRunnable && !showCodeStream && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-faint">
            <EyeIcon className="h-8 w-8" />
            <p className="text-sm">ستظهر المعاينة هنا بعد إنشاء أول نسخة</p>
          </div>
        )}

        {/* While streaming, the code view is the live surface — the preview cannot
            run yet, so showing the files being written is the honest progress. */}
        {(showCodeStream || viewMode === "code") && (displayProject || showCodeStream) && (
          <CodeView
            fileKeys={fileKeys}
            activeFile={activeFile}
            onSelect={setActiveFile}
            code={activeCode}
            highlighted={highlighted}
            activeStreamingFile={isStreaming ? streaming?.activeFile : undefined}
          />
        )}

        {!showCodeStream && viewMode === "preview" && hasRunnable && (
          <iframe
            ref={iframeRef}
            key={`${version?.id}-${iframeKey}`}
            srcDoc={previewHtml}
            title="معاينة حية لتطبيق React"
            className="h-full w-full bg-bg-elevated"
            // No `allow-same-origin`: the generated code is model-authored and
            // must not reach this page's origin, storage, or API routes.
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
          />
        )}
      </div>
    </section>
  );
}

function StreamingSkeleton({ model }: { model?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-bg px-6">
      <div className="w-full max-w-sm space-y-3">
        <div className="h-3 w-2/3 animate-shimmer rounded-full bg-bg-panel" />
        <div className="h-24 w-full animate-shimmer rounded-2xl bg-bg-panel" />
        <div className="flex gap-3">
          <div className="h-16 flex-1 animate-shimmer rounded-xl bg-bg-panel" />
          <div className="h-16 flex-1 animate-shimmer rounded-xl bg-bg-panel" />
          <div className="h-16 flex-1 animate-shimmer rounded-xl bg-bg-panel" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent" />
        {model ? `النموذج ${model} يكتب المشروع…` : "جارٍ الاتصال بالنموذج…"}
      </div>
    </div>
  );
}

function PreviewIssueBanner({
  issue,
  onRepair,
  onDismiss,
}: {
  issue: PreviewIssue;
  onRepair?: () => void;
  onDismiss: () => void;
}) {
  const isError = issue.kind === "error";

  return (
    <div
      className={`flex flex-shrink-0 items-start gap-2.5 border-b px-4 py-2.5 text-xs ${
        isError
          ? "border-red-500/25 bg-red-500/10 text-red-200"
          : "border-amber-500/25 bg-amber-500/10 text-amber-200"
      }`}
    >
      <WarningIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {isError ? "خطأ في تشغيل المعاينة" : `حزمة غير متوفرة في بيئة المعاينة: ${issue.message}`}
        </p>
        {isError && (
          <p dir="ltr" className="mt-1 truncate font-mono text-[11px] opacity-80">
            {issue.file ? `${issue.file}: ` : ""}
            {issue.message}
          </p>
        )}
      </div>
      {onRepair && (
        <button
          onClick={onRepair}
          className="flex flex-shrink-0 items-center gap-1 rounded-md border border-red-400/30 px-2 py-1 font-semibold transition-colors hover:bg-red-500/20"
        >
          <WrenchIcon className="h-3 w-3" />
          إصلاح تلقائي
        </button>
      )}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 rounded-md px-1.5 py-1 opacity-60 transition-opacity hover:opacity-100"
        aria-label="إخفاء التنبيه"
      >
        ✕
      </button>
    </div>
  );
}

function CodeView({
  fileKeys,
  activeFile,
  onSelect,
  code,
  highlighted,
  activeStreamingFile,
}: {
  fileKeys: string[];
  activeFile: string;
  onSelect: (file: string) => void;
  code: string;
  highlighted: string;
  activeStreamingFile?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => code.split("\n"), [code]);
  const highlightedLines = useMemo(() => highlighted.split("\n"), [highlighted]);

  // Keep the newest line in view while a file streams in.
  useEffect(() => {
    if (!activeStreamingFile) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeStreamingFile, code]);

  return (
    <div className="flex h-full flex-col bg-bg-elevated">
      {fileKeys.length > 1 && (
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-border-subtle bg-bg-panel/50 px-3 py-2">
          {fileKeys.map((f) => (
            <button
              key={f}
              onClick={() => onSelect(f)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-colors ${
                activeFile === f
                  ? "bg-bg-panel-soft font-semibold text-accent-soft shadow-sm"
                  : "text-ink-muted hover:bg-bg-panel/60 hover:text-ink"
              }`}
            >
              {f === activeStreamingFile ? (
                <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent" />
              ) : (
                <span className="text-[10px] font-bold text-accent">⚛</span>
              )}
              <span>{f.split("/").pop()}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <pre className="font-code dir-ltr min-w-max px-4 py-4 text-left text-[13px] leading-6">
          {lines.map((_, i) => (
            <div key={i} className="flex">
              <span className="ml-4 w-8 flex-shrink-0 select-none text-left text-ink-faint">
                {i + 1}
              </span>
              <span
                className="whitespace-pre text-ink"
                dangerouslySetInnerHTML={{ __html: highlightedLines[i] ?? "" }}
              />
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
