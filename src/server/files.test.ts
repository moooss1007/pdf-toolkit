import { describe, expect, it } from "vitest";
import { attachment, cleanName, sniffMime } from "./files";
import { RETENTION_MS, isToolId } from "@/lib/constants";

describe("stored files", () => {
  it("keeps only PDF, JPG and ZIP", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF"))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x50, 0x4b, 3, 4]))).toBe("application/zip");
    expect(sniffMime(new TextEncoder().encode("<htm"))).toBeNull();
  });
  it("strips paths from names", () => {
    expect(cleanName("../../evil.pdf")).toBe("evil.pdf");
    expect(cleanName("C:\\x\\a\"b.pdf")).toBe("ab.pdf");
    expect(cleanName("...")).toBe("file");
  });
  it("encodes the download name", () => {
    expect(attachment("año.pdf")).toContain("filename*=UTF-8''a%C3%B1o.pdf");
  });
  it("keeps results for two hours, from known tools", () => {
    expect(RETENTION_MS).toBe(7_200_000);
    expect(isToolId("merge")).toBe(true);
    expect(isToolId("compress")).toBe(false);
  });
});
