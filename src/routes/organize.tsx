import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FilePlus2, RotateCw, Trash2, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { PageHeader } from "@/client/components/PageHeader";
import { FilePicker } from "@/client/components/tool/FilePicker";
import { move } from "@/client/components/tool/FileList";
import { PageThumb } from "@/client/components/tool/PageThumb";
import { ResultList, ToolError } from "@/client/components/tool/Results";
import { SourceBar } from "@/client/components/tool/SourceBar";
import { loadPdf, useRenderDoc, useSinglePdf, type LoadedPdf } from "@/client/components/tool/usePdf";
import { messageOf, useTool } from "@/client/components/tool/useTool";
import { Button } from "@/client/components/ui/button";
import { buildLayout, type LayoutItem } from "@/client/lib/pdf";
import { openForRender, type RenderDoc } from "@/client/lib/render";
import { baseName } from "@/lib/ranges";

export const Route = createFileRoute("/organize")({
  ssr: false,
  head: () => ({ meta: [{ title: "Organize pages" }] }),
  component: Organize,
});

interface Tile {
  id: string;
  /** Index into the sources, or -1 for a blank page. */
  source: number;
  index: number;
  label: string;
  rotation: number;
  removed: boolean;
  width: number;
  height: number;
}

function tilesOf(pdf: LoadedPdf, source: number, firstNumber: number): Tile[] {
  return pdf.doc.getPages().map((page, index) => ({
    id: crypto.randomUUID(),
    source,
    index,
    label: `Page ${firstNumber + index}`,
    rotation: 0,
    removed: false,
    width: page.getWidth(),
    height: page.getHeight(),
  }));
}

