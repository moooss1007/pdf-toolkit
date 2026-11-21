/** The stored type for a file's first bytes, or null when it isn't one the tools make. */
export function sniffMime(head: Uint8Array): string | null {
  const [a, b, c, d] = head;
  if (a === 0x25 && b === 0x50 && c === 0x44 && d === 0x46) return "application/pdf";
  if (a === 0xff && b === 0xd8 && c === 0xff) return "image/jpeg";
  if (a === 0x50 && b === 0x4b && c === 0x03 && d === 0x04) return "application/zip";
  return null;
}

/** A file name with no path, control or quote characters, at most 150 characters. */
export function cleanName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .trim()
    .replace(/^\.+/, "");
  return (cleaned || "file").slice(-150);
}

/** A Content-Disposition header that keeps non-ASCII names. */
export function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
