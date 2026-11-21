// Shared fixtures and readers for the release checks.
import { deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { unzipSync } from "fflate";

/** A PDF whose page i (1-based) is base + 10*i points wide and says "Line i". */
export async function makePdf(pages, label = "Line", base = 400) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([base + 10 * i, 600]);
    page.drawText(`${label} ${i}`, { x: 60, y: 300, size: 24, font });
  }
  return Buffer.from(await doc.save());
}

/** A PDF whose trailer names an /Encrypt dictionary. */
export async function makeEncryptedPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  doc.context.trailerInfo.Encrypt = doc.context.register(
    doc.context.obj({ Filter: "Standard", V: 1, R: 2, O: "x", U: "y", P: -4 }),
  );
  return Buffer.from(await doc.save());
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** A solid RGB PNG of the given size. */
export function makePng(width, height, [r, g, b] = [40, 120, 200]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const pdfFile = (name, buffer) => ({ name, mimeType: "application/pdf", buffer });
export const pngFile = (name, buffer) => ({ name, mimeType: "image/png", buffer });

export async function loadPdf(buffer) {
  return PDFDocument.load(buffer);
}
export function widths(doc) {
  return doc.getPages().map((page) => Math.round(page.getWidth()));
}

/** The text items of each page, in content-stream order, with their y position. */
export async function pdfText(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push({
      height: page.view[3],
      items: content.items.filter((item) => item.str?.trim()).map((item) => ({ str: item.str, y: item.transform[5], x: item.transform[4] })),
    });
  }
  return pages;
}

/** Width and height from a JPEG's SOF marker. */
export function jpegSize(buffer) {
  const bytes = Buffer.from(buffer);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("not a JPEG");
  let offset = 2;
  while (offset < bytes.length) {
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("no SOF marker");
}

export function unzip(buffer) {
  return unzipSync(new Uint8Array(buffer));
}

/** Uploads a result through the API as `role`. */
export async function upload(runtime, role, { name, type = "application/pdf", bytes, tool = "merge" }) {
  const form = new FormData();
  form.set("tool", tool);
  form.set("file", new Blob([bytes], { type }), name);
  return runtime.fetch("/api/results", { role, method: "POST", body: form });
}

export async function listResults(runtime, role) {
  const response = await runtime.fetch("/api/results", { role });
  if (response.status !== 200) throw new Error(`list as ${role}: ${response.status}`);
  return (await response.json()).results;
}

/** The ids behind the download links shown in the tool's result list. */
export async function shownResults(page) {
  const links = page.getByTestId("download-result");
  const count = await links.count();
  const out = [];
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute("href");
    out.push({ href, name: (await links.nth(i).getAttribute("download")) ?? "" });
  }
  return out;
}

export async function download(runtime, href, role = "owner") {
  const response = await runtime.fetch(href, { role });
  if (response.status !== 200) throw new Error(`download ${href}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Picks one option of a labelled choice group. */
export async function choose(page, group, option) {
  await page.getByRole("group", { name: group }).getByRole("button", { name: option, exact: true }).click();
}
