import test from "node:test";
import assert from "node:assert/strict";
import { clearHistory, loadHistory, saveHistory } from "../lib/history.ts";
import type { Version } from "../lib/types.ts";

/** Minimal localStorage stand-in; `quotaAt` makes writes fail past a size. */
function installStorage(quotaAt = Infinity) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > quotaAt) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  return { data, storage };
}

function version(id: string, extra: Partial<Version> = {}): Version {
  return {
    id,
    prompt: `prompt ${id}`,
    project: { title: id, description: "", files: { "src/App.tsx": "code " + id } },
    status: "done",
    createdAt: 1,
    ...extra,
  };
}

test("saves and restores completed versions", () => {
  installStorage();
  saveHistory({ versions: [version("a"), version("b")], activeId: "b", modelId: "claude-sonnet-5" });

  const loaded = loadHistory();
  assert.ok(loaded);
  assert.deepEqual(loaded.versions.map((v) => v.id), ["a", "b"]);
  assert.equal(loaded.activeId, "b");
  assert.equal(loaded.modelId, "claude-sonnet-5");
});

test("in-flight and failed versions are not persisted", () => {
  installStorage();
  saveHistory({
    versions: [
      version("ok"),
      version("pending", { status: "pending", project: null }),
      version("failed", { status: "error", project: null, errorMessage: "boom" }),
    ],
    activeId: "pending",
    modelId: undefined,
  });

  const loaded = loadHistory();
  assert.deepEqual(loaded?.versions.map((v) => v.id), ["ok"]);
  assert.equal(loaded?.activeId, "ok", "a dropped active id falls back to the newest kept version");
});

test("nothing is stored when there is no finished work", () => {
  const { data } = installStorage();
  saveHistory({ versions: [version("p", { status: "pending", project: null })], activeId: "p" });
  assert.equal(data.size, 0);
  assert.equal(loadHistory(), null);
});

test("only the newest versions are kept", () => {
  installStorage();
  const many = Array.from({ length: 20 }, (_, i) => version(`v${i}`));
  saveHistory({ versions: many, activeId: "v19" });

  const loaded = loadHistory();
  assert.equal(loaded?.versions.length, 12);
  assert.equal(loaded?.versions[0].id, "v8", "oldest entries are dropped first");
  assert.equal(loaded?.versions.at(-1)?.id, "v19");
});

test("a quota failure sheds old versions instead of losing everything", () => {
  // Tight enough that all three cannot fit, but one can.
  const big = (id: string) => version(id, {
    project: { title: id, description: "", files: { "src/App.tsx": "x".repeat(400) } },
  });
  installStorage(900);
  saveHistory({ versions: [big("a"), big("b"), big("c")], activeId: "c" });

  const loaded = loadHistory();
  assert.ok(loaded, "the newest version still round-trips");
  assert.equal(loaded.versions.at(-1)?.id, "c", "the newest work is what survives");
});

test("corrupt stored data is discarded rather than thrown", () => {
  const { data, storage } = installStorage();
  storage.setItem("bannaa.history.v1", "{not json");
  assert.equal(loadHistory(), null);
  assert.equal(data.size, 0, "the bad payload is cleared so the next save starts clean");
});

test("entries with a malformed project are dropped", () => {
  const { storage } = installStorage();
  storage.setItem(
    "bannaa.history.v1",
    JSON.stringify({
      versions: [
        { id: "good", prompt: "p", project: { title: "T", description: "", files: { "a.tsx": "x" } }, status: "done", createdAt: 1 },
        { id: "nofiles", prompt: "p", project: { title: "T" }, status: "done", createdAt: 1 },
        { id: "binaryfiles", prompt: "p", project: { files: { "a.tsx": 42 } }, status: "done", createdAt: 1 },
        { prompt: "no id", project: { files: {} }, status: "done" },
      ],
      activeId: "good",
    })
  );

  const loaded = loadHistory();
  assert.deepEqual(loaded?.versions.map((v) => v.id), ["good"]);
});

test("clearHistory removes the stored payload", () => {
  const { data } = installStorage();
  saveHistory({ versions: [version("a")], activeId: "a" });
  assert.equal(data.size, 1);
  clearHistory();
  assert.equal(data.size, 0);
});
