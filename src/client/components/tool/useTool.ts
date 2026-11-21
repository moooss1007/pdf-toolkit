import { useState } from "react";
import { ToolInputError } from "@/client/lib/pdf";
import { saveOutput, type Output, type SavedResult } from "@/client/lib/save";
import type { ToolId } from "@/lib/constants";

export function messageOf(error: unknown): string {
  if (error instanceof ToolInputError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}

/** Runs a tool: makes its outputs, saves each to the library, and keeps the error. */
export function useTool(tool: ToolId) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SavedResult[]>([]);

  async function run(make: () => Promise<Output[]>) {
    setError(null);
    setResults([]);
    setBusy(true);
    try {
      const outputs = await make();
      const saved: SavedResult[] = [];
      for (const output of outputs) saved.push(await saveOutput(tool, output));
      setResults(saved);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    results,
    run,
    fail: (message: string) => {
      setResults([]);
      setError(message);
    },
    reset: () => {
      setError(null);
      setResults([]);
    },
  };
}
