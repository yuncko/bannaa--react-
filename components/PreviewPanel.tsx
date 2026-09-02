"use client";

import { useEffect, useMemo, useState } from "react";
import type { Version } from "@/lib/types";
import { generatePreviewHtml } from "@/lib/bundler";
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
} from "./Icons";

export type ViewMode = "preview" | "code";

interface PreviewPanelProps {
  version: Version | null;
  showLoading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const LOADING_STEPS = [
  "جارٍ فهم الطلب...",
  "جارٍ التخطيط لتطبيق React...",
  "جارٍ كتابة المكوّنات والكود...",
  "جارٍ تنسيق الألوان والخطوط...",
  "جارٍ اللمسات الأخيرة...",
];

function LoadingStatus() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-accent" />
      {LOADING_STEPS[stepIndex]}
    </div>
  );
}

export default function PreviewPanel({
  version,
  showLoading,
  viewMode,
  onViewModeChange,
}: PreviewPanelProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeFile, setActiveFile] = useState<string>("src/App.tsx");

  const project = version?.project;
  const hasProject = Boolean(
    project && project.files && Object.keys(project.files).length > 0
  );

  const fileKeys = useMemo(
    () => (project?.files ? Object.keys(project.files) : []),
    [project]
  );

  useEffect(() => {
    if (fileKeys.length > 0 && !fileKeys.includes(activeFile)) {
      const appFile = fileKeys.find((f) => f.includes("App.tsx")) || fileKeys[0];
      setActiveFile(appFile);
    }
  }, [fileKeys, activeFile]);

  const activeCode = (project?.files && project.files[activeFile]) || "";
  const highlighted = useMemo(
    () => (activeCode ? highlightCode(activeCode, activeFile) : ""),
    [activeCode, activeFile]
  );

  const previewHtml = useMemo(() => {
    if (!project) return "";
    return generatePreviewHtml(project);
  }, [project]);

  function handleCopy() {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function handleDownload() {
    if (!project) return;
    downloadProjectZip(project);
  }

  function handleOpenNewTab() {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function getBaseName(path: string) {
    return path.split("/").pop() || path;
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      {/* Top Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-bg-panel/60 p-0.5">
          <button
            onClick={() => onViewModeChange("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "preview"
                ? "bg-bg-panel-soft text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <EyeIcon className="h-3.5 w-3.5" />
            معاينة
          </button>
          <button
            onClick={() => onViewModeChange("code")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "code"
                ? "bg-bg-panel-soft text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <CodeIcon className="h-3.5 w-3.5" />
            الكود (React)
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            disabled={!hasProject}
            title="تحديث المعاينة"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={handleCopy}
            disabled={!hasProject}
            title="نسخ الكود"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            {copied ? <CheckIcon className="h-4 w-4 text-accent" /> : <CopyIcon />}
          </button>
          <button
            onClick={handleDownload}
            disabled={!hasProject}
            title="تحميل مشروع React (.zip)"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <DownloadIcon />
          </button>
          <button
            onClick={handleOpenNewTab}
            disabled={!hasProject}
            title="فتح في نافذة جديدة"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-bg-panel/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ExternalLinkIcon />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {showLoading && (
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
            <LoadingStatus />
          </div>
        )}

        {!showLoading && !hasProject && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-faint">
            <EyeIcon className="h-8 w-8" />
            <p className="text-sm">ستظهر المعاينة هنا بعد إنشاء أول نسخة</p>
          </div>
        )}

        {!showLoading && hasProject && viewMode === "preview" && (
          <iframe
            key={`${version?.id}-${iframeKey}`}
            srcDoc={previewHtml}
            title="معاينة حية لتطبيق React"
            className="h-full w-full bg-bg-elevated"
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
          />
        )}

        {!showLoading && hasProject && viewMode === "code" && (
          <div className="flex h-full flex-col bg-bg-elevated">
            {/* Multi-file tab selector */}
            {fileKeys.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle bg-bg-panel/50 px-3 py-2 no-scrollbar">
                {fileKeys.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFile(f)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
                      activeFile === f
                        ? "bg-bg-panel-soft text-accent-soft font-semibold shadow-sm"
                        : "text-ink-muted hover:bg-bg-panel/60 hover:text-ink"
                    }`}
                  >
                    <span className="text-[10px] text-accent font-bold">⚛</span>
                    <span>{getBaseName(f)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <pre className="font-code min-w-max px-4 py-4 text-[13px] leading-6 dir-ltr text-left">
                {activeCode.split("\n").map((_, i) => (
                  <div key={i} className="flex">
                    <span className="ml-4 w-8 flex-shrink-0 select-none text-left text-ink-faint">
                      {i + 1}
                    </span>
                    <span
                      className="whitespace-pre text-ink"
                      dangerouslySetInnerHTML={{
                        __html: highlighted.split("\n")[i] ?? "",
                      }}
                    />
                  </div>
                ))}
              </pre>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
