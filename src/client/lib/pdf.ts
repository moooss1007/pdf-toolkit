// The document work, done in the browser with pdf-lib.
import {
  EncryptedPDFError,
  PDFArray,
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { pageNumberLabel } from "@/lib/ranges";

export class ToolInputError extends Error {}

export type ImageKind = "png" | "jpg";

/** What a file's first bytes say it is. */
export function sniffKind(bytes: Uint8Array): "pdf" | ImageKind | null {
  const [a, b, c, d] = bytes;
  if (a === 0x25 && b === 0x50 && c === 0x44 && d === 0x46) return "pdf";
  if (a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47) return "png";
  if (a === 0xff && b === 0xd8 && c === 0xff) return "jpg";
  return null;
}

/** Opens a PDF, refusing password-protected and unreadable ones by name. */
export async function openPdf(name: string, bytes: Uint8Array): Promise<PDFDocument> {
  if (sniffKind(bytes) !== "pdf") throw new ToolInputError(`${name} isn't a PDF.`);
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof EncryptedPDFError)
      throw new ToolInputError(`${name} is password-protected and can't be opened.`);
    throw new ToolInputError(`${name} can't be read as a PDF.`);
  }
}

async function embedImage(doc: PDFDocument, kind: ImageKind, bytes: Uint8Array, name: string): Promise<PDFImage> {
  try {
    return kind === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    throw new ToolInputError(`${name} can't be read as an image.`);
  }
}

export interface InputFile {
  name: string;
  bytes: Uint8Array;
}

/** PDFs and images, in order, as one PDF. Each image is one page its own size. */
export async function mergeFiles(files: InputFile[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const file of files) {
    const kind = sniffKind(file.bytes);
    if (kind === "pdf") {
      const source = await openPdf(file.name, file.bytes);
      const pages = await out.copyPages(source, source.getPageIndices());
      for (const page of pages) out.addPage(page);
    } else if (kind) {
      const image = await embedImage(out, kind, file.bytes, file.name);
      const page = out.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    } else {
      throw new ToolInputError(`${file.name} isn't a PDF, JPG or PNG.`);
    }
  }
  return out.save();
}

/** A new PDF holding the given 1-based pages of the source, in order. */
export async function extractPages(source: PDFDocument, pages: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, pages.map((p) => p - 1));
  for (const page of copied) out.addPage(page);
  return out.save();
}

export type LayoutItem =
  | { kind: "page"; source: number; index: number; rotation: number }
  | { kind: "blank"; width: number; height: number };

/** Builds the organized document from its sources and the visible layout. */
export async function buildLayout(sources: PDFDocument[], layout: LayoutItem[]): Promise<Uint8Array> {
  if (layout.length === 0) throw new ToolInputError("Keep at least one page.");
  const out = await PDFDocument.create();
  for (const item of layout) {
    if (item.kind === "blank") {
      out.addPage([item.width, item.height]);
      continue;
    }
    const [page] = await out.copyPages(sources[item.source]!, [item.index]);
    const added = out.addPage(page!);
    const angle = (added.getRotation().angle + item.rotation) % 360;
    added.setRotation(degrees(angle));
  }
  return out.save();
}

export type Vertical = "top" | "bottom";
export type Horizontal = "left" | "center" | "right";

export interface NumberOptions {
  vertical: Vertical;
  horizontal: Horizontal;
  withTotal: boolean;
  first: number;
  fontSize: number;
  pages: Set<number>;
  skipFirst: boolean;
}

const EDGE = 28;

export async function addPageNumbers(doc: PDFDocument, options: NumberOptions): Promise<Uint8Array> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const numbered = pages
    .map((page, index) => ({ page, number: index + 1 }))
    .filter(({ number }) => options.pages.has(number) && !(options.skipFirst && number === 1));
  numbered.forEach(({ page }, position) => {
    const label = pageNumberLabel(position, numbered.length, options.first, options.withTotal);
    const width = font.widthOfTextAtSize(label, options.fontSize);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const x =
      options.horizontal === "left"
        ? EDGE
        : options.horizontal === "right"
          ? pageWidth - EDGE - width
          : (pageWidth - width) / 2;
    const y = options.vertical === "top" ? pageHeight - EDGE - options.fontSize : EDGE;
    page.drawText(label, { x, y, size: options.fontSize, font, color: rgb(0, 0, 0) });
  });
  return doc.save();
}

export const WATERMARK_COLOURS = {
  black: [0, 0, 0],
  grey: [0.5, 0.5, 0.5],
  red: [0.8, 0.1, 0.1],
  blue: [0.1, 0.25, 0.75],
  green: [0.1, 0.55, 0.25],
} as const;
export type WatermarkColour = keyof typeof WATERMARK_COLOURS;

