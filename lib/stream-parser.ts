/**
 * Incremental parser for the model's streamed JSON project output.
 *
 * The model emits one object shaped like
 * `{ "title": ..., "description": ..., "files": { "path": "source" } }`,
 * sometimes wrapped in a markdown fence. Waiting for the closing brace before
 * showing anything is what makes generation feel slow, so this walks whatever
 * text has arrived and reports every value it can already prove terminated,
 * plus the file currently being written.
 *
 * Pure and dependency-free on purpose: the route handler and the browser both
 * run it over the same bytes.
 */

export interface PartialProject {
  title?: string;
  description?: string;
  /** Files whose closing quote has been seen — safe to render. */
  files: Record<string, string>;
  /** File still streaming in, if any. */
  activeFile?: { path: string; content: string };
  deletedFiles?: string[];
  /** True once the top-level object has been closed. */
  complete: boolean;
}

interface StringRead {
  value: string;
  /** Index just past the closing quote, or text.length when unterminated. */
  end: number;
  complete: boolean;
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "\\": "\\",
  "/": "/",
};

/** Drops an opening ``` or ```json fence; the closing fence may not exist yet. */
export function stripFence(raw: string): string {
  const text = raw.trimStart();
  if (!text.startsWith("```")) return text;
  const firstNewline = text.indexOf("\n");
  if (firstNewline === -1) return "";
  const body = text.slice(firstNewline + 1);
  const closing = body.lastIndexOf("```");
  return closing === -1 ? body : body.slice(0, closing);
}

function skipWs(text: string, start: number): number {
  let i = start;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

/**
 * Reads a JSON string literal starting at the opening quote. An unterminated
 * literal yields the decoded prefix so callers can show partial file content.
 */
function readString(text: string, start: number): StringRead {
  let i = start + 1;
  let out = "";

  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\") {
      // An escape split across chunk boundaries must wait for more bytes.
      if (i + 1 >= text.length) return { value: out, end: text.length, complete: false };
      const esc = text[i + 1];
      if (esc === "u") {
        if (i + 6 > text.length) return { value: out, end: text.length, complete: false };
        const code = Number.parseInt(text.slice(i + 2, i + 6), 16);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
        i += 6;
        continue;
      }
      out += ESCAPES[esc] ?? esc;
      i += 2;
      continue;
    }

    if (ch === '"') return { value: out, end: i + 1, complete: true };

    out += ch;
    i += 1;
  }

  return { value: out, end: text.length, complete: false };
}

/** Advances past one JSON value of any type without interpreting it. */
function skipValue(text: string, start: number): number {
  let i = skipWs(text, start);
  if (i >= text.length) return text.length;

  const ch = text[i];
  if (ch === '"') return readString(text, i).end;

  if (ch === "{" || ch === "[") {
    const close = ch === "{" ? "}" : "]";
    let depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i = readString(text, i).end;
        continue;
      }
      if (c === ch) depth += 1;
      else if (c === close) {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
      i += 1;
    }
    return text.length;
  }

  while (i < text.length && !/[,}\]\s]/.test(text[i])) i += 1;
  return i;
}

/** Reads a `"path": "source"` map, tolerating a truncated final entry. */
function readFilesObject(
  text: string,
  start: number
): { files: Record<string, string>; activeFile?: { path: string; content: string }; end: number } {
  const files: Record<string, string> = {};
  let activeFile: { path: string; content: string } | undefined;
  let i = skipWs(text, start);

  if (text[i] !== "{") return { files, end: i };
  i += 1;

  while (i < text.length) {
    i = skipWs(text, i);
    if (text[i] === "}") return { files, activeFile, end: i + 1 };
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] !== '"') break;

    const key = readString(text, i);
    if (!key.complete) break;
    i = skipWs(text, key.end);
    if (text[i] !== ":") break;
    i = skipWs(text, i + 1);

    if (text[i] !== '"') {
      // Non-string file body (model error); skip it rather than abort the parse.
      const next = skipValue(text, i);
      if (next === i) break;
      i = next;
      continue;
    }

    const val = readString(text, i);
    if (val.complete) {
      files[key.value] = val.value;
      i = val.end;
    } else {
      activeFile = { path: key.value, content: val.value };
      break;
    }
  }

  return { files, activeFile, end: i };
}

/** Reads an array of strings, ignoring a truncated trailing element. */
function readStringArray(text: string, start: number): { values: string[]; end: number } {
  const values: string[] = [];
  let i = skipWs(text, start);
  if (text[i] !== "[") return { values, end: i };
  i += 1;

  while (i < text.length) {
    i = skipWs(text, i);
    if (text[i] === "]") return { values, end: i + 1 };
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] !== '"') break;
    const item = readString(text, i);
    if (!item.complete) break;
    values.push(item.value);
    i = item.end;
  }

  return { values, end: i };
}

/**
 * Parses as much of a (possibly incomplete) project object as the text supports.
 * Safe to call on every chunk — it re-reads from the start, which stays cheap at
 * the sizes involved and avoids the bookkeeping bugs of a resumable scanner.
 */
export function parsePartialProject(raw: string): PartialProject {
  const text = stripFence(raw);
  const result: PartialProject = { files: {}, complete: false };

  let i = text.indexOf("{");
  if (i === -1) return result;
  i += 1;

  while (i < text.length) {
    i = skipWs(text, i);
    if (text[i] === "}") {
      result.complete = true;
      break;
    }
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] !== '"') break;

    const key = readString(text, i);
    if (!key.complete) break;
    i = skipWs(text, key.end);
    if (text[i] !== ":") break;
    i = skipWs(text, i + 1);

    if (key.value === "files") {
      const parsed = readFilesObject(text, i);
      Object.assign(result.files, parsed.files);
      if (parsed.activeFile) {
        result.activeFile = parsed.activeFile;
        break;
      }
      i = parsed.end;
      continue;
    }

    if (key.value === "deletedFiles") {
      const parsed = readStringArray(text, i);
      if (parsed.values.length > 0) result.deletedFiles = parsed.values;
      i = parsed.end;
      continue;
    }

    if (key.value === "title" || key.value === "description") {
      if (text[i] === '"') {
        const val = readString(text, i);
        result[key.value] = val.value;
        if (!val.complete) break;
        i = val.end;
        continue;
      }
    }

    const next = skipValue(text, i);
    if (next === i) break;
    i = next;
  }

  return result;
}

/** Decodes one SSE frame body into its `content` delta and `finish_reason`. */
export function parseSseData(data: string): { content: string; finishReason?: string } {
  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
    };
    const choice = parsed.choices?.[0];
    return {
      content: choice?.delta?.content ?? "",
      finishReason: choice?.finish_reason ?? undefined,
    };
  } catch {
    return { content: "" };
  }
}

/**
 * Splits a raw SSE buffer into complete frames, returning the trailing partial
 * frame so the caller can prepend it to the next chunk.
 */
export function splitSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? "";
  const frames: string[] = [];

  for (const part of parts) {
    for (const line of part.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) frames.push(trimmed.slice(5).trim());
    }
  }

  return { frames, rest };
}
