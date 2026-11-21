import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { PageHeader } from "@/client/components/PageHeader";
import { Choice, OptionsPanel, TextField } from "@/client/components/tool/Fields";
import { FilePicker } from "@/client/components/tool/FilePicker";
import { ResultList, ToolError } from "@/client/components/tool/Results";
import { SourceBar } from "@/client/components/tool/SourceBar";
import { useSinglePdf } from "@/client/components/tool/usePdf";
import { useTool } from "@/client/components/tool/useTool";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { addPageNumbers, openPdf, ToolInputError, type Horizontal, type Vertical } from "@/client/lib/pdf";
import { baseName, parsePageSet } from "@/lib/ranges";

export const Route = createFileRoute("/page-numbers")({
  ssr: false,
  head: () => ({ meta: [{ title: "Page numbers" }] }),
  component: PageNumbers,
});

function PageNumbers() {
  const tool = useTool("page-numbers");
  const source = useSinglePdf(() => tool.reset());
  const { pdf } = source;
  const [vertical, setVertical] = useState<Vertical>("bottom");
  const [horizontal, setHorizontal] = useState<Horizontal>("center");
  const [format, setFormat] = useState<"number" | "total">("number");
  const [first, setFirst] = useState("1");
  const [fontSize, setFontSize] = useState("12");
  const [pages, setPages] = useState("");
  const [skipFirst, setSkipFirst] = useState(false);

  function apply() {
    if (!pdf) return;
    void tool.run(async () => {
      const firstNumber = Number(first);
      if (!Number.isInteger(firstNumber) || firstNumber < 0) throw new ToolInputError("The first number must be a whole number, 0 or more.");
      const size = Number(fontSize);
      if (!(size >= 6 && size <= 72)) throw new ToolInputError("Font size must be between 6 and 72.");
      const picked = parsePageSet(pages, pdf.pageCount);
      if (!picked.ok) throw new ToolInputError(picked.error);
      // A fresh copy, so running again starts from the original.
      const doc = await openPdf(pdf.name, pdf.bytes);
      const bytes = await addPageNumbers(doc, { vertical, horizontal, withTotal: format === "total", first: firstNumber, fontSize: size, pages: picked.pages, skipFirst });
      return [{ name: `${baseName(pdf.name)}-numbered.pdf`, type: "application/pdf", bytes }];
    });
  }

  return (
    <AppPage>
      <PageHeader title="Page numbers" description="Number the pages of a PDF." />
      {pdf ? (
        <SourceBar pdf={pdf} onClear={() => { source.clear(); tool.reset(); }} />
      ) : (
        <FilePicker accept="application/pdf" label="Choose a PDF" onFiles={(files) => void source.choose(files)} libraryAccepts={(mime) => mime === "application/pdf"} />
      )}
      <ToolError message={source.loadError ?? tool.error} />
      {pdf ? (
        <>
          <OptionsPanel>
            <Choice label="Vertical position" value={vertical} onChange={setVertical} options={[{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }]} />
            <Choice label="Horizontal position" value={horizontal} onChange={setHorizontal} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
            <Choice label="Format" value={format} onChange={setFormat} options={[{ value: "number", label: "Number only" }, { value: "total", label: "Number and total" }]} />
            <TextField label="First number" testId="first-number-input" type="number" min={0} value={first} onChange={(e) => setFirst(e.target.value)} className="max-w-40" />
            <TextField label="Font size" testId="font-size-input" type="number" min={6} max={72} value={fontSize} onChange={(e) => setFontSize(e.target.value)} suffix="pt" className="max-w-40" />
            <TextField label="Pages" testId="pages-input" placeholder={`All, or a range such as 2-${pdf.pageCount}`} value={pages} onChange={(e) => setPages(e.target.value)} />
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox id="skip-first" aria-label="Skip the first page" checked={skipFirst} onCheckedChange={setSkipFirst} />
              <Label htmlFor="skip-first">Skip the first page</Label>
            </div>
          </OptionsPanel>
          <div className="flex justify-end">
            <Button data-testid="run-tool" pending={tool.busy} onClick={apply}>
              Add page numbers
            </Button>
          </div>
        </>
      ) : null}
      <ResultList results={tool.results} />
    </AppPage>
  );
}
