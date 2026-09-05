import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePreviewHtml } from "../lib/bundler.ts";
import {
  SANDBOX_MODULES,
  SANDBOX_MODULE_ALIASES,
  SANDBOX_MODULE_LIST,
} from "../lib/sandbox-modules.ts";

/**
 * Guards the agreement between what the prompts promise and what the preview
 * runtime delivers. `lib/omnirouter.ts` imports `server-only`, which throws
 * outside a server module graph, so the prompt side is checked as source text.
 */

const PROJECT = {
  title: "T",
  description: "D",
  files: { "src/App.tsx": "export default function App(){return null}" },
  entryFile: "src/App.tsx",
};

/** Pulls the registry keys out of the emitted document's resolver block. */
function registryKeys(html: string): string[] {
  const start = html.indexOf("var moduleRegistry = {");
  assert.notEqual(start, -1, "moduleRegistry block is missing from the preview document");
  const end = html.indexOf("};", start);
  const body = html.slice(start + "var moduleRegistry = {".length, end);

  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = line.match(/^'([^']+)'\s*:|^"([^"]+)"\s*:|^([A-Za-z_$][\w$]*)\s*:/);
      assert.ok(match, `unparsed registry entry: ${line}`);
      return match![1] ?? match![2] ?? match![3];
    });
}

test("the sandbox registry provides exactly the advertised modules", () => {
  const keys = registryKeys(generatePreviewHtml(PROJECT));
  const expected = [...SANDBOX_MODULES, ...SANDBOX_MODULE_ALIASES].sort();
  assert.deepEqual([...keys].sort(), expected);
});

test("the prompts advertise the shared list rather than a hand-copied one", () => {
  const source = readFileSync(new URL("../lib/omnirouter.ts", import.meta.url), "utf8");

  // The resolvable list must be the interpolated constant and nothing else — a
  // literal list here is exactly how the prompt and the registry drifted apart.
  const advertised = source.match(/resolves ONLY these packages: ([^.]+)\./);
  assert.ok(advertised, "the prompt no longer states which packages resolve");
  assert.equal(advertised![1], "${SANDBOX_MODULE_LIST}");

  // The three that used to be promised are now named as unavailable instead.
  const unavailable = source.match(/Any other package \(([^)]+)\)/);
  assert.ok(unavailable, "the prompt does not warn about unavailable packages");
  for (const absent of ["recharts", "date-fns", "react-router-dom"]) {
    assert.ok(unavailable![1].includes(absent), `${absent} is not called out as unavailable`);
  }
});

test("both prompts carry the runtime module rule", () => {
  const source = readFileSync(new URL("../lib/omnirouter.ts", import.meta.url), "utf8");
  const uses = source.match(/\$\{RUNTIME_MODULES_RULE\}/g) ?? [];
  assert.equal(uses.length, 2, "expected the rule in SYSTEM_INSTRUCTION and REPAIR_INSTRUCTION");
});

test("the advertised list names no module the resolver would stub out", () => {
  const html = generatePreviewHtml(PROJECT);
  const keys = new Set(registryKeys(html));
  for (const name of SANDBOX_MODULE_LIST.split(", ")) {
    assert.ok(keys.has(name), `${name} is promised to the model but absent from the registry`);
  }
});
