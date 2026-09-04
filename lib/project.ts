/**
 * Pure project-shaping logic: prompt construction, response parsing, and
 * merging a model response onto an existing project.
 *
 * Deliberately free of credentials, network access, and runtime imports — it
 * only pulls in types, so it is safe on either side of the server boundary and
 * testable in isolation. The provider client in `lib/omnirouter.ts` re-exports
 * these so existing call sites keep working.
 */

import type { ProjectFiles, ReactProject } from "./types";

/** A parsed model response: the project plus any files it asked to remove. */
export interface ProjectResponse {
  project: ReactProject;
  deletedFiles?: string[];
}

export interface ParseOptions {
  /**
   * Set when the response is expected to contain only the changed files.
   *
   * Without this, a response holding just `src/components/Navbar.tsx` gets an
   * `src/App.tsx` synthesised from it, and the merge then overwrites the real
   * entry file with a copy of the navbar.
   */
  allowPartial?: boolean;
}

/**
 * Thrown when a response carries no project at all.
 *
 * The usual cause is the model answering in prose — a refusal, a question, an
 * explanation — instead of the JSON it was asked for. That text used to be
 * wrapped as `src/App.tsx` and handed to the sandbox, which reported it as a
 * syntax error on line 1 and spent an automatic repair pass trying to fix
 * something that was never code. The prose travels on the error so the caller can
 * tell the user what the model actually said.
 */
export class ProjectParseError extends Error {
  /** The model's own words, empty when it returned nothing. */
  readonly prose: string;

  constructor(prose: string) {
    super(prose ? "MODEL_RETURNED_PROSE" : "MODEL_RETURNED_NOTHING");
    this.name = "ProjectParseError";
    this.prose = prose;
  }
}

export function buildUserInput(prompt: string, previousProject?: ReactProject): string {
  if (previousProject && previousProject.files && Object.keys(previousProject.files).length > 0) {
    return [
      `USER MODIFICATION REQUEST: ${prompt}`,
      "",
      `CURRENT PROJECT: "${previousProject.title || "React Project"}"`,
      "CURRENT FILES:",
      // Compact rather than pretty-printed: indentation on a whole codebase is
      // pure token cost, and the model does not read it any better.
      JSON.stringify({
        title: previousProject.title,
        description: previousProject.description,
        files: previousProject.files,
      }),
      "",
      "Return ONLY the files you changed or added, each with its complete final content.",
      "Do not re-emit files you did not change — they are preserved automatically.",
      'Use "deletedFiles": ["path"] if a file must be removed.',
    ].join("\n");
  }

  return `USER PROMPT FOR NEW REACT APPLICATION:\n${prompt}`;
}

