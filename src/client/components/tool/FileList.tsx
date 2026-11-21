import { ArrowDown, ArrowUp, FileText, GripVertical, Image, X } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/client/components/ui/button";
import { formatBytes } from "@/lib/constants";

export interface ListedFile {
  id: string;
  name: string;
  size: number;
  kind: "pdf" | "png" | "jpg";
  detail?: string;
}

/** The chosen files in order: drag, or move up and down, and remove. */
export function FileList({
  files,
  onMove,
  onRemove,
}: {
  files: ListedFile[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <ol className="divide-y divide-border rounded-xl border border-border bg-card">
      {files.map((file, index) => {
        const Icon = file.kind === "pdf" ? FileText : Image;
        return (
          <li
            key={file.id}
            data-testid="file-item"
            draggable
            onDragStart={() => setDragging(index)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragging !== null && dragging !== index) onMove(dragging, index);
              setDragging(null);
            }}
            className={cn("flex items-center gap-3 py-2 pr-2 pl-3", dragging === index && "opacity-50")}
          >
            <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{file.name}</span>
              <span className="block text-xs text-muted-foreground">
                {formatBytes(file.size)}
                {file.detail ? ` · ${file.detail}` : ""}
              </span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={`Move up ${file.name}`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move down ${file.name}`} disabled={index === files.length - 1} onClick={() => onMove(index, index + 1)}>
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(file.id)}>
              <X />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
