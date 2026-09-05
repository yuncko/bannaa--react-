import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePartialProject,
  parseSseData,
  splitSseFrames,
  stripFence,
} from "../lib/stream-parser.ts";

const FULL = JSON.stringify({
  title: "Counter",
  description: "A counter app",
  files: {
    "src/App.tsx": "export default function App() {\n  return <div>hi</div>;\n}",
    "src/types.ts": "export type X = { a: number };",
  },
});

test("parses a complete project", () => {
  const r = parsePartialProject(FULL);
  assert.equal(r.complete, true);
  assert.equal(r.title, "Counter");
  assert.equal(r.description, "A counter app");
  assert.deepEqual(Object.keys(r.files), ["src/App.tsx", "src/types.ts"]);
  assert.match(r.files["src/App.tsx"], /return <div>hi<\/div>/);
  assert.equal(r.activeFile, undefined);
});

test("every prefix parses without throwing and never loses a finished file", () => {
  let seen = 0;
  for (let i = 1; i <= FULL.length; i += 1) {
    const r = parsePartialProject(FULL.slice(0, i));
    // Completed-file count is monotonic as more text arrives.
    assert.ok(Object.keys(r.files).length >= seen);
    seen = Object.keys(r.files).length;
    // A file is only reported complete when its content is fully decoded.
    for (const [path, content] of Object.entries(r.files)) {
      assert.equal(content, JSON.parse(FULL).files[path]);
    }
  }
  assert.equal(seen, 2);
});

test("reports the in-flight file separately from finished ones", () => {
  const cut = FULL.indexOf("export default function App") + 10;
  const r = parsePartialProject(FULL.slice(0, cut));
  assert.equal(r.complete, false);
  assert.deepEqual(r.files, {});
  assert.equal(r.activeFile?.path, "src/App.tsx");
  assert.ok(r.activeFile!.content.length > 0);
  assert.ok("export default function App".startsWith(r.activeFile!.content.trim().slice(0, 10)));
});

test("decodes escapes, including newlines split across chunks", () => {
  const src = '{"files":{"a.ts":"line1\\nline2\\ttabbed \\"quoted\\""}}';
  const r = parsePartialProject(src);
  assert.equal(r.files["a.ts"], 'line1\nline2\ttabbed "quoted"');

  // Cut mid-escape: must not emit a stray backslash.
  const midEscape = src.slice(0, src.indexOf("\\n") + 1);
  const partial = parsePartialProject(midEscape);
  assert.ok(!(partial.activeFile?.content ?? "").endsWith("\\"));
});

test("handles unicode escapes and defers incomplete ones", () => {
  assert.equal(parsePartialProject('{"files":{"a.ts":"\\u0645\\u0631"}}').files["a.ts"], "مر");
  const cut = parsePartialProject('{"files":{"a.ts":"x\\u06');
  assert.equal(cut.activeFile?.content, "x");
});

test("strips a markdown fence, open or closed", () => {
  assert.equal(stripFence('```json\n{"a":1}\n```').trim(), '{"a":1}');
  assert.equal(stripFence('```\n{"a":1}').trim(), '{"a":1}');
  assert.equal(stripFence('{"a":1}'), '{"a":1}');
  const fenced = parsePartialProject('```json\n{"title":"T","files":{"a.ts":"x"}}\n```');
  assert.equal(fenced.title, "T");
  assert.equal(fenced.files["a.ts"], "x");
});

test("survives keys arriving in any order and unknown keys", () => {
  const r = parsePartialProject(
    '{"files":{"a.ts":"x"},"extra":{"nested":[1,2,{"deep":"}"}]},"title":"After"}'
  );
  assert.equal(r.title, "After");
  assert.equal(r.files["a.ts"], "x");
  assert.equal(r.complete, true);
});

test("reads deletedFiles for targeted edits", () => {
  const r = parsePartialProject(
    '{"files":{"a.ts":"x"},"deletedFiles":["src/Old.tsx","src/Gone.tsx"]}'
  );
  assert.deepEqual(r.deletedFiles, ["src/Old.tsx", "src/Gone.tsx"]);
});

test("ignores a non-string file body instead of aborting", () => {
  const r = parsePartialProject('{"files":{"bad.ts":123,"good.ts":"ok"}}');
  assert.equal(r.files["good.ts"], "ok");
  assert.equal(r.files["bad.ts"], undefined);
});

test("returns empty state for text with no JSON object", () => {
  const r = parsePartialProject("Sure! Here is your app:");
  assert.deepEqual(r.files, {});
  assert.equal(r.complete, false);
});

test("splits SSE frames and keeps the trailing partial", () => {
  const { frames, rest } = splitSseFrames(
    'data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c"'
  );
  assert.deepEqual(frames, ['{"a":1}', '{"b":2}']);
  assert.equal(rest, 'data: {"c"');
});

test("extracts content deltas and finish_reason from SSE payloads", () => {
  assert.equal(parseSseData('{"choices":[{"delta":{"content":"hi"}}]}').content, "hi");
  assert.equal(
    parseSseData('{"choices":[{"finish_reason":"length","delta":{}}]}').finishReason,
    "length"
  );
  assert.equal(parseSseData("[DONE]").content, "");
  assert.equal(parseSseData("not json").content, "");
});
