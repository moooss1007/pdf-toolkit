import { Link } from "@tanstack/react-router";
import { CircleCheck, Download, FileArchive, FileImage, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import type { SavedResult } from "@/client/lib/save";
import { formatBytes } from "@/lib/constants";

export function fileIcon(mime: string) {
  return mime === "application/zip" ? FileArchive : mime.startsWith("image/") ? FileImage : FileText;
}

/** What the last run made, each with its download. */
export function ResultList({ results }: { results: SavedResult[] }) {
  if (results.length === 0) return null;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium">
          <CircleCheck className="size-4 text-primary" aria-hidden />
          {results.length === 1 ? "Your file is ready" : `${results.length} files are ready`}
        </h2>
        <Button variant="link" size="sm" render={<Link to="/library" />}>
          Open library
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {results.map((result) => {
          const Icon = fileIcon(result.mime);
          return (
            <li key={result.id} data-testid="tool-result" className="flex items-center gap-3 py-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{result.name}</span>
                <span className="block text-xs text-muted-foreground">{formatBytes(result.size)}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                render={<a href={`/api/results/${result.id}`} download={result.name} data-testid="download-result" />}
              >
                <Download />
                Download
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ToolError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" data-testid="tool-error">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
