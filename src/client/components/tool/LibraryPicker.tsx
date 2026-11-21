import { FileText } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";
import { Spinner } from "@/client/components/ui/spinner";
import { openSaved, type SavedResult } from "@/client/lib/save";
import { TOOLS, formatBytes, isToolId } from "@/lib/constants";
import { getResults } from "@/serverFunctions/results";

/** Starts a tool from a file already in the library. */
export function LibraryPicker({
  accepts,
  onPick,
}: {
  accepts: (mime: string) => boolean;
  onPick: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function load() {
    setError(null);
    setItems(null);
    try {
      setItems((await getResults({ data: {} })).filter((r) => accepts(r.mime)));
    } catch {
      setError("The library couldn't be loaded.");
    }
  }

  async function pick(result: SavedResult) {
    setOpening(result.id);
    try {
      onPick(await openSaved(result));
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setOpening(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>From library</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a saved file</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : items === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState size="sm" title="No saved files of this type" />
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {items.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  disabled={opening !== null}
                  onClick={() => void pick(result)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {opening === result.id ? <Spinner /> : <FileText className="size-4 text-muted-foreground" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{result.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {isToolId(result.tool) ? TOOLS[result.tool] : result.tool} · {formatBytes(result.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
