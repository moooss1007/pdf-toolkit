import { createFileRoute } from "@tanstack/react-router";
import { zipSync } from "fflate";
import { useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { PageHeader } from "@/client/components/PageHeader";
import { Choice, OptionsPanel } from "@/client/components/tool/Fields";
import { FilePicker } from "@/client/components/tool/FilePicker";
import { PageThumb } from "@/client/components/tool/PageThumb";
import { ResultList, ToolError } from "@/client/components/tool/Results";
import { SourceBar } from "@/client/components/tool/SourceBar";
import { useRenderDoc, useSinglePdf } from "@/client/components/tool/usePdf";
import { useTool } from "@/client/components/tool/useTool";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { ToolInputError } from "@/client/lib/pdf";
import { openForRender, renderJpeg } from "@/client/lib/render";
import { readFile } from "@/client/lib/save";
import { baseName } from "@/lib/ranges";

export const Route = createFileRoute("/pdf-to-jpg")({
  ssr: false,
  head: () => ({ meta: [{ title: "PDF to JPG" }] }),
  component: PdfToJpg,
});

/** Pixels per PDF point: 108 and 216 dpi. */
const SCALE = { normal: 1.5, high: 3 } as const;

function PdfToJpg() {
  const tool = useTool("pdf-to-jpg");
  const source = useSinglePdf(() => {
    tool.reset();
    setSelected(new Set());
  });
  const { pdf } = source;
  const renderDoc = useRenderDoc(pdf?.bytes ?? null);
  const [which, setWhich] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [quality, setQuality] = useState<keyof typeof SCALE>("normal");

  function convert() {
    if (!pdf) return;
    void tool.run(async () => {
      const pages = which === "all" ? Array.from({ length: pdf.pageCount }, (_, i) => i + 1) : [...selected].sort((a, b) => a - b);
      if (pages.length === 0) throw new ToolInputError("Tick at least one page.");
      const doc = await openForRender(pdf.bytes);
      try {
        const base = baseName(pdf.name);
        const images: [string, Uint8Array][] = [];
        for (const n of pages) images.push([`${base}-${n}.jpg`, await readFile(await renderJpeg(doc, n, SCALE[quality]))]);
        if (images.length === 1) return [{ name: images[0]![0], type: "image/jpeg", bytes: images[0]![1] }];
        // JPEGs are already compressed: store them as they are.
        const zip = zipSync(Object.fromEntries(images.map(([name, bytes]) => [name, [bytes, { level: 0 }]])));
        return [{ name: `${base}-jpg.zip`, type: "application/zip", bytes: zip }];
      } finally {
        void doc.destroy();
      }
    });
  }

  return (
    <AppPage>
      <PageHeader title="PDF to JPG" description="Save the pages of a PDF as JPG images." />
      {pdf ? (
        <SourceBar pdf={pdf} onClear={() => { source.clear(); tool.reset(); }} />
      ) : (
        <FilePicker accept="application/pdf" label="Choose a PDF" onFiles={(files) => void source.choose(files)} libraryAccepts={(mime) => mime === "application/pdf"} />
      )}
      <ToolError message={source.loadError ?? tool.error} />
      {pdf ? (
        <>
          <OptionsPanel>
            <Choice label="Pages" value={which} onChange={setWhich} options={[{ value: "all", label: "All pages" }, { value: "selected", label: "Selected pages" }]} />
            <Choice label="Quality" value={quality} onChange={setQuality} options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
          </OptionsPanel>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: pdf.pageCount }, (_, i) => i + 1).map((n) => (
              <PageThumb key={n} doc={renderDoc} pageNumber={n} label={`Page ${n}`} selected={which === "selected" && selected.has(n)}>
                {which === "selected" ? (
                  <Checkbox
                    aria-label={`Page ${n}`}
                    checked={selected.has(n)}
                    onCheckedChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(n);
                        else next.delete(n);
                        return next;
                      })
                    }
                  />
                ) : null}
              </PageThumb>
            ))}
          </div>
          <div className="flex justify-end">
            <Button data-testid="run-tool" pending={tool.busy} onClick={convert}>
              Convert to JPG
            </Button>
          </div>
        </>
      ) : null}
      <ResultList results={tool.results} />
    </AppPage>
  );
}