export interface WatermarkOptions {
  mark:
    | { kind: "text"; text: string; fontSize: number; colour: WatermarkColour }
    | { kind: "image"; bytes: Uint8Array; imageKind: ImageKind; name: string; scale: number };
  /** 0-8 for a cell of the 3x3 grid, read across from the top left, or "tile". */
  position: number | "tile";
  opacity: number;
  rotation: 0 | 45 | 90 | 270;
  pages: Set<number>;
  behind: boolean;
}

const MARGIN = 36;

export async function addWatermark(doc: PDFDocument, options: WatermarkOptions): Promise<Uint8Array> {
  const { mark } = options;
  const font = mark.kind === "text" ? await doc.embedFont(StandardFonts.HelveticaBold) : null;
  const image = mark.kind === "image" ? await embedImage(doc, mark.imageKind, mark.bytes, mark.name) : null;
  const theta = (options.rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  doc.getPages().forEach((page, index) => {
    if (!options.pages.has(index + 1)) return;
    const { width: W, height: H } = page.getSize();
    let w: number;
    let h: number;
    if (mark.kind === "text") {
      w = font!.widthOfTextAtSize(mark.text, mark.fontSize);
      h = mark.fontSize * 0.7;
    } else {
      // Scale is a share of the page width.
      w = (W * mark.scale) / 100;
      h = (w * image!.height) / image!.width;
    }
    const boxW = Math.abs(w * cos) + Math.abs(h * sin);
    const boxH = Math.abs(w * sin) + Math.abs(h * cos);
    const centres: [number, number][] = [];
    if (options.position === "tile") {
      const stepX = boxW + 72;
      const stepY = boxH + 72;
      for (let y = stepY / 2; y < H + stepY / 2; y += stepY)
        for (let x = stepX / 2; x < W + stepX / 2; x += stepX) centres.push([x, y]);
    } else {
      const col = options.position % 3;
      const row = Math.floor(options.position / 3);
      const cx = col === 0 ? MARGIN + boxW / 2 : col === 1 ? W / 2 : W - MARGIN - boxW / 2;
      const cy = row === 0 ? H - MARGIN - boxH / 2 : row === 1 ? H / 2 : MARGIN + boxH / 2;
      centres.push([cx, cy]);
    }
    for (const [cx, cy] of centres) {
      const x = cx - ((w / 2) * cos - (h / 2) * sin);
      const y = cy - ((w / 2) * sin + (h / 2) * cos);
      const common = { x, y, rotate: degrees(options.rotation), opacity: options.opacity / 100 };
      if (mark.kind === "text") {
        const [r, g, b] = WATERMARK_COLOURS[mark.colour];
        page.drawText(mark.text, { ...common, size: mark.fontSize, font: font!, color: rgb(r, g, b) });
      } else {
        page.drawImage(image!, { ...common, width: w, height: h });
      }
    }
    if (options.behind) sendLastStreamBack(page);
  });
  return doc.save();
}

/** Moves the stream just drawn to the front, so the page's own content paints over it. */
function sendLastStreamBack(page: PDFPage) {
  const contents = page.node.Contents();
  if (!(contents instanceof PDFArray) || contents.size() < 2) return;
  const last = contents.get(contents.size() - 1);
  contents.remove(contents.size() - 1);
  contents.insert(0, last);
}

export interface ImagesOptions {
  orientation: "portrait" | "landscape";
  margin: "none" | "small" | "large";
  pageSize: "fit" | "a4";
}

const MARGINS = { none: 0, small: 20, large: 50 } as const;
const A4: [number, number] = [595.28, 841.89];

/** One page per image, centred and scaled to fit inside the margins. */
export async function imagesToPdf(files: InputFile[], options: ImagesOptions): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const margin = MARGINS[options.margin];
  for (const file of files) {
    const kind = sniffKind(file.bytes);
    if (kind !== "png" && kind !== "jpg") throw new ToolInputError(`${file.name} isn't a JPG or PNG.`);
    const image = await embedImage(out, kind, file.bytes, file.name);
    let pageW: number;
    let pageH: number;
    if (options.pageSize === "a4") {
      [pageW, pageH] = options.orientation === "portrait" ? A4 : [A4[1], A4[0]];
    } else {
      pageW = image.width + 2 * margin;
      pageH = image.height + 2 * margin;
    }
    const page = out.addPage([pageW, pageH]);
    const scale = Math.min((pageW - 2 * margin) / image.width, (pageH - 2 * margin) / image.height, options.pageSize === "fit" ? 1 : Infinity);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }
  return out.save();
}
