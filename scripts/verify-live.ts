/**
 * Live end-to-end check against a running dev server: streaming generation,
 * a targeted edit merge, and a repair pass. Not part of `npm test` — it spends
 * real provider tokens. Run with:
 *   node --experimental-strip-types scripts/verify-live.ts [baseUrl]
 */

// Marks the file as a module so its top-level `await` typechecks.
export {};

const BASE = process.argv[2] || "http://127.0.0.1:3111";
const ENDPOINT = `${BASE}/api/generate`;

interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

interface Outcome {
  events: StreamEvent[];
  status: number;
  project?: { title?: string; files?: Record<string, string>; entryFile?: string };
  error?: string;
}

async function callStream(body: unknown): Promise<Outcome> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok && !res.headers.get("content-type")?.includes("ndjson")) {
    const text = await res.text();
    return { events: [], status: res.status, error: text.slice(0, 400) };
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: StreamEvent[] = [];
  let buffer = "";
  let firstFileAt = 0;
  const started = Date.now();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as StreamEvent;
        events.push(event);
        if (event.type === "file" && !firstFileAt) firstFileAt = Date.now() - started;
      } catch {
        console.log("  ! unparseable line:", line.slice(0, 120));
      }
    }
  }

  const done = events.find((e) => e.type === "done");
  const failed = events.find((e) => e.type === "error");
  console.log(
    `  ${events.length} events, first file frame at ${firstFileAt}ms, total ${Date.now() - started}ms`
  );

  return {
    events,
    status: res.status,
    project: done?.project as Outcome["project"],
    error: failed?.error as string | undefined,
  };
}

function fail(message: string): never {
  console.error(`\nFAILED: ${message}`);
  process.exit(1);
}

console.log("1. streaming generation");
const first = await callStream({
  prompt: "صفحة هبوط بسيطة لمقهى محلي، مع قائمة مشروبات وزر حجز طاولة",
  stream: true,
});
if (first.error) fail(`generation reported: ${first.error}`);
if (!first.project?.files) fail(`no project in done event (status ${first.status}) ${first.error ?? ""}`);

const meta = first.events.find((e) => e.type === "meta");
const fileFrames = first.events.filter((e) => e.type === "file");
const partialFrames = fileFrames.filter((e) => e.done === false);
const paths = Object.keys(first.project.files);

console.log(`  model: ${meta?.model}`);
console.log(`  title: ${first.project.title}`);
console.log(`  files: ${paths.length} -> ${paths.join(", ")}`);
console.log(`  entry: ${first.project.entryFile}`);
console.log(`  progressive frames: ${partialFrames.length} partial, ${fileFrames.length} total`);

if (paths.length < 2) fail("expected a multi-file project");
if (!first.project.entryFile) fail("no entryFile chosen");
if (partialFrames.length === 0) fail("no partial file frames — the reveal was not progressive");

// The rewritten prompt forbids packages the sandbox cannot resolve.
const BANNED = ["recharts", "date-fns", "react-router-dom", "chart.js", "axios"];
for (const [path, content] of Object.entries(first.project.files)) {
  for (const pkg of BANNED) {
    if (new RegExp(`from ['"]${pkg}`).test(content)) fail(`${path} imports unavailable ${pkg}`);
  }
}
console.log("  no imports outside the sandbox registry");

console.log("\n2. targeted edit merge");
const edit = await callStream({
  prompt: "غيّر لون العنوان الرئيسي إلى الأخضر فقط، دون تغيير أي شيء آخر",
  previousProject: first.project,
  stream: true,
});
if (edit.error) fail(`edit reported: ${edit.error}`);
if (!edit.project?.files) fail("no project in edit done event");

const editMeta = edit.events.find((e) => e.type === "meta");
const returned = edit.events.filter((e) => e.type === "file" && e.done === true).length;
const changed = paths.filter((p) => edit.project!.files![p] !== first.project!.files![p]);
const kept = paths.filter((p) => edit.project!.files![p] === first.project!.files![p]);

console.log(`  isEdit flag: ${editMeta?.isEdit}`);
console.log(`  model returned ${returned} file(s); merged project has ${Object.keys(edit.project.files).length}`);
console.log(`  changed: ${changed.join(", ") || "(none)"}`);
console.log(`  preserved unchanged: ${kept.length}/${paths.length}`);

if (editMeta?.isEdit !== true) fail("route did not treat this as an edit");
for (const p of paths) {
  if (!(p in edit.project.files)) fail(`merge dropped ${p}`);
}
if (!edit.project.entryFile) fail("merge lost entryFile");
if (!(edit.project.entryFile in edit.project.files)) {
  fail(`entryFile ${edit.project.entryFile} is not in the merged files`);
}
if (changed.length === 0) fail("edit changed nothing");
if (kept.length === 0) fail("edit rewrote every file instead of the ones it needed");

console.log("\n3. repair pass");
const broken = {
  ...first.project,
  files: {
    ...first.project.files,
    [first.project.entryFile!]:
      `import Missing from './components/DefinitelyNotGenerated';\n` +
      first.project.files[first.project.entryFile!],
  },
};
const repair = await callStream({
  prompt: "أصلح الخطأ",
  previousProject: broken,
  stream: true,
  repair: {
    message: `Cannot resolve "./components/DefinitelyNotGenerated" from ${first.project.entryFile}. The file was imported but never generated.`,
    file: first.project.entryFile,
  },
});
if (repair.error) fail(`repair reported: ${repair.error}`);
if (!repair.project?.files) fail("no project in repair done event");

const entry = repair.project.files[first.project.entryFile!] ?? "";
const stillBroken = entry.includes("DefinitelyNotGenerated");
const wroteTheFile = Object.keys(repair.project.files).some((p) =>
  p.includes("DefinitelyNotGenerated")
);
console.log(`  bad import still present: ${stillBroken}`);
console.log(`  supplied the missing file instead: ${wroteTheFile}`);
if (stillBroken && !wroteTheFile) fail("repair neither removed the import nor created the file");

console.log("\n4. cancellation");
const controller = new AbortController();
setTimeout(() => controller.abort(), 1200);
try {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "لوحة تحكم تحليلات", stream: true }),
    signal: controller.signal,
  });
  await res.text();
  fail("abort did not surface as an error on the client");
} catch (err) {
  const name = err instanceof Error ? err.name : String(err);
  console.log(`  client saw ${name} as expected`);
}

console.log("\n5. validation and rate limiting");
const empty = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "  " }),
});
console.log(`  empty prompt -> ${empty.status}`);
if (empty.status !== 400) fail(`expected 400 for an empty prompt, got ${empty.status}`);

let limited = 0;
for (let i = 0; i < 12; i += 1) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ prompt: "" }),
  });
  if (res.status === 429) {
    limited += 1;
    if (limited === 1) console.log(`  429 after ${i} requests, retry-after=${res.headers.get("retry-after")}`);
  }
  await res.text();
}
console.log(`  ${limited}/12 requests rejected by the limiter`);
if (limited === 0) fail("rate limiter never engaged");

console.log("\nAll live checks passed.");
