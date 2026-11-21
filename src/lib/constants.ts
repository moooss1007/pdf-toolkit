/** Shared by the pages and the server. */
export const MAX_FILES = 25;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const RETENTION_MS = 2 * 60 * 60 * 1000;

export const TOOLS = {
  merge: "Merge",
  split: "Split",
  organize: "Organize",
  "page-numbers": "Page numbers",
  watermark: "Watermark",
  "images-to-pdf": "Images to PDF",
  "pdf-to-jpg": "PDF to JPG",
} as const;
export type ToolId = keyof typeof TOOLS;

export function isToolId(value: unknown): value is ToolId {
  return typeof value === "string" && Object.hasOwn(TOOLS, value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
