/**
 * Wire format for `/api/generate`.
 *
 * The route streams newline-delimited JSON: one event per line, each a complete
 * JSON object. NDJSON rather than SSE because the client reads it with `fetch` +
 * `ReadableStream` (EventSource cannot POST), and framing on `\n` is enough.
 *
 * Shared by the route handler and the browser so the two cannot drift.
 */

import type { ReactProject } from "./types";

export interface StreamMetaEvent {
  type: "meta";
  /** Model that actually served the request, after any failover. */
  model: string;
  /** True when this run is a modification of an existing project. */
  isEdit: boolean;
}

/** Emitted when a file finishes streaming, or its content grows. */
export interface StreamFileEvent {
  type: "file";
  path: string;
  content: string;
  /** False while the file is still being written. */
  done: boolean;
}

export interface StreamTitleEvent {
  type: "title";
  title?: string;
  description?: string;
}

/** Terminal success event carrying the merged, normalised project. */
export interface StreamDoneEvent {
  type: "done";
  project: ReactProject;
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
  /** Set when the client should offer a retry rather than treat it as fatal. */
  retryable?: boolean;
}

export type StreamEvent =
  | StreamMetaEvent
  | StreamFileEvent
  | StreamTitleEvent
  | StreamDoneEvent
  | StreamErrorEvent;

export const STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export function encodeEvent(event: StreamEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Splits an NDJSON buffer into decoded events, returning the trailing partial
 * line for the caller to prepend to the next chunk. Unparseable lines are
 * dropped rather than throwing — a malformed line must not kill the stream.
 */
export function decodeEvents(buffer: string): { events: StreamEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: StreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as StreamEvent);
    } catch {
      // ignore
    }
  }

  return { events, rest };
}
