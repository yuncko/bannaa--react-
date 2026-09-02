export type VersionStatus = "pending" | "done" | "error";

export type ProjectFiles = Record<string, string>;

export interface ReactProject {
  title: string;
  description: string;
  files: ProjectFiles;
  entryFile?: string; // default "src/App.tsx"
}

export interface Version {
  id: string;
  prompt: string;
  project: ReactProject | null;
  status: VersionStatus;
  errorMessage?: string;
  createdAt: number;
}
