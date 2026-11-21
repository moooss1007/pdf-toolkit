/** A run of pages, 1-based and inclusive. */
export interface PageRange {
  from: number;
  to: number;
}

export type RangesResult =
  | { ok: true; ranges: PageRange[] }
  | { ok: false; error: string };

/**
 * Reads "1-3, 5, 8-10" against a document of `pageCount` pages. Each part is
 * one range; a part that isn't a page or a run of pages, or that falls
 * outside the document, is an error naming it.
 */
export function parseRanges(text: string, pageCount: number): RangesResult {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "Enter at least one page or range, such as 1-3, 5." };
  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return { ok: false, error: `“${part}” isn't a page or a range such as 2-4.` };
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (from < 1 || to < 1) return { ok: false, error: `Pages start at 1, so “${part}” doesn't exist.` };
    if (from > to) return { ok: false, error: `“${part}” runs backwards. Write it as ${to}-${from}.` };
    if (to > pageCount)
      return {
        ok: false,
        error: `Page ${to} is past the end: the document has ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`,
      };
    ranges.push({ from, to });
  }
  return { ok: true, ranges };
}

export type PageSetResult =
  | { ok: true; pages: Set<number> }
  | { ok: false; error: string };

/** Which pages (1-based) an optional range text picks. Empty means all of them. */
export function parsePageSet(text: string, pageCount: number): PageSetResult {
  if (!text.trim())
    return { ok: true, pages: new Set(Array.from({ length: pageCount }, (_, i) => i + 1)) };
  const parsed = parseRanges(text, pageCount);
  if (!parsed.ok) return parsed;
  const pages = new Set<number>();
  for (const { from, to } of parsed.ranges) for (let p = from; p <= to; p++) pages.add(p);
  return { ok: true, pages };
}

/** Groups of `size` consecutive pages. */
export function fixedRanges(pageCount: number, size: number): PageRange[] {
  const ranges: PageRange[] = [];
  for (let from = 1; from <= pageCount; from += size)
    ranges.push({ from, to: Math.min(pageCount, from + size - 1) });
  return ranges;
}

/** "report.pdf" and pages 1-3 as "report-pages-1-3.pdf"; one page as "report-page-5.pdf". */
export function rangeFileName(source: string, range: PageRange): string {
  const base = baseName(source);
  return range.from === range.to
    ? `${base}-page-${range.from}.pdf`
    : `${base}-pages-${range.from}-${range.to}.pdf`;
}

/** The name without its extension. */
export function baseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base || "document";
}

/** The label a numbered page shows: the k-th numbered page gets first + k. */
export function pageNumberLabel(
  position: number,
  numberedCount: number,
  first: number,
  withTotal: boolean,
): string {
  const n = first + position;
  return withTotal ? `${n} of ${first + numberedCount - 1}` : String(n);
}
