import type { ToolId } from "@/lib/constants";

export interface SavedResult {
  id: string;
  name: string;
  tool: string;
  mime: string;
  size: number;
  createdAt: number;
  expiresAt: number;
}

export interface Output {
  name: string;
  bytes: Uint8Array | Blob;
  type: string;
}

/** Saves one output to the member's library. */
export async function saveOutput(tool: ToolId, output: Output): Promise<SavedResult> {
  const form = new FormData();
  form.set("tool", tool);
  const blob = output.bytes instanceof Blob ? output.bytes : new Blob([output.bytes as BlobPart], { type: output.type });
  form.set("file", blob, output.name);
  const response = await fetch("/api/results", { method: "POST", body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Saving ${output.name} failed.`);
  }
  return ((await response.json()) as { result: SavedResult }).result;
}

/** Fetches a saved result as a File, to start a tool from it. */
export async function openSaved(result: { id: string; name: string; mime: string }): Promise<File> {
  const response = await fetch(`/api/results/${result.id}`);
  if (!response.ok) throw new Error(`${result.name} is no longer available.`);
  return new File([await response.blob()], result.name, { type: result.mime });
}

export async function readFile(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}
