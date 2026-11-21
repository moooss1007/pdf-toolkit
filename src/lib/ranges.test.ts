import { describe, expect, it } from "vitest";
import {
  fixedRanges,
  pageNumberLabel,
  parsePageSet,
  parseRanges,
  rangeFileName,
} from "./ranges";

describe("parseRanges", () => {
  it("reads pages and runs", () => {
    expect(parseRanges("1-3, 5, 8-10", 10)).toEqual({
      ok: true,
      ranges: [
        { from: 1, to: 3 },
        { from: 5, to: 5 },
        { from: 8, to: 10 },
      ],
    });
  });
  it("refuses pages past the end, zero, backwards and junk", () => {
    expect(parseRanges("1-2, 9", 5)).toMatchObject({ ok: false, error: expect.stringContaining("9") });
    expect(parseRanges("0", 5).ok).toBe(false);
    expect(parseRanges("4-2", 5).ok).toBe(false);
    expect(parseRanges("2-x", 5).ok).toBe(false);
    expect(parseRanges(" , ", 5).ok).toBe(false);
  });
});

describe("parsePageSet", () => {
  it("is every page when empty", () => {
    expect(parsePageSet("", 3)).toEqual({ ok: true, pages: new Set([1, 2, 3]) });
  });
  it("unions the ranges", () => {
    expect(parsePageSet("2-3, 3", 4)).toEqual({ ok: true, pages: new Set([2, 3]) });
  });
});

describe("helpers", () => {
  it("cuts fixed-size groups", () => {
    expect(fixedRanges(5, 2)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 4 },
      { from: 5, to: 5 },
    ]);
  });
  it("names outputs after the source and pages", () => {
    expect(rangeFileName("report.pdf", { from: 1, to: 3 })).toBe("report-pages-1-3.pdf");
    expect(rangeFileName("report.pdf", { from: 4, to: 4 })).toBe("report-page-4.pdf");
  });
  it("labels numbered pages", () => {
    expect(pageNumberLabel(0, 3, 1, true)).toBe("1 of 3");
    expect(pageNumberLabel(2, 3, 5, false)).toBe("7");
  });
});
