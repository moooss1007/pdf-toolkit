import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { PageHeader } from "@/client/components/PageHeader";
import { Choice, OptionsPanel } from "@/client/components/tool/Fields";
import { FileList, move, type ListedFile } from "@/client/components/tool/FileList";
import { FilePicker } from "@/client/components/tool/FilePicker";
import { ResultList, ToolError } from "@/client/components/tool/Results";
import { useTool } from "@/client/components/tool/useTool";
import { Button } from "@/client/components/ui/button";
import { imagesToPdf, sniffKind, type ImagesOptions } from "@/client/lib/pdf";
import { readFile } from "@/client/lib/save";
import { MAX_FILES, MAX_TOTAL_BYTES, formatBytes } from "@/lib/constants";
import { baseName } from "@/lib/ranges";

export const Route = createFileRoute("/images-to-pdf")({
  ssr: false,
  head: () => ({ meta: [{ title: "Images to PDF" }] }),
  component: ImagesToPdf,
});

type Item = ListedFile & { bytes: Uint8Array };

function ImagesToPdf() {
  const tool = useTool("images-to-pdf");
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<ImagesOptions["pageSize"]>("a4");
  const [orientation, setOrientation] = useState<ImagesOptions["orientation"]>("portrait");
  const [margin, setMargin] = useState<ImagesOptions["margin"]>("none");

  async function add(files: File[]) {
    tool.reset();
    if (items.length + files.length > MAX_FILES) return tool.fail(`Adding ${files[0]!.name} would go over ${MAX_FILES} images.`);
    const total = items.reduce((sum, item) => sum + item.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_BYTES) return tool.fail(`Adding ${files.map((f) => f.name).join(", ")} would go over ${formatBytes(MAX_TOTAL_BYTES)} in total.`);
    const added: Item[] = [];
    for (const file of files) {
      const bytes = await readFile(file);
      const kind = sniffKind(bytes);
      if (kind !== "png" && kind !== "jpg") return tool.fail(`${file.name} isn't a JPG or PNG.`);
      added.push({ id: crypto.randomUUID(), name: file.name, size: file.size, kind, bytes });
    }
    setItems((current) => [...current, ...added]);
  }

  return (
    <AppPage>
      <PageHeader title="Images to PDF" description="Put JPG and PNG images into one PDF, one image per page." />
      <FilePicker accept="image/png,image/jpeg" multiple label="Choose images" onFiles={(files) => void add(files)} libraryAccepts={(mime) => mime === "image/jpeg"} />
      <ToolError message={tool.error} />
      {items.length > 0 ? (
        <>
          <FileList
            files={items}
            onMove={(from, to) => { tool.reset(); setItems((current) => move(current, from, to)); }}
            onRemove={(id) => { tool.reset(); setItems((current) => current.filter((item) => item.id !== id)); }}
          />
          <OptionsPanel>
            <Choice label="Page size" value={pageSize} onChange={setPageSize} options={[{ value: "a4", label: "A4" }, { value: "fit", label: "Fit to image" }]} />
            <Choice label="Orientation" value={orientation} onChange={setOrientation} disabled={pageSize === "fit"} options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} />
            <Choice label="Margin" value={margin} onChange={setMargin} options={[{ value: "none", label: "None" }, { value: "small", label: "Small" }, { value: "large", label: "Large" }]} />
          </OptionsPanel>
        </>
      ) : null}
      <div className="flex justify-end">
        <Button
          data-testid="run-tool"
          pending={tool.busy}
          disabled={items.length === 0}
          onClick={() =>
            void tool.run(async () => [
              {
                name: items.length === 1 ? `${baseName(items[0]!.name)}.pdf` : "images.pdf",
                type: "application/pdf",
                bytes: await imagesToPdf(items, { pageSize, orientation, margin }),
              },
            ])
          }
        >
          Convert to PDF
        </Button>
      </div>
      <ResultList results={tool.results} />
    </AppPage>
  );
}
