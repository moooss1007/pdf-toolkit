import { useEffect, useState } from "react";
import type { PDFDocument } from "pdf-lib";
import { openPdf } from "@/client/lib/pdf";
import { openForRender, type RenderDoc } from "@/client/lib/render";
import { readFile } from "@/client/lib/save";
import { messageOf } from "@/client/components/tool/useTool";

export interface LoadedPdf {
  name: string;
  size: number;
  bytes: Uint8Array;
  doc: PDFDocument;
  pageCount: number;
}

/** Opens one PDF for a tool: pdf-lib for the work, and pdf.js for page pictures. */
export async function loadPdf(file: File): Promise<LoadedPdf> {
  const bytes = await readFile(file);
  const doc = await openPdf(file.name, bytes);
  return { name: file.name, size: file.size, bytes, doc, pageCount: doc.getPageCount() };
}

/** The pdf.js document for pictures; null until it opens, or if it can't. */
export function useRenderDoc(bytes: Uint8Array | null): RenderDoc | null {
  const [doc, setDoc] = useState<RenderDoc | null>(null);
  useEffect(() => {
    setDoc(null);
    if (!bytes) return;
    let cancelled = false;
    let opened: RenderDoc | null = null;
    openForRender(bytes)
      .then((d) => {
        opened = d;
        if (cancelled) void d.destroy();
        else setDoc(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [bytes]);
  return doc;
}

/** The single PDF a tool works on, with its error. */
export function useSinglePdf(onChange?: () => void) {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function choose(files: File[]) {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    setLoadError(null);
    onChange?.();
    try {
      setPdf(await loadPdf(file));
    } catch (error) {
      setPdf(null);
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }
  return { pdf, loadError, loading, choose, clear: () => setPdf(null) };
}
