/**
 * Messages the preview iframe posts back to the host page.
 *
 * The frame runs with an opaque origin (no `allow-same-origin`), so it cannot
 * name a target origin and posts with `*`. That makes validation the host's job:
 * `isPreviewMessage` checks the envelope, and the listener must additionally
 * confirm `event.source` is its own iframe before trusting the contents.
 */

export type PreviewMessageKind = "ready" | "error" | "missing-module";

export interface PreviewPayload {
  kind: PreviewMessageKind;
  message: string;
  stack?: string;
  componentStack?: string;
  file?: string;
  context?: string;
  module?: string;
}

export interface PreviewMessage {
  source: "bannaa-preview";
  version: 1;
  payload: PreviewPayload;
}

export function isPreviewMessage(data: unknown): data is PreviewMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  if (msg.source !== "bannaa-preview" || msg.version !== 1) return false;

  const payload = msg.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.message !== "string") return false;

  return (
    payload.kind === "ready" || payload.kind === "error" || payload.kind === "missing-module"
  );
}
