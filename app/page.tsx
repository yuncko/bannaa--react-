"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import ChatSidebar from "@/components/ChatSidebar";
import PreviewPanel, { ViewMode } from "@/components/PreviewPanel";
import { LogoMark } from "@/components/Icons";
import type { Version } from "@/lib/types";

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  const activeVersion = versions.find((v) => v.id === activeId) ?? null;
  const lastDoneVersion = [...versions].reverse().find((v) => v.status === "done");

  async function handleSubmit(prompt: string, modelId?: string) {
    const id = makeId();
    const baseProject =
      activeVersion?.status === "done" ? activeVersion.project : lastDoneVersion?.project;

    const newVersion: Version = {
      id,
      prompt,
      project: null,
      status: "pending",
      createdAt: Date.now(),
    };

    setVersions((prev) => [...prev, newVersion]);
    setActiveId(id);
    setIsGenerating(true);
    setViewMode("preview");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          previousProject: baseProject,
          modelId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "حدث خطأ غير متوقع.");
      }

      setVersions((prev) =>
        prev.map((v) =>
          v.id === id ? { ...v, project: data.project, status: "done" } : v
        )
      );
    } catch (err) {
      setVersions((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                status: "error",
                errorMessage: err instanceof Error ? err.message : "خطأ غير متوقع",
              }
            : v
        )
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleNewProject() {
    setVersions([]);
    setActiveId(null);
    setViewMode("preview");
  }

  if (versions.length === 0) {
    return <Hero onSubmit={handleSubmit} isGenerating={isGenerating} />;
  }

  const showLoadingInPreview = activeVersion?.status === "pending";

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2.5 sm:hidden">
        <LogoMark className="h-6 w-6" />
        <span className="text-sm font-semibold">بنّاء</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <ChatSidebar
          versions={versions}
          activeId={activeId}
          onSelect={setActiveId}
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
          onNewProject={handleNewProject}
        />
        <PreviewPanel
          version={activeVersion}
          showLoading={showLoadingInPreview}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
    </div>
  );
}