function Organize() {
  const tool = useTool("organize");
  const [extras, setExtras] = useState<LoadedPdf[]>([]);
  const [extraDocs, setExtraDocs] = useState<Record<number, RenderDoc>>({});
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [dragging, setDragging] = useState<number | null>(null);
  const appendInput = useRef<HTMLInputElement>(null);
  const source = useSinglePdf(() => tool.reset());
  const { pdf } = source;
  const mainDoc = useRenderDoc(pdf?.bytes ?? null);
  const sources = pdf ? [pdf, ...extras] : [];
  const pageTotal = sources.reduce((sum, s) => sum + s.pageCount, 0);

  async function open(files: File[]) {
    setExtras([]);
    setExtraDocs({});
    setTiles([]);
    await source.choose(files);
  }
  // A new source document gets its pages when it loads.
  const [loadedFor, setLoadedFor] = useState<LoadedPdf | null>(null);
  if (pdf && loadedFor !== pdf) {
    setLoadedFor(pdf);
    setTiles(tilesOf(pdf, 0, 1));
  }

  async function append(files: File[]) {
    const file = files[0];
    if (!file || !pdf) return;
    tool.reset();
    try {
      const extra = await loadPdf(file);
      const sourceIndex = extras.length + 1;
      setExtras((current) => [...current, extra]);
      setTiles((current) => [...current, ...tilesOf(extra, sourceIndex, pageTotal + 1)]);
      openForRender(extra.bytes)
        .then((doc) => setExtraDocs((current) => ({ ...current, [sourceIndex]: doc })))
        .catch(() => {});
    } catch (error) {
      tool.fail(messageOf(error));
    }
  }

  function update(id: string, change: (tile: Tile) => Partial<Tile>) {
    tool.reset();
    setTiles((current) => current.map((tile) => (tile.id === id ? { ...tile, ...change(tile) } : tile)));
  }

  function insertBlankAfter(position: number) {
    tool.reset();
    setTiles((current) => {
      const after = current[position]!;
      const blank: Tile = { id: crypto.randomUUID(), source: -1, index: 0, label: "Blank page", rotation: 0, removed: false, width: after.width, height: after.height };
      return [...current.slice(0, position + 1), blank, ...current.slice(position + 1)];
    });
  }

  function save() {
    if (!pdf) return;
    const kept = tiles.filter((tile) => !tile.removed);
    if (kept.length === 0) return tool.fail("Every page is marked for removal. Keep at least one.");
    const layout: LayoutItem[] = kept.map((tile) =>
      tile.source === -1
        ? { kind: "blank", width: tile.width, height: tile.height }
        : { kind: "page", source: tile.source, index: tile.index, rotation: tile.rotation },
    );
    void tool.run(async () => [
      { name: `${baseName(pdf.name)}-organized.pdf`, type: "application/pdf", bytes: await buildLayout(sources.map((s) => s.doc), layout) },
    ]);
  }

  const kept = tiles.filter((tile) => !tile.removed).length;

  return (
    <AppPage>
      <PageHeader title="Organize pages" description="Reorder, rotate, remove and add pages, then save a new PDF." />
      {pdf ? (
        <SourceBar pdf={{ ...pdf, pageCount: kept }} onClear={() => { source.clear(); setTiles([]); setExtras([]); tool.reset(); }} />
      ) : (
        <FilePicker accept="application/pdf" label="Choose a PDF" onFiles={(files) => void open(files)} libraryAccepts={(mime) => mime === "application/pdf"} />
      )}
      <ToolError message={source.loadError ?? tool.error} />
      {pdf ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tiles.map((tile, position) => (
              <TileCard
                key={tile.id}
                tile={tile}
                doc={tile.source === 0 ? mainDoc : (extraDocs[tile.source] ?? null)}
                first={position === 0}
                last={position === tiles.length - 1}
                dragging={dragging === position}
                onDragStart={() => setDragging(position)}
                onDragEnd={() => setDragging(null)}
                onDrop={() => {
                  if (dragging !== null && dragging !== position) {
                    tool.reset();
                    setTiles((current) => move(current, dragging, position));
                  }
                  setDragging(null);
                }}
                onMove={(delta) => {
                  tool.reset();
                  setTiles((current) => move(current, position, position + delta));
                }}
                onRotate={() => update(tile.id, (t) => ({ rotation: (t.rotation + 90) % 360 }))}
                onToggleRemoved={() => update(tile.id, (t) => ({ removed: !t.removed }))}
                onInsertBlank={() => insertBlankAfter(position)}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={() => appendInput.current?.click()}>
              <FilePlus2 />
              Add pages from another PDF
            </Button>
            <input
              ref={appendInput}
              type="file"
              accept="application/pdf"
              hidden
              data-testid="append-input"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                void append(files);
              }}
            />
            <Button data-testid="run-tool" pending={tool.busy} onClick={save}>
              Save PDF
            </Button>
          </div>
        </>
      ) : null}
      <ResultList results={tool.results} />
    </AppPage>
  );
}

function TileCard({
  tile,
  doc,
  first,
  last,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onRotate,
  onToggleRemoved,
  onInsertBlank,
}: {
  tile: Tile;
  doc: RenderDoc | null;
  first: boolean;
  last: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (delta: number) => void;
  onRotate: () => void;
  onToggleRemoved: () => void;
  onInsertBlank: () => void;
}) {
  const name = tile.label.toLowerCase();
  return (
    <PageThumb
      doc={doc}
      pageNumber={tile.index + 1}
      label={tile.rotation ? `${tile.label} · ${tile.rotation}°` : tile.label}
      rotation={tile.rotation}
      dimmed={tile.removed}
      blank={tile.source === -1}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={dragging ? "opacity-50" : undefined}
    >
      <div className="flex flex-wrap justify-center gap-0.5">
        <Button variant="ghost" size="icon-sm" aria-label={`Move ${name} earlier`} disabled={first} onClick={() => onMove(-1)}>
          <ArrowLeft />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Rotate ${name}`} disabled={tile.removed} onClick={onRotate}>
          <RotateCw />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Insert blank page after ${name}`} onClick={onInsertBlank}>
          <FilePlus2 />
        </Button>
        {tile.removed ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Restore ${name}`} onClick={onToggleRemoved}>
            <Undo2 />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} className="hover:text-destructive" onClick={onToggleRemoved}>
            <Trash2 />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={`Move ${name} later`} disabled={last} onClick={() => onMove(1)}>
          <ArrowRight />
        </Button>
      </div>
    </PageThumb>
  );
}
