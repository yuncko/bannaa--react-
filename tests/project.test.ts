import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRepairInput,
  buildUserInput,
  extractProjectResponse,
  extractReactProject,
  mergeProjects,
  pickEntryFile,
} from "../lib/project.ts";
import type { ReactProject } from "../lib/types.ts";

const BASE: ReactProject = {
  title: "Shop",
  description: "A store",
  files: {
    "src/App.tsx": "export default function App(){return null}",
    "src/components/Navbar.tsx": "export default function Navbar(){return null}",
    "src/types.ts": "export type T = 1;",
  },
  entryFile: "src/App.tsx",
};

test("merge keeps untouched files and applies only what the model returned", () => {
  const update: ReactProject = {
    title: "Shop",
    description: "A store",
    files: { "src/components/Navbar.tsx": "// new navbar" },
    entryFile: "src/App.tsx",
  };

  const merged = mergeProjects(BASE, update);
  assert.equal(Object.keys(merged.files).length, 3);
  assert.equal(merged.files["src/components/Navbar.tsx"], "// new navbar");
  assert.equal(merged.files["src/App.tsx"], BASE.files["src/App.tsx"]);
  assert.equal(merged.files["src/types.ts"], BASE.files["src/types.ts"]);
});

test("merge adds new files and honours deletedFiles", () => {
  const update: ReactProject = {
    title: "Shop",
    description: "A store",
    files: { "src/components/Cart.tsx": "// cart" },
    entryFile: "src/App.tsx",
  };

  const merged = mergeProjects(BASE, update, ["src/types.ts"]);
  assert.ok(merged.files["src/components/Cart.tsx"]);
  assert.equal(merged.files["src/types.ts"], undefined);
  assert.ok(merged.files["src/App.tsx"], "unrelated files survive a deletion");
});

test("merge on an empty base returns the update untouched", () => {
  const update = { ...BASE };
  assert.deepEqual(mergeProjects(undefined, update), update);
  assert.deepEqual(
    mergeProjects({ title: "", description: "", files: {} }, update),
    update
  );
});

test("merge prefers the update's title but falls back to the base", () => {
  const renamed = mergeProjects(BASE, {
    title: "Renamed",
    description: "",
    files: {},
  });
  assert.equal(renamed.title, "Renamed");
  assert.equal(renamed.description, BASE.description, "blank description keeps the old one");
});

test("merge never leaves entryFile pointing at a deleted file", () => {
  const merged = mergeProjects(BASE, { title: "", description: "", files: {} }, [
    "src/App.tsx",
  ]);
  assert.notEqual(merged.entryFile, "src/App.tsx");
  assert.ok(merged.files[merged.entryFile!], "entry must exist in the merged files");
});

test("entry file selection prefers a valid hint, then App, then any component", () => {
  assert.equal(pickEntryFile({ "src/Main.tsx": "x" }, "src/Main.tsx"), "src/Main.tsx");
  assert.equal(pickEntryFile({ "src/App.tsx": "x", "src/B.tsx": "y" }, "gone.tsx"), "src/App.tsx");
  assert.equal(pickEntryFile({ "src/Widget.jsx": "x" }), "src/Widget.jsx");
  assert.equal(pickEntryFile({ "src/types.ts": "x" }), "src/App.tsx");
});

test("modification prompts ask for changed files only and omit pretty-printing", () => {
  const input = buildUserInput("make the button blue", BASE);
  assert.match(input, /USER MODIFICATION REQUEST: make the button blue/);
  assert.match(input, /Return ONLY the files you changed or added/);
  assert.match(input, /deletedFiles/);
  assert.ok(!input.includes('\n    "'), "project JSON must be compact, not indented");
});

test("a first-time prompt carries no project payload", () => {
  const input = buildUserInput("a todo app");
  assert.match(input, /USER PROMPT FOR NEW REACT APPLICATION/);
  assert.ok(!input.includes("CURRENT FILES"));
});

test("repair prompts include the error, file, and truncated stack", () => {
  const input = buildRepairInput(BASE, "x is not defined", "src/App.tsx", "y".repeat(5000));
  assert.match(input, /ERROR: x is not defined/);
  assert.match(input, /REPORTED FILE: src\/App\.tsx/);
  assert.ok(input.includes("y".repeat(2000)));
  assert.ok(!input.includes("y".repeat(2001)), "stack is capped at 2000 chars");
});

test("extracts deletedFiles from a model response", () => {
  const raw = JSON.stringify({
    title: "T",
    description: "D",
    files: { "src/App.tsx": "x" },
    deletedFiles: ["src/Old.tsx", "", 42],
  });
  const res = extractProjectResponse(raw);
  assert.deepEqual(res.deletedFiles, ["src/Old.tsx"], "blank and non-string entries are dropped");
});

test("omits deletedFiles when absent or empty", () => {
  const raw = JSON.stringify({ files: { "src/App.tsx": "x" }, deletedFiles: [] });
  assert.equal(extractProjectResponse(raw).deletedFiles, undefined);
});

test("recovers a project from a fenced response with surrounding prose", () => {
  const raw = 'Sure!\n```json\n{"title":"T","files":{"src/App.tsx":"code"}}\n```\nEnjoy.';
  const p = extractReactProject(raw);
  assert.equal(p.title, "T");
  assert.equal(p.files["src/App.tsx"], "code");
});

test("unwraps a project double-nested inside a single file", () => {
  const inner = JSON.stringify({ title: "Inner", files: { "src/App.tsx": "real" } });
  const outer = JSON.stringify({ files: { "src/App.tsx": inner } });
  const p = extractReactProject(outer);
  assert.equal(p.title, "Inner");
  assert.equal(p.files["src/App.tsx"], "real");
});

test("entryFile reflects the real files rather than a hardcoded path", () => {
  const p = extractReactProject(JSON.stringify({ files: { "src/Main.jsx": "code" } }));
  assert.ok(p.files[p.entryFile!], "entry must exist");
});
