"use client";

/**
 * The interactive shell: landing hero before the first generation, then the
 * sidebar + preview workspace.
 *
 * Split out of `app/page.tsx` so the page itself can stay a Server Component and
 * resolve the session; everything below here needs client state.
 */

import { useState } from "react";
import Hero from "@/components/Hero";
import ChatSidebar from "@/components/ChatSidebar";
import PreviewPanel, { ViewMode } from "@/components/PreviewPanel";
import UserMenu from "@/components/auth/UserMenu";
import { LogoMark } from "@/components/Icons";
import { useGeneration } from "@/lib/useGeneration";
import type { AuthUser } from "@/lib/auth-user";

export default function AppShell({ user }: { user: AuthUser | null }) {
  const {
    versions,
    activeId,
    setActiveId,
    modelId,
    setModelId,
    isGenerating,
    hydrated,
    submit,
    cancel,
    repair,
    reset,
  } = useGeneration();
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  const activeVersion = versions.find((v) => v.id === activeId) ?? null;

  function handleSubmit(prompt: string) {
    setViewMode("preview");
    void submit(prompt);
  }

  // Rendering the hero before hydration would flash it over restored history.
  if (!hydrated) {
    return <div className="h-dvh bg-bg" />;
  }

  if (versions.length === 0) {
    return (
      <Hero
        onSubmit={handleSubmit}
        isGenerating={isGenerating}
        modelId={modelId}
        onModelChange={setModelId}
        user={user}
      />
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2.5 sm:hidden">
        <LogoMark className="h-6 w-6" />
        <span className="text-sm font-semibold">بنّاء</span>
        <div className="ms-auto">
          <UserMenu user={user} variant="compact" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <ChatSidebar
          versions={versions}
          activeId={activeId}
          onSelect={setActiveId}
          onSubmit={handleSubmit}
          onCancel={cancel}
          isGenerating={isGenerating}
          onNewProject={reset}
          modelId={modelId}
          onModelChange={setModelId}
          user={user}
        />
        <PreviewPanel
          version={activeVersion}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRuntimeError={repair}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
