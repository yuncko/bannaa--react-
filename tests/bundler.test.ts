import test from "node:test";
import assert from "node:assert/strict";
import { generatePreviewHtml } from "../lib/bundler.ts";
import type { ReactProject } from "../lib/types.ts";

/**
 * The preview document executes model-authored code, so these tests cover the
 * properties that keep that safe and diagnosable rather than how it renders.
 * The runtime behaviour itself (what `postMessage` reports for a broken project)
 * is checked by `scripts/verify-sandbox.ts`, which needs a real browser.
 */

function project(files: Record<string, string>): ReactProject {
  return { title: "T", description: "D", files, entryFile: Object.keys(files)[0] };
}

test("a file containing a closing script tag cannot break out of the document", () => {
  const html = generatePreviewHtml(
    project({
      "src/App.tsx":
        "export default function App(){return <div>{'</script><script>window.__pwned=1</script>'}</div>}",
    })
  );

  // The payload must survive only in escaped form; an unescaped copy would end
  // the script block and let the injected tag execute as document markup.
  assert.ok(!html.includes("</script><script>window.__pwned"));
  assert.ok(html.includes("\\u003c/script\\u003e"));
});

test("line and paragraph separators are escaped so the script stays parseable", () => {
  const html = generatePreviewHtml(
    project({ "src/App.tsx": "const s = 'a\u2028b\u2029c';" })
  );
  assert.ok(!html.includes("\u2028"));
  assert.ok(html.includes("\\u2028"));
  assert.ok(html.includes("\\u2029"));
});

test("every generated file reaches the virtual filesystem", () => {
  const files = {
    "src/App.tsx": "export default function App(){return null}",
    "src/components/Card.tsx": "export default function Card(){return null}",
    "src/types.ts": "export type T = 1;",
  };
  const html = generatePreviewHtml(project(files));
  for (const path of Object.keys(files)) {
    assert.ok(html.includes(JSON.stringify(path).slice(1, -1)), `${path} is missing`);
  }
});

test("the document reports to the host and never assumes same-origin access", () => {
  const html = generatePreviewHtml(project({ "src/App.tsx": "export default () => null" }));

  // The error channel the repair loop depends on.
  assert.match(html, /source: 'bannaa-preview'/);
  assert.match(html, /kind: 'ready'/);
  assert.match(html, /kind: 'missing-module'/);

  // Storage is shimmed because an opaque origin throws on access.
  assert.match(html, /localStorage/);
  assert.match(html, /sessionStorage/);
});

test("an entry file outside the file list still produces a bootable document", () => {
  const html = generatePreviewHtml({
    title: "T",
    description: "D",
    files: { "src/Main.tsx": "export default function Main(){return null}" },
    entryFile: "src/DoesNotExist.tsx",
  });
  assert.ok(html.includes("src/Main.tsx"));
  assert.match(html, /<!DOCTYPE html>/i);
});
