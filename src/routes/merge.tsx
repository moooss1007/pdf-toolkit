import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { PageHeader } from "@/client/components/PageHeader";
import { FileList, move, type ListedFile } from "@/client/components/tool/FileList";
import { FilePicker } from "@/client/components/tool/FilePicker";
import { ResultList, ToolError } from "@/client/components/tool/Results";
import { useTool } from "@/client/components/tool/useTool";
import { Button } from "@/client/components/ui/button";
import { mergeFiles, openPdf, sniffKind } from "@/client/lib/pdf";
import { readFile } from "@/client/lib/save";
import { MAX_FILES, MAX_TOTAL_BYTES, formatBytes } from "@/lib/constants";

export const Route = createFileRoute("/merge")({
  ssr: false,
  head: () => ({ meta: [{ title: "Merge PDFs" }] }),
  component: Merge,
});

type Item = ListedFile & { bytes: Uint8Array };

function Merge() {
  const [items, setItems] = useState<Item[]>([]);
  const tool = useTool("merge");

  async function add(files: File[]) {
    tool.reset();
    if (items.length + files.length > MAX_FILES) {
      return tool.fail(`Adding ${files[0]!.name}${files.length > 1 ? ` and ${files.length - 1} more` : ""} would go over ${MAX_FILES} files.`);
    }
    const total = items.reduce((sum, item) => sum + item.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      return tool.fail(`Adding ${files.map((f) => f.name).join(", ")} would go over ${formatBytes(MAX_TOTAL_BYTES)} in total.`);
    }
    const added: Item[] = [];
    for (const file of files) {
      const bytes = await readFile(file);
      const kind = sniffKind(bytes);
      if (!kind) return tool.fail(`${file.name} isn't a PDF, JPG or PNG.`);
      let detail = "Image";
      if (kind === "pdf") {
        try {
          const doc = await openPdf(file.name, bytes);
          const pages = doc.getPageCount();
          detail = pages === 1 ? "1 page" : `${pages} pages`;
        } catch (error) {
          return tool.fail(error instanceof Error ? error.message : String(error));
        }
      }
      added.push({ id: crypto.randomUUID(), name: file.name, size: file.size, kind, detail, bytes });
    }
    setItems((current) => [...current, ...added]);
  }

  const total = items.reduce((sum, item) => sum + item.size, 0);

  return (
    <AppPage>
      <PageHeader title="Merge PDFs" description="Combine PDFs and images into one PDF, in the order you set." />
      <FilePicker
        accept="application/pdf,image/png,image/jpeg"
        multiple
        label="Choose files"
        onFiles={(files) => void add(files)}
        libraryAccepts={(mime) => mime === "application/pdf" || mime === "image/jpeg"}
      />
      <ToolError message={tool.error} />
      {items.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {items.length} of {MAX_FILES} files · {formatBytes(total)} of {formatBytes(MAX_TOTAL_BYTES)}
          </p>
          <FileList
            files={items}
            onMove={(from, to) => {
              tool.reset();
              setItems((current) => move(current, from, to));
            }}
            onRemove={(id) => {
              tool.reset();
              setItems((current) => current.filter((item) => item.id !== id));
            }}
          />
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          data-testid="run-tool"
          pending={tool.busy}
          disabled={items.length < 2}
          onClick={() =>
            void tool.run(async () => [
              { name: "merged.pdf", type: "application/pdf", bytes: await mergeFiles(items) },
            ])
          }
        >
          Merge {items.length > 0 ? `${items.length} files` : ""}
        </Button>
      </div>
      <ResultList results={tool.results} />
    </AppPage>
  );
}
