"use client";

/**
 * Owns the whole generation lifecycle for the page: the version list, the live
 * stream, cancellation, the automatic repair pass, and persistence.
 *
 * Kept in one hook because these concerns are not separable in practice — a
 * repair pass is a version, a cancel has to reconcile the version it aborted,
 * and persistence must not save half-streamed state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeEvents } from "@/lib/stream-protocol";
import { MODEL_INFO } from "@/lib/models";
import { loadHistory, saveHistory } from "@/lib/history";
import type { PreviewError, ReactProject, Version } from "@/lib/types";

/** Cap on automatic repair passes per version, to bound cost and looping. */
const MAX_REPAIR_ATTEMPTS = 2;

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface SubmitOptions {
  /** Set for an automatic repair pass rather than a user instruction. */
  repair?: PreviewError;
  /** Version whose failure triggered the repair. */
  repairOf?: string;
  attempts?: number;
  /** Project to modify; defaults to the newest completed version. */
  baseProject?: ReactProject;
}

export function useGeneration() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(MODEL_INFO[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Read inside async callbacks that must not close over a stale render.
  const versionsRef = useRef<Version[]>([]);
  versionsRef.current = versions;

  useEffect(() => {
    const stored = loadHistory();
    if (stored) {
      setVersions(stored.versions);
      setActiveId(stored.activeId);
      if (stored.modelId) setModelId(stored.modelId);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveHistory({ versions, activeId, modelId });
  }, [versions, activeId, modelId, hydrated]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((id: string, update: Partial<Version>) => {
    setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, ...update } : v)));
  }, []);

  /**
   * Moves the selection off a version that ended with nothing to show.
   *
   * A cancelled or failed attempt has no project, and its sidebar row is
   * disabled, so leaving it selected blanks the preview with no way back to the
   * work that is still there.
   */
  const selectLastGood = useCallback((failedId: string) => {
    setActiveId((current) => {
      if (current !== failedId) return current;
      const lastDone = [...versionsRef.current].reverse().find((v) => v.status === "done");
      return lastDone?.id ?? current;
    });
  }, []);

  const submit = useCallback(
    async (prompt: string, options: SubmitOptions = {}) => {
      // A new request supersedes whatever is in flight.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = makeId();
      const lastDone = [...versionsRef.current].reverse().find((v) => v.status === "done");
      const baseProject = options.baseProject ?? lastDone?.project ?? undefined;

      setVersions((prev) => [
        ...prev,
        {
          id,
          prompt,
          project: null,
          status: "pending",
          createdAt: Date.now(),
          streaming: { files: {} },
          repairOf: options.repairOf,
          repairAttempts: options.attempts,
        },
      ]);
      setActiveId(id);
      setIsGenerating(true);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            prompt,
            modelId,
            previousProject: baseProject,
            stream: true,
            repair: options.repair
              ? {
                  message: options.repair.message,
                  file: options.repair.file,
                  stack: options.repair.stack,
                }
              : undefined,
          }),
        });

        // Errors before the stream opens (rate limit, bad request) come back as JSON.
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "حدث خطأ غير متوقع.");
        }

        const succeeded = await consumeStream(res.body, id, patch);
        if (!succeeded) selectLastGood(id);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Keep a cancelled version only if it never produced anything.
          setVersions((prev) =>
            prev.map((v) =>
              v.id === id && v.status === "pending"
                ? { ...v, status: "cancelled", streaming: undefined, errorMessage: "أُلغي الطلب" }
                : v
            )
          );
          selectLastGood(id);
        } else {
          patch(id, {
            status: "error",
            streaming: undefined,
            errorMessage: err instanceof Error ? err.message : "خطأ غير متوقع",
          });
          selectLastGood(id);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [modelId, patch, selectLastGood]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * Automatic repair: the preview reports a runtime error, and the model gets one
   * chance (twice at most) to fix it before the user is asked to intervene.
   */
  const repair = useCallback(
    (versionId: string, error: PreviewError) => {
      const version = versionsRef.current.find((v) => v.id === versionId);
      if (!version?.project || isGenerating) return false;

      const attempts = (version.repairAttempts ?? 0) + 1;
      if (attempts > MAX_REPAIR_ATTEMPTS) return false;

      void submit(`إصلاح تلقائي: ${error.message}`, {
        repair: error,
        repairOf: versionId,
        attempts,
        baseProject: version.project,
      });
      return true;
    },
    [isGenerating, submit]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setVersions([]);
    setActiveId(null);
  }, []);

  return {
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
  };
}

/**
 * Reads the NDJSON body, applying each event to the version being built.
 *
 * Resolves to whether the version ended with a usable project, so the caller can
 * move the selection off a failure.
 */
async function consumeStream(
  body: ReadableStream<Uint8Array>,
  id: string,
  patch: (id: string, update: Partial<Version>) => void
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Mirrors of the streaming state, so each event applies without reading state back.
  let files: Record<string, string> = {};
  let title: string | undefined;
  let description: string | undefined;
  let model: string | undefined;
  let activeFile: string | undefined;
  let settled = false;
  let succeeded = false;
  let scheduled = false;

  const commit = () => {
    scheduled = false;
    patch(id, { streaming: { files: { ...files }, title, description, model, activeFile } });
  };

  // Coalesce into one React update per frame: the server can emit several file
  // events in quick succession and each one re-renders a syntax-highlighted view.
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(commit);
    else setTimeout(commit, 16);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = decodeEvents(buffer);
      buffer = rest;

      for (const event of events) {
        switch (event.type) {
          case "meta":
            // Failover restarted the generation; drop the partial reveal.
            files = {};
            activeFile = undefined;
            title = undefined;
            model = event.model;
            schedule();
            break;
          case "title":
            title = event.title;
            description = event.description;
            schedule();
            break;
          case "file":
            files[event.path] = event.content;
            activeFile = event.done ? undefined : event.path;
            schedule();
            break;
          case "done":
            settled = true;
            succeeded = true;
            patch(id, { project: event.project, status: "done", streaming: undefined });
            break;
          case "error":
            settled = true;
            patch(id, { status: "error", streaming: undefined, errorMessage: event.error });
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // The stream ended without a terminal event — a dropped connection or a crashed
  // handler. Surfacing it beats leaving a version spinning forever.
  if (!settled) {
    patch(id, {
      status: "error",
      streaming: undefined,
      errorMessage: "انقطع الاتصال قبل اكتمال التوليد. أعد المحاولة.",
    });
  }

  return succeeded;
}