/** Builds the repair-pass input from the failing project and its runtime error. */
export function buildRepairInput(
  project: ReactProject,
  errorMessage: string,
  errorFile?: string,
  stack?: string
): string {
  return [
    "The following project failed at runtime in the browser sandbox.",
    "",
    `ERROR: ${errorMessage}`,
    errorFile ? `REPORTED FILE: ${errorFile}` : "",
    stack ? `STACK:\n${stack.slice(0, 2000)}` : "",
    "",
    `PROJECT: "${project.title || "React Project"}"`,
    "FILES:",
    JSON.stringify({
      title: project.title,
      description: project.description,
      files: project.files,
    }),
    "",
    "Return ONLY the JSON object containing the files you fixed.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Merges a model response over an existing project. Files the model omitted are
 * carried forward, which is what makes targeted edits safe: the model no longer
 * has to reproduce the whole codebase to change one button.
 */
export function mergeProjects(
  base: ReactProject | undefined,
  update: ReactProject,
  deletedFiles?: string[]
): ReactProject {
  if (!base || !base.files || Object.keys(base.files).length === 0) {
    return { ...update, entryFile: pickEntryFile(update.files, update.entryFile) };
  }

  const files: ProjectFiles = { ...base.files, ...update.files };

  for (const path of deletedFiles ?? []) {
    delete files[path];
  }

  return {
    title: update.title || base.title,
    description: update.description || base.description,
    files,
    entryFile: pickEntryFile(files, update.entryFile || base.entryFile),
  };
}

/** Picks the file the preview should boot from, preferring an explicit hint. */
export function pickEntryFile(files: ProjectFiles, preferred?: string): string {
  if (preferred && files[preferred] !== undefined) return preferred;

  for (const candidate of ["src/App.tsx", "src/App.jsx", "App.tsx", "App.jsx"]) {
    if (files[candidate] !== undefined) return candidate;
  }

  const firstComponent = Object.keys(files).find((f) => /\.(tsx|jsx)$/i.test(f));
  return firstComponent ?? "src/App.tsx";
}

/**
 * Extracts and parses a ReactProject object from the model's raw output.
 * Handles JSON parsing, markdown code fences, file marker blocks, and fallbacks.
 */
export function extractReactProject(raw: string, options: ParseOptions = {}): ReactProject {
  return extractProjectResponse(raw, options).project;
}

/** As `extractReactProject`, but also surfaces a `deletedFiles` list if present. */
export function extractProjectResponse(
  raw: string,
  options: ParseOptions = {}
): ProjectResponse {
  let text = (raw ?? "").trim();

  // Strip markdown code block fences if present
  const jsonFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonFenceMatch && jsonFenceMatch[1].trim().length > 0) {
    text = jsonFenceMatch[1].trim();
  }

  const direct = tryParseProject(text, options);
  if (direct) return direct;

  // JSON with leading/trailing prose: take the substring between the outermost braces.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = tryParseProject(text.slice(firstBrace, lastBrace + 1), options);
    if (sliced) return sliced;
  }

  // Fallback 1: Parse multi-file block markers (e.g. `// --- file: src/App.tsx ---`)
  const fileMarkerRegex = /(?:\/\/\s*---|###|\/\*)\s*(?:file:)?\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*(?:---|---\*\/|\n)([\s\S]*?)(?=(?:\/\/\s*---|###|\/\*)\s*(?:file:)?\s*[a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+|$)/g;
  const files: Record<string, string> = {};
  let match;
  while ((match = fileMarkerRegex.exec(text)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim().replace(/^```[a-zA-Z]*\n/, "").replace(/```$/, "").trim();
    if (filename && content) {
      files[filename] = content;
    }
  }

  if (Object.keys(files).length > 0) {
    return {
      project: normalizeProject(
        {
          title: "React Application",
          description: "Generated React application",
          files,
        },
        options
      ),
    };
  }

  // Fallback 2: If model returned single React component / JSX code
  let cleanCode = text
    .replace(/^```(?:tsx|jsx|typescript|javascript|html)?\n/i, "")
    .replace(/```$/i, "")
    .trim();

  // If it returned an HTML file containing React babel script, extract it
  const babelMatch = cleanCode.match(/<script type="text\/babel">([\s\S]*?)<\/script>/i);
  if (babelMatch && babelMatch[1].trim().length > 0) {
    cleanCode = babelMatch[1].trim();
  }

  return {
    project: normalizeProject(
      {
        title: "React Application",
        description: "Generated React application",
        files: {
          "src/App.tsx":
            cleanCode ||
            `export default function App() { return <div className="p-8 text-center"><h1>React App</h1></div>; }`,
        },
      },
      options
    ),
  };
}

/** Parses one candidate JSON string, unwrapping a doubly-nested project. */
function tryParseProject(candidate: string, options: ParseOptions): ProjectResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Partial<ReactProject> & { deletedFiles?: unknown };
  if (!obj.files || typeof obj.files !== "object") return null;

  // Some responses wrap the whole project as a string inside a single file.
  const fileKeys = Object.keys(obj.files);
  if (fileKeys.length === 1 && typeof obj.files[fileKeys[0]] === "string") {
    const inner = tryParseProject(obj.files[fileKeys[0]], options);
    if (inner) return inner;
  }

  return toResponse(obj, options);
}

function toResponse(
  parsed: Partial<ReactProject> & { deletedFiles?: unknown },
  options: ParseOptions
): ProjectResponse {
  const deletedFiles = Array.isArray(parsed.deletedFiles)
    ? parsed.deletedFiles.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : undefined;

  return {
    project: normalizeProject(parsed, options),
    deletedFiles: deletedFiles && deletedFiles.length > 0 ? deletedFiles : undefined,
  };
}

export function normalizeProject(
  project: Partial<ReactProject>,
  options: ParseOptions = {}
): ReactProject {
  const files: Record<string, string> = {};
  const rawFiles = project.files || {};

  for (const [key, val] of Object.entries(rawFiles)) {
    if (typeof val === "string") {
      let normalizedKey = key.trim();
      if (!normalizedKey.startsWith("src/") && !normalizedKey.includes("/")) {
        normalizedKey = "src/" + normalizedKey;
      }
      files[normalizedKey] = val;
    }
  }

  // A partial response legitimately has no App file — the existing project does.
  if (!options.allowPartial) {
    const hasApp = Object.keys(files).some(
      (f) => /src\/App\.(tsx|jsx|js|ts)$/i.test(f) || f === "App.tsx" || f === "App.jsx"
    );

    if (!hasApp && Object.keys(files).length > 0) {
      const firstKey = Object.keys(files)[0];
      files["src/App.tsx"] = files[firstKey];
    } else if (Object.keys(files).length === 0) {
      files["src/App.tsx"] = FALLBACK_APP;
    }
  }

  // For a partial response, inferring an entry from the changed files would point
  // the preview at whichever component was edited. Leave it unset so the merge
  // keeps the existing entry unless the model named one explicitly.
  const entryFile =
    options.allowPartial && !project.entryFile
      ? undefined
      : pickEntryFile(files, project.entryFile);

  return {
    title: project.title || "React Project",
    description: project.description || "Modern React & TypeScript application",
    files,
    entryFile,
  };
}

const FALLBACK_APP = `import React from 'react';
import { Sparkles } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="text-center">
        <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
        <h1 className="text-3xl font-bold">مرحبًا بك في تطبيق React</h1>
      </div>
    </div>
  );
}`;

