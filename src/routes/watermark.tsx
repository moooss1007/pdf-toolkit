import { createFileRoute } from "@tanstack/react-router";
import { Grid3x3 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { addWatermark, openPdf, sniffKind, ToolInputError, WATERMARK_COLOURS, type WatermarkColour } from "@/client/lib/pdf";
import { readFile } from "@/client/lib/save";
import { baseName, parsePageSet } from "@/lib/ranges";

export const Route = createFileRoute("/watermark")({
  ssr: false,
  head: () => ({ meta: [{ title: "Watermark" }] }),
  component: Watermark,
});

const CELLS = ["Top left", "Top center", "Top right", "Middle left", "Middle center", "Middle right", "Bottom left", "Bottom center", "Bottom right"];
const COLOUR_NAMES: Record<WatermarkColour, string> = { black: "Black", grey: "Grey", red: "Red", blue: "Blue", green: "Green" };

function Watermark() {
  const tool = useTool("watermark");
  const source = useSinglePdf(() => tool.reset());
  const { pdf } = source;
  const [kind, setKind] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState("48");
  const [colour, setColour] = useState<WatermarkColour>("grey");
  const [image, setImage] = useState<{ name: string; bytes: Uint8Array; kind: "png" | "jpg" } | null>(null);
  const [scale, setScale] = useState("40");
  const [position, setPosition] = useState("4");
  const [opacity, setOpacity] = useState("50");
  const [rotation, setRotation] = useState<"0" | "45" | "90" | "270">("0");
  const [pages, setPages] = useState("");
  const [layer, setLayer] = useState<"front" | "behind">("front");

  async function pickImage(files: File[]) {
    const file = files[0];
    if (!file) return;
    tool.reset();
    const bytes = await readFile(file);
    const imageKind = sniffKind(bytes);
    if (imageKind !== "png" && imageKind !== "jpg") {
      setImage(null);
      return tool.fail(`${file.name} isn't a JPG or PNG.`);
    }
    setImage({ name: file.name, bytes, kind: imageKind });
  }

  function apply() {
    if (!pdf) return;
    void tool.run(async () => {
      const alpha = Number(opacity);
      if (!(alpha >= 0 && alpha <= 100)) throw new ToolInputError("Opacity must be between 0 and 100.");
      const picked = parsePageSet(pages, pdf.pageCount);
      if (!picked.ok) throw new ToolInputError(picked.error);
      let mark: Parameters<typeof addWatermark>[1]["mark"];
      if (kind === "text") {
        if (!text.trim()) throw new ToolInputError("Enter the watermark text.");
        const size = Number(fontSize);
        if (!(size >= 6 && size <= 200)) throw new ToolInputError("Font size must be between 6 and 200.");
        mark = { kind: "text", text: text.trim(), fontSize: size, colour };
      } else {
        if (!image) throw new ToolInputError("Choose a JPG or PNG to use as the watermark.");
        const share = Number(scale);
        if (!(share >= 5 && share <= 100)) throw new ToolInputError("Size must be between 5 and 100% of the page width.");
        mark = { kind: "image", bytes: image.bytes, imageKind: image.kind, name: image.name, scale: share };
      }
      const doc = await openPdf(pdf.name, pdf.bytes);
      const bytes = await addWatermark(doc, {
        mark,
        position: position === "tile" ? "tile" : Number(position),
        opacity: alpha,
        rotation: Number(rotation) as 0 | 45 | 90 | 270,
        pages: picked.pages,
        behind: layer === "behind",
      });
      return [{ name: `${baseName(pdf.name)}-watermarked.pdf`, type: "application/pdf", bytes }];
    });
  }

  return (
    <AppPage>
      <PageHeader title="Watermark" description="Stamp text or an image over the pages of a PDF." />
      {pdf ? (
        <SourceBar pdf={pdf} onClear={() => { source.clear(); tool.reset(); }} />
      ) : (
        <FilePicker accept="application/pdf" label="Choose a PDF" onFiles={(files) => void source.choose(files)} libraryAccepts={(mime) => mime === "application/pdf"} />
      )}
      <ToolError message={source.loadError ?? tool.error} />
      {pdf ? (
        <>
          <Tabs value={kind} onValueChange={(value) => { setKind(value as "text" | "image"); tool.reset(); }}>
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="image">Image</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="pt-4">
              <OptionsPanel>
                <TextField label="Text" testId="watermark-text" placeholder="Confidential" value={text} onChange={(e) => setText(e.target.value)} />
                <TextField label="Font size" testId="font-size-input" type="number" min={6} max={200} value={fontSize} onChange={(e) => setFontSize(e.target.value)} suffix="pt" className="max-w-40" />
                <Choice
                  label="Colour"
                  value={colour}
                  onChange={setColour}
                  options={(Object.keys(WATERMARK_COLOURS) as WatermarkColour[]).map((value) => ({ value, label: COLOUR_NAMES[value] }))}
                />
              </OptionsPanel>
            </TabsContent>
            <TabsContent value="image" className="pt-4">
              <OptionsPanel>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Image</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" render={<label />}>
                      {image ? "Change image" : "Choose image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        hidden
                        data-testid="watermark-image-input"
                        onChange={(event) => {
                          const files = [...(event.target.files ?? [])];
                          event.target.value = "";
                          void pickImage(files);
                        }}
                      />
                    </Button>
                    {image ? <span className="truncate text-sm text-muted-foreground">{image.name}</span> : null}
                  </div>
                </div>
                <TextField label="Size" testId="scale-input" type="number" min={5} max={100} value={scale} onChange={(e) => setScale(e.target.value)} suffix="% of page width" className="max-w-56" />
              </OptionsPanel>
            </TabsContent>
          </Tabs>
          <OptionsPanel>
            <Choice
              label="Position"
              value={position}
              onChange={setPosition}
              className="grid w-fit grid-cols-3"
              options={[
                ...CELLS.map((name, index) => ({ value: String(index), name, label: <span className="size-2 rounded-full bg-current" aria-hidden /> })),
                { value: "tile", name: "Tiled", label: <><Grid3x3 aria-hidden /> Tiled</> },
              ]}
            />
            <div className="space-y-5">
              <Choice label="Rotation" value={rotation} onChange={setRotation} options={(["0", "45", "90", "270"] as const).map((value) => ({ value, label: `${value}°` }))} />
              <Choice label="Layer" value={layer} onChange={setLayer} options={[{ value: "front", label: "In front" }, { value: "behind", label: "Behind" }]} />
            </div>
            <TextField label="Opacity" testId="opacity-input" type="number" min={0} max={100} value={opacity} onChange={(e) => setOpacity(e.target.value)} suffix="%" className="max-w-40" />
            <TextField label="Pages" testId="pages-input" placeholder={`All, or a range such as 1-${pdf.pageCount}`} value={pages} onChange={(e) => setPages(e.target.value)} />
          </OptionsPanel>
          <div className="flex justify-end">
            <Button data-testid="run-tool" pending={tool.busy} onClick={apply}>
              Add watermark
            </Button>
          </div>
        </>
      ) : null}
      <ResultList results={tool.results} />
    </AppPage>
  );
}
