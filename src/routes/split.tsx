import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { PageHeader } from "@/client/components/PageHeader";
import { TextField } from "@/client/components/tool/Fields";
import { FilePicker } from "@/client/components/tool/FilePicker";
import { PageThumb } from "@/client/components/tool/PageThumb";
import { ResultList, ToolError } from "@/client/components/tool/Results";
import { SourceBar } from "@/client/components/tool/SourceBar";
import { useRenderDoc, useSinglePdf } from "@/client/components/tool/usePdf";
import { useTool } from "@/client/components/tool/useTool";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { extractPages, ToolInputError } from "@/client/lib/pdf";
import { baseName, fixedRanges, parseRanges, rangeFileName, type PageRange } from "@/lib/ranges";

export const Route = createFileRoute("/split")({
  ssr: false,
  head: () => ({ meta: [{ title: "Split PDF" }] }),
  component: Split,
});

type Mode = "ranges" | "select" | "fixed";

function Split() {
  const tool = useTool("split");
  const source = useSinglePdf(() => {
    tool.reset();
    setSelected(new Set());
  });
  const { pdf } = source;
  const renderDoc = useRenderDoc(pdf?.bytes ?? null);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [combine, setCombine] = useState(false);
  const [every, setEvery] = useState("1");

  function groups(pageCount: number): PageRange[] {
    if (mode === "ranges") {
      const parsed = parseRanges(ranges, pageCount);
      if (!parsed.ok) throw new ToolInputError(parsed.error);
      return parsed.ranges;
    }
    if (mode === "fixed") {
      const size = Number(every);
      if (!Number.isInteger(size) || size < 1) throw new ToolInputError("Enter a whole number of pages, 1 or more.");
      return fixedRanges(pageCount, size);
    }
    if (selected.size === 0) throw new ToolInputError("Tick at least one page.");
    return [...selected].sort((a, b) => a - b).map((p) => ({ from: p, to: p }));
  }

  function split() {
    if (!pdf) return;
    void tool.run(async () => {
      const parts = groups(pdf.pageCount);
      if (mode === "select" && combine) {
        const pages = parts.map((r) => r.from);
        return [{ name: `${baseName(pdf.name)}-pages-${pages.join("-")}.pdf`, type: "application/pdf", bytes: await extractPages(pdf.doc, pages) }];
      }
      const outputs = [];
      for (const range of parts) {
        const pages = Array.from({ length: range.to - range.from + 1 }, (_, i) => range.from + i);
        outputs.push({ name: rangeFileName(pdf.name, range), type: "application/pdf", bytes: await extractPages(pdf.doc, pages) });
      }
      return outputs;
    });
  }

  return (
    <AppPage>
      <PageHeader title="Split PDF" description="Turn page ranges, chosen pages or equal parts of a PDF into separate files." />
      {pdf ? (
        <SourceBar pdf={pdf} onClear={() => { source.clear(); tool.reset(); }} />
      ) : (
        <FilePicker accept="application/pdf" label="Choose a PDF" onFiles={(files) => void source.choose(files)} libraryAccepts={(mime) => mime === "application/pdf"} />
      )}
      <ToolError message={source.loadError ?? tool.error} />
      {pdf ? (
        <>
          <Tabs value={mode} onValueChange={(value) => { setMode(value as Mode); tool.reset(); }}>
            <TabsList>
              <TabsTrigger value="ranges">Custom ranges</TabsTrigger>
              <TabsTrigger value="select">Select pages</TabsTrigger>
              <TabsTrigger value="fixed">Fixed size</TabsTrigger>
            </TabsList>
            <TabsContent value="ranges" className="pt-4">
              <TextField
                label="Ranges"
                testId="ranges-input"
                placeholder="1-3, 5, 8-10"
                value={ranges}
                onChange={(event) => setRanges(event.target.value)}
              />
              <p className="pt-2 text-sm text-muted-foreground">Each range becomes its own PDF.</p>
            </TabsContent>
            <TabsContent value="select" className="space-y-2 pt-4">
              <div className="flex items-center gap-2">
                <Switch id="combine" aria-label="Put the selected pages in one PDF" data-testid="combine-selected" checked={combine} onCheckedChange={setCombine} />
                <Label htmlFor="combine">Put the selected pages in one PDF</Label>
              </div>
              <p className="text-sm text-muted-foreground">{selected.size} selected</p>
            </TabsContent>
            <TabsContent value="fixed" className="pt-4">
              <TextField
                label="Pages per file"
                testId="every-n-input"
                type="number"
                min={1}
                max={pdf.pageCount}
                value={every}
                onChange={(event) => setEvery(event.target.value)}
                className="max-w-40"
              />
            </TabsContent>
          </Tabs>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: pdf.pageCount }, (_, i) => i + 1).map((n) => (
              <PageThumb key={n} doc={renderDoc} pageNumber={n} label={`Page ${n}`} selected={mode === "select" && selected.has(n)}>
                {mode === "select" ? (
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
            <Button data-testid="run-tool" pending={tool.busy} onClick={split}>
              Split
            </Button>
          </div>
        </>
      ) : null}
      <ResultList results={tool.results} />
    </AppPage>
  );
}
