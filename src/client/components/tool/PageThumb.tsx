import { useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Skeleton } from "@/client/components/ui/skeleton";
import { thumbnail, type RenderDoc } from "@/client/lib/render";

const ROTATE: Record<number, string> = { 0: "", 90: "rotate-90", 180: "rotate-180", 270: "-rotate-90" };

/** A page picture with its label and whatever controls the tool puts under it. */
export function PageThumb({
  doc,
  pageNumber,
  label,
  rotation = 0,
  dimmed = false,
  selected = false,
  blank = false,
  children,
  className,
  ...props
}: {
  doc: RenderDoc | null;
  pageNumber: number;
  label: string;
  rotation?: number;
  dimmed?: boolean;
  selected?: boolean;
  blank?: boolean;
  children?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"div">, "children">) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!doc || blank) return;
    let url: string | null = null;
    let cancelled = false;
    thumbnail(doc, pageNumber)
      .then((made) => {
        if (cancelled) URL.revokeObjectURL(made);
        else setSrc((url = made));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, pageNumber, blank]);

  return (
    <div
      data-testid="page-thumb"
      data-removed={dimmed || undefined}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-2",
        selected && "border-primary ring-2 ring-primary/30",
        className,
      )}
      {...props}
    >
      <div className={cn("flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-muted", dimmed && "opacity-30 grayscale")}>
        {blank ? (
          <div className="h-full w-3/4 rounded-sm border border-border bg-background" />
        ) : src ? (
          <img src={src} alt="" className={cn("max-h-full max-w-full shadow-sm transition-transform", ROTATE[rotation])} />
        ) : (
          <Skeleton className="h-full w-3/4" />
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("text-xs text-muted-foreground tabular-nums", dimmed && "line-through")}>{label}</span>
      </div>
      {children}
    </div>
  );
}
