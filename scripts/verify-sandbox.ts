/**
 * Verifies the preview sandbox's error channel end to end: a deliberately broken
 * project is loaded into a real iframe with the same opaque-origin sandbox the app
 * uses, and the harness records whatever `postMessage` reports back.
 *
 * This is the one part of the repair loop that cannot be checked without a
 * browser — the reporting block only runs inside the sandboxed frame. Run with:
 *   node --experimental-strip-types scripts/verify-sandbox.ts
 * then open the printed URL.
 */

import { createServer } from "node:http";
import { generatePreviewHtml } from "../lib/bundler.ts";

const CASES = {
  "missing-import": {
    title: "Broken",
    description: "imports a file that was never generated",
    files: {
      "src/App.tsx":
        "import Missing from './components/Missing';\n" +
        "export default function App() { return <Missing />; }",
    },
    entryFile: "src/App.tsx",
  },
  "runtime-throw": {
    title: "Throws",
    description: "reads a property of undefined during render",
    files: {
      "src/App.tsx":
        "export default function App() {\n" +
        "  const items = undefined as unknown as string[];\n" +
        "  return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;\n" +
        "}",
    },
    entryFile: "src/App.tsx",
  },
  "unknown-package": {
    title: "Unknown package",
    description: "imports a package the registry does not provide",
    files: {
      "src/App.tsx":
        "import { LineChart } from 'recharts';\n" +
        "export default function App() { return <div>ok<LineChart /></div>; }",
    },
    entryFile: "src/App.tsx",
  },
  healthy: {
    title: "Healthy",
    description: "renders without incident",
    files: {
      "src/App.tsx":
        "import { Sparkles } from 'lucide-react';\n" +
        "export default function App() { return <div><Sparkles />ready</div>; }",
    },
    entryFile: "src/App.tsx",
  },
};

const HARNESS = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>sandbox harness</title></head>
<body style="font:14px monospace;background:#111;color:#eee">
<pre id="results">running…</pre>
<script>
  const cases = ${JSON.stringify(Object.keys(CASES))};
  const frames = new Map();
  const seen = {};

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== 'bannaa-preview') return;
    // Identify by contentWindow, as the real host does. Reading
    // event.source.frameElement throws across the frame's opaque origin.
    let name = 'unknown';
    for (const [caseName, frame] of frames) {
      if (frame.contentWindow === event.source) name = caseName;
    }
    (seen[name] = seen[name] || []).push(data.payload);
    render();
  });

  function render() {
    document.getElementById('results').textContent = JSON.stringify(seen, null, 2);
    document.title = 'reports:' + Object.keys(seen).length;
  }

  for (const name of cases) {
    const frame = document.createElement('iframe');
    frame.src = '/preview/' + name;
    frame.sandbox = 'allow-scripts allow-forms allow-popups allow-modals';
    frame.style.cssText = 'width:280px;height:150px;border:1px solid #333';
    document.body.appendChild(frame);
    frames.set(name, frame);
  }
  setTimeout(render, 8000);
</script>
</body></html>`;

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/preview/")) {
    const name = url.slice("/preview/".length) as keyof typeof CASES;
    const project = CASES[name];
    if (!project) {
      res.writeHead(404).end("unknown case");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(generatePreviewHtml(project));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HARNESS);
});

server.listen(3222, "127.0.0.1", () => {
  console.log("sandbox harness on http://127.0.0.1:3222/");
});
