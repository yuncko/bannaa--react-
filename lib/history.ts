/**
 * localStorage persistence for the version list.
 *
 * Browser storage is a shared, size-limited, and untrusted surface, so this
 * module is defensive on all three counts: everything is validated on read, the
 * payload is trimmed to the newest versions, and a quota failure degrades to
 * "history is not saved" rather than breaking generation.
 */

import type { ReactProject, Version } from "./types";

const KEY = "bannaa.history.v1";
/** Newest N versions are kept; older ones are dropped to stay inside quota. */
const MAX_VERSIONS = 12;
/** ~4MB — localStorage caps around 5MB per origin in most browsers. */
const MAX_BYTES = 4_000_000;

export interface StoredHistory {
  versions: Version[];
  activeId: string | null;
  modelId?: string;
}

function isProject(value: unknown): value is ReactProject {
  if (!value || typeof value !== "object") return false;
  const files = (value as { files?: unknown }).files;
  if (!files || typeof files !== "object") return false;
  return Object.values(files as Record<string, unknown>).every((v) => typeof v === "string");
}

/** Rebuilds one version, dropping anything malformed rather than trusting it. */
function reviveVersion(raw: unknown): Version | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.prompt !== "string") return null;
  if (!isProject(v.project)) return null;

  return {
    id: v.id,
    prompt: v.prompt,
    project: v.project,
    // Anything mid-flight when the tab closed is dead; only completed work reloads.
    status: "done",
    createdAt: typeof v.createdAt === "number" ? v.createdAt : Date.now(),
    repairOf: typeof v.repairOf === "string" ? v.repairOf : undefined,
    repairAttempts: typeof v.repairAttempts === "number" ? v.repairAttempts : undefined,
  };
}

export function loadHistory(): StoredHistory | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const list = Array.isArray(parsed.versions) ? parsed.versions : [];
    const versions = list
      .map(reviveVersion)
      .filter((v): v is Version => v !== null)
      .slice(-MAX_VERSIONS);

    if (versions.length === 0) return null;

    const storedActive = typeof parsed.activeId === "string" ? parsed.activeId : null;
    const activeId = versions.some((v) => v.id === storedActive)
      ? storedActive
      : versions[versions.length - 1].id;

    return {
      versions,
      activeId,
      modelId: typeof parsed.modelId === "string" ? parsed.modelId : undefined,
    };
  } catch {
    // Corrupt or foreign payload: clear it so the next save starts clean.
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

export function saveHistory(history: StoredHistory): void {
  if (typeof localStorage === "undefined") return;

  // Persisting only finished versions keeps a reload from restoring a spinner.
  const done = history.versions.filter((v) => v.status === "done" && v.project);

  if (done.length === 0) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    return;
  }

  // Shrink from the oldest end until it fits; a single huge project is dropped
  // rather than allowed to fail the write.
  let slice = done.slice(-MAX_VERSIONS);
  while (slice.length > 0) {
    const payload = JSON.stringify({
      versions: slice.map(({ id, prompt, project, createdAt, repairOf, repairAttempts }) => ({
        id,
        prompt,
        project,
        status: "done",
        createdAt,
        repairOf,
        repairAttempts,
      })),
      activeId: slice.some((v) => v.id === history.activeId)
        ? history.activeId
        : slice[slice.length - 1].id,
      modelId: history.modelId,
    });

    if (payload.length <= MAX_BYTES) {
      try {
        localStorage.setItem(KEY, payload);
        return;
      } catch {
        // Quota exceeded despite the size check (other keys, or a stricter cap).
      }
    }

    slice = slice.slice(1);
  }

  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
