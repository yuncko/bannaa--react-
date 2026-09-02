"use client";

import { useMemo, useState } from "react";
import type { ReactProject } from "@/lib/types";
import { highlightCode } from "@/lib/highlight";
import {
  Check,
  Copy,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface CodeViewerProps {
  project: ReactProject;
}

export default function CodeViewer({ project }: CodeViewerProps) {
  const files = project.files || {};
  const fileKeys = Object.keys(files);

  const defaultFile =
    fileKeys.find((f) => f.includes("App.tsx") || f.includes("App.jsx")) ||
    fileKeys[0] ||
    "src/App.tsx";

  const [activeFile, setActiveFile] = useState<string>(defaultFile);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    return fileKeys.slice(0, 4);
  });
  const [copiedFile, setCopiedFile] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Group files into folder tree
  const fileTree = useMemo(() => {
    const components: string[] = [];
    const srcRoot: string[] = [];
    const others: string[] = [];

    for (const path of fileKeys) {
      if (path.includes("components/")) {
        components.push(path);
      } else if (path.startsWith("src/")) {
        srcRoot.push(path);
      } else {
        others.push(path);
      }
    }

    return { components, srcRoot, others };
  }, [fileKeys]);

  const activeContent = files[activeFile] || "";
  const highlighted = useMemo(
    () => highlightCode(activeContent, activeFile),
    [activeContent, activeFile]
  );

  function handleSelectFile(path: string) {
    setActiveFile(path);
    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
  }

  function handleCloseTab(path: string, e: React.MouseEvent) {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(nextTabs);
    if (activeFile === path && nextTabs.length > 0) {
      setActiveFile(nextTabs[nextTabs.length - 1]);
    }
  }

  function handleCopyActive() {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent).then(() => {
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 1600);
    });
  }

  function handleCopyAll() {
    const fullBundle = Object.entries(files)
      .map(([path, code]) => `// ================= ${path} =================\n${code}\n`)
      .join("\n\n");

    navigator.clipboard.writeText(fullBundle).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1600);
    });
  }

  function getFileIcon(path: string) {
    if (path.endsWith(".tsx") || path.endsWith(".jsx")) {
      return <span className="text-cyan-400 font-mono text-[11px] font-bold">⚛</span>;
    }
    if (path.endsWith(".ts") || path.endsWith(".js")) {
      return <span className="text-blue-400 font-mono text-[11px] font-bold">TS</span>;
    }
    if (path.endsWith(".css")) {
      return <span className="text-indigo-400 font-mono text-[11px] font-bold">#</span>;
    }
    if (path.endsWith(".json")) {
      return <FileJson className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  }

  function getBaseName(path: string) {
    return path.split("/").pop() || path;
  }

  const lines = activeContent.split("\n");

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0a0d14] text-slate-200">
      {/* File Explorer Sidebar */}
      <div className="flex w-60 flex-shrink-0 flex-col border-r border-slate-800/80 bg-[#0d111a] text-xs">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Layers className="h-3.5 w-3.5 text-rose-400" />
            <span>ملفات المشروع</span>
          </div>
          <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {fileKeys.length} ملفات
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 select-none">
          {/* src/ folder */}
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 font-medium text-slate-400">
              <FolderOpen className="h-3.5 w-3.5 text-amber-400/80" />
              <span>src</span>
            </div>

            {/* src/components/ subfolder */}
            {fileTree.components.length > 0 && (
              <div className="mr-3 border-r border-slate-800 pr-1 my-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1 font-medium text-slate-400">
                  <Folder className="h-3.5 w-3.5 text-amber-400/80" />
                  <span>components</span>
                </div>
                <div className="mr-2 pr-1 space-y-0.5">
                  {fileTree.components.map((path) => (
                    <button
                      key={path}
                      onClick={() => handleSelectFile(path)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-right transition-colors ${
                        activeFile === path
                          ? "bg-rose-500/15 text-rose-300 font-medium"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                    >
                      {getFileIcon(path)}
                      <span className="truncate">{getBaseName(path)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* src root files (App.tsx, types.ts, etc.) */}
            <div className="mr-3 border-r border-slate-800 pr-1 space-y-0.5">
              {fileTree.srcRoot.map((path) => (
                <button
                  key={path}
                  onClick={() => handleSelectFile(path)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-right transition-colors ${
                    activeFile === path
                      ? "bg-rose-500/15 text-rose-300 font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  {getFileIcon(path)}
                  <span className="truncate">{getBaseName(path)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Root config files */}
          {fileTree.others.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60">
              {fileTree.others.map((path) => (
                <button
                  key={path}
                  onClick={() => handleSelectFile(path)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-right transition-colors ${
                    activeFile === path
                      ? "bg-rose-500/15 text-rose-300 font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  {getFileIcon(path)}
                  <span className="truncate">{getBaseName(path)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-slate-800/80 p-2">
          <button
            onClick={handleCopyAll}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            {copiedAll ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">تم نسخ كامل المشروع!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ كل الملفات</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor & Code Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Open Tabs & Toolbar */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#0d111a] px-2">
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 no-scrollbar">
            {openTabs.map((path) => (
              <div
                key={path}
                onClick={() => setActiveFile(path)}
                className={`group flex items-center gap-2 rounded-lg border px-3 py-1 text-xs cursor-pointer transition-colors ${
                  activeFile === path
                    ? "border-slate-700 bg-slate-800 text-slate-100 font-medium"
                    : "border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-300"
                }`}
              >
                {getFileIcon(path)}
                <span className="font-mono text-[11px]">{getBaseName(path)}</span>
                {openTabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(path, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 text-slate-500 rounded p-0.5 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pr-2">
            <span className="text-[11px] font-mono text-slate-500">
              {lines.length} سطر
            </span>
            <button
              onClick={handleCopyActive}
              title="نسخ الملف الحالي"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
            >
              {copiedFile ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>نسخ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="relative flex-1 overflow-auto bg-[#0a0d14]">
          <pre className="min-w-max p-4 font-mono text-[13px] leading-6 dir-ltr text-left">
            {lines.map((_, i) => (
              <div key={i} className="flex hover:bg-slate-900/40 px-2 -mx-2 rounded">
                <span className="mr-5 w-8 flex-shrink-0 select-none text-right text-slate-600 font-mono text-xs">
                  {i + 1}
                </span>
                <span
                  className="whitespace-pre text-slate-200"
                  dangerouslySetInnerHTML={{
                    __html: highlighted.split("\n")[i] ?? "",
                  }}
                />
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
