import { FileText, X } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { formatBytes } from "@/lib/constants";

/** The PDF a tool is working on, with a way to pick another. */
export function SourceBar({
  pdf,
  onClear,
}: {
  pdf: { name: string; size: number; pageCount: number };
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{pdf.name}</p>
        <p className="text-xs text-muted-foreground" data-testid="page-count">
          {pdf.pageCount === 1 ? "1 page" : `${pdf.pageCount} pages`} · {formatBytes(pdf.size)}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X />
        Change file
      </Button>
    </div>
  );
}
