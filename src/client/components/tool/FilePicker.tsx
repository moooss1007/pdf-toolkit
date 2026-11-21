import { Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { LibraryPicker } from "@/client/components/tool/LibraryPicker";
import { Button } from "@/client/components/ui/button";

/** A drop zone with a file button and, optionally, a pick from the library. */
export function FilePicker({
  accept,
  multiple = false,
  label,
  onFiles,
  libraryAccepts,
  testId = "file-input",
  children,
}: {
  accept: string;
  multiple?: boolean;
  label: string;
  onFiles: (files: File[]) => void;
  /** Which saved results this tool can start from, by type. */
  libraryAccepts?: (mime: string) => boolean;
  testId?: string;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const files = [...event.dataTransfer.files];
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center",
        over && "border-primary bg-primary/5",
      )}
    >
      <Upload className="size-6 text-muted-foreground" aria-hidden />
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => input.current?.click()}>{label}</Button>
        {libraryAccepts ? (
          <LibraryPicker accepts={libraryAccepts} onPick={(file) => onFiles([file])} />
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">or drop {multiple ? "them" : "it"} here</p>
      {children}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        data-testid={testId}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
