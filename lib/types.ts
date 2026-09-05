export type VersionStatus = "pending" | "done" | "error" | "cancelled";

/**
 * Machine-readable reason a generation was refused *before* the stream opened.
 *
 * Declared here rather than next to the wire format because the version list
 * carries it: the sidebar renders "top up" as a button for `insufficient_credits`
 * and as a sentence for everything else, and a stringly-typed comparison there
 * would silently stop matching the day the server renames a code.
 */
export type GenerateErrorCode =
  | "rate_limited"
  | "invalid_request"
  | "auth_required"
  | "insufficient_credits"
  | "billing_unavailable"
  | "provider_error";

export type ProjectFiles = Record<string, string>;

export interface ReactProject {
  title: string;
  description: string;
  files: ProjectFiles;
  entryFile?: string; // default "src/App.tsx"
}

/** Live state of a generation still in flight, used to render the reveal. */
export interface StreamingState {
  title?: string;
  description?: string;
  /** Files received so far, including the one still being written. */
  files: ProjectFiles;
  /** Path currently streaming, if any. */
  activeFile?: string;
  /** Model serving this attempt, after any provider failover. */
  model?: string;
}

export interface Version {
  id: string;
  prompt: string;
  project: ReactProject | null;
  status: VersionStatus;
  errorMessage?: string;
  /** Set only for a pre-stream refusal, so the UI can offer the right recovery. */
  errorCode?: GenerateErrorCode;
  createdAt: number;
  /** Present only while `status === "pending"`. */
  streaming?: StreamingState;
  /** Set when this version was produced by an automatic error-repair pass. */
  repairOf?: string;
  /** Guards the repair loop from bouncing between two broken outputs. */
  repairAttempts?: number;
}

/** A runtime failure reported by the preview sandbox. */
export interface PreviewError {
  message: string;
  file?: string;
  stack?: string;
}
