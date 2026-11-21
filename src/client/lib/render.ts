// Page pictures, drawn in the browser with pdf.js.
import type { PDFDocumentProxy } from "pdfjs-dist";

let loading: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjs() {
  loading ??= (async () => {
    const [lib, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return loading;
}

export type RenderDoc = PDFDocumentProxy;

export async function openForRender(bytes: Uint8Array): Promise<RenderDoc> {
  const lib = await pdfjs();
  // pdf.js takes ownership of the buffer it is given, so it gets a copy.
  return lib.getDocument({ data: bytes.slice() }).promise;
}

/** Page `pageNumber` (1-based) as a JPEG, `scale` times its size in points. */
export async function renderJpeg(doc: RenderDoc, pageNumber: number, scale: number, quality = 0.9): Promise<Blob> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d")!;
  // JPEG has no transparency: start from a white sheet.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The page couldn't be drawn."))), "image/jpeg", quality),
  );
}

/** A small picture of a page, about `width` pixels wide, as an object URL. */
export async function thumbnail(doc: RenderDoc, pageNumber: number, width = 180): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const blob = await renderJpeg(doc, pageNumber, (width * (window.devicePixelRatio || 1)) / base.width, 0.75);
  return URL.createObjectURL(blob);
}
