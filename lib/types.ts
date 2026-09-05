export type VersionStatus = "pending" | "done" | "error" | "cancelled";

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
