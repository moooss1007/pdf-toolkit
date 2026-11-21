// The main path of every tool and the results library, in the browser and over HTTP.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import {
  choose, download, jpegSize, listResults, loadPdf, makeEncryptedPdf, makePdf, makePng,
  pdfFile, pdfText, pngFile, shownResults, unzip, upload, widths,
} from "./lib.mjs";

const runtime = await startRuntime();
const T = { timeout: 30_000 };
try {
  const report = await makePdf(5, "Line");
  const budget = await makePdf(2, "Line");
  const appendix = await makePdf(3, "Other", 500);
  const locked = await makeEncryptedPdf();
  const photo = makePng(200, 100);

  // ---- Server routes: upload, list, download, refuse a bad type.
  const uploaded = await upload(runtime, "owner", { name: "board-minutes.pdf", bytes: budget, tool: "merge" });
  expect(uploaded.status).toBe(201);
  const { result: saved } = await uploaded.json();
  expect(saved.name).toBe("board-minutes.pdf");
  expect(saved.tool).toBe("merge");
  expect(saved.size).toBe(budget.length);
  expect(saved.expiresAt - saved.createdAt).toBe(2 * 60 * 60 * 1000);
  expect((await listResults(runtime, "owner")).map((r) => r.id)).toContain(saved.id);
  const fetched = await runtime.fetch(`/api/results/${saved.id}`, { role: "owner" });
  expect(fetched.status).toBe(200);
  expect(fetched.headers.get("content-disposition")).toContain("board-minutes.pdf");
  expect(Buffer.from(await fetched.arrayBuffer()).equals(budget)).toBe(true);
  const badType = await upload(runtime, "owner", { name: "notes.txt", type: "text/plain", bytes: Buffer.from("hello"), tool: "merge" });
  expect(badType.status).toBe(400);
  const badTool = await upload(runtime, "owner", { name: "x.pdf", bytes: budget, tool: "compress" });
  expect(badTool.status).toBe(400);

  const context = await runtime.context("owner", { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // ---- F001 Merge
  await page.goto("/merge");
  await runtime.assertBackLink(page);
  const input = page.getByTestId("file-input");
  await input.setInputFiles([pdfFile("budget-2026.pdf", budget), pdfFile("appendix.pdf", appendix), pngFile("site-photo.png", photo), pdfFile("extra.pdf", budget)]);
  const items = page.getByTestId("file-item");
  await expect(items).toHaveCount(4, T);
  await page.getByRole("button", { name: "Move up site-photo.png" }).click();
  await page.getByRole("button", { name: "Move up site-photo.png" }).click();
  await page.getByRole("button", { name: "Remove extra.pdf" }).click();
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("site-photo.png");
  await expect(items.nth(1)).toContainText("budget-2026.pdf");
  await expect(items.nth(2)).toContainText("appendix.pdf");
  await input.setInputFiles([{ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("plain text") }]);
  await expect(page.getByTestId("tool-error")).toContainText("notes.txt", T);
  await input.setInputFiles([pdfFile("locked.pdf", locked)]);
  await expect(page.getByTestId("tool-error")).toContainText("locked.pdf", T);
  await input.setInputFiles(Array.from({ length: 23 }, (_, i) => pdfFile(`part-${i + 1}.pdf`, budget)));
  await expect(page.getByTestId("tool-error")).toContainText("25", T);
  await expect(items).toHaveCount(3);
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  const [merged] = await shownResults(page);
  expect(merged.name).toMatch(/\.pdf$/);
  expect(widths(await loadPdf(await download(runtime, merged.href)))).toEqual([200, 410, 420, 510, 520, 530]);

  // ---- F002 Split
  await page.goto("/split");
  await page.getByTestId("file-input").setInputFiles([pdfFile("quarterly-report.pdf", report)]);
  await expect(page.getByTestId("page-count")).toContainText("5 pages", T);
  await expect(page.getByTestId("page-thumb")).toHaveCount(5);
  await page.getByTestId("ranges-input").fill("1-2, 9");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-error")).toContainText("9", T);
  await page.getByTestId("ranges-input").fill("2-x");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-error")).toBeVisible();
  await page.getByTestId("ranges-input").fill("1-2, 4");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(2, T);
  let outs = await shownResults(page);
  expect(outs.map((o) => o.name)).toEqual(["quarterly-report-pages-1-2.pdf", "quarterly-report-page-4.pdf"]);
  expect(widths(await loadPdf(await download(runtime, outs[0].href)))).toEqual([410, 420]);
  expect(widths(await loadPdf(await download(runtime, outs[1].href)))).toEqual([440]);

  await page.getByRole("tab", { name: "Select pages" }).click();
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).click();
  await page.getByRole("checkbox", { name: "Page 3", exact: true }).click();
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(2, T);
  outs = await shownResults(page);
  expect(outs.map((o) => o.name)).toEqual(["quarterly-report-page-2.pdf", "quarterly-report-page-3.pdf"]);
  await page.getByTestId("combine-selected").click();
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  expect(widths(await loadPdf(await download(runtime, outs[0].href)))).toEqual([420, 430]);

  await page.getByRole("tab", { name: "Fixed size" }).click();
  await page.getByTestId("every-n-input").fill("2");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(3, T);
  outs = await shownResults(page);
  const chunks = [];
  for (const out of outs) chunks.push(widths(await loadPdf(await download(runtime, out.href))));
  expect(chunks).toEqual([[410, 420], [430, 440], [450]]);

  await page.goto("/split");
  await page.getByTestId("file-input").setInputFiles([pdfFile("locked.pdf", locked)]);
  await expect(page.getByTestId("tool-error")).toContainText("locked.pdf", T);

  // A tool can start from a library file.
  await page.getByRole("button", { name: "From library" }).click();
  await page.getByRole("dialog").getByRole("button", { name: merged.name }).first().click();
  await expect(page.getByTestId("page-count")).toContainText("6 pages", T);

  // ---- F003 Organize
  await page.goto("/organize");
  await page.getByTestId("file-input").setInputFiles([pdfFile("contract.pdf", await makePdf(3))]);
  await expect(page.getByTestId("page-thumb")).toHaveCount(3, T);
  await page.getByRole("button", { name: "Move page 3 earlier" }).click();
  await page.getByRole("button", { name: "Rotate page 1" }).click();
  await page.getByRole("button", { name: "Rotate page 1" }).click();
  await page.getByRole("button", { name: "Remove page 2" }).click();
  await expect(page.getByRole("button", { name: "Restore page 2" })).toBeVisible();
  await page.getByRole("button", { name: "Restore page 2" }).click();
  await page.getByRole("button", { name: "Remove page 2" }).click();
  await page.getByRole("button", { name: "Insert blank page after page 1" }).click();
  await page.getByTestId("append-input").setInputFiles([pdfFile("signatures.pdf", await makePdf(1, "Other", 500))]);
  await expect(page.getByTestId("page-thumb")).toHaveCount(5, T);
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  const organized = await loadPdf(await download(runtime, outs[0].href));
  expect(widths(organized)).toEqual([410, 410, 430, 510]);
  expect(organized.getPages().map((p) => p.getRotation().angle)).toEqual([180, 0, 0, 0]);

  await page.goto("/organize");
  await page.getByTestId("file-input").setInputFiles([pdfFile("memo.pdf", await makePdf(1))]);
  await page.getByRole("button", { name: "Remove page 1" }).click();
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-error")).toBeVisible(T);
  await expect(page.getByTestId("tool-result")).toHaveCount(0);

  // ---- F004 Page numbers
  await page.goto("/page-numbers");
  await page.getByTestId("file-input").setInputFiles([pdfFile("handbook.pdf", await makePdf(4))]);
  await choose(page, "Vertical position", "Top");
  await choose(page, "Horizontal position", "Right");
  await choose(page, "Format", "Number and total");
  await page.getByTestId("first-number-input").fill("1");
  await page.getByTestId("font-size-input").fill("14");
  await page.getByRole("checkbox", { name: "Skip the first page" }).click();
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  const numbered = await pdfText(await download(runtime, outs[0].href));
  expect(numbered[0].items.map((i) => i.str)).toEqual(["Line 1"]);
  for (const [index, label] of [[1, "1 of 3"], [2, "2 of 3"], [3, "3 of 3"]]) {
    const item = numbered[index].items.find((i) => i.str === label);
    expect(item, `page ${index + 1} shows ${label}`).toBeTruthy();
    expect(item.y).toBeGreaterThan(numbered[index].height / 2);
  }

  // ---- F005 Watermark
  await page.goto("/watermark");
  await page.getByTestId("file-input").setInputFiles([pdfFile("proposal.pdf", await makePdf(3))]);
  await page.getByTestId("watermark-text").fill("DRAFT COPY");
  await page.getByTestId("font-size-input").fill("40");
  await choose(page, "Colour", "Red");
  await choose(page, "Position", "Middle center");
  await choose(page, "Rotation", "45°");
  await page.getByTestId("opacity-input").fill("40");
  await page.getByTestId("pages-input").fill("2-3");
  await choose(page, "Layer", "Behind");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  let marked = await pdfText(await download(runtime, outs[0].href));
  expect(marked[0].items.map((i) => i.str)).toEqual(["Line 1"]);
  expect(marked[1].items.map((i) => i.str)).toEqual(["DRAFT COPY", "Line 2"]);
  expect(marked[2].items.map((i) => i.str)).toEqual(["DRAFT COPY", "Line 3"]);
  await page.getByTestId("pages-input").fill("");
  await choose(page, "Layer", "In front");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  marked = await pdfText(await download(runtime, outs[0].href));
  expect(marked[0].items.map((i) => i.str)).toEqual(["Line 1", "DRAFT COPY"]);
  await page.getByRole("tab", { name: "Image" }).click();
  await page.getByTestId("watermark-image-input").setInputFiles([pngFile("stamp.png", makePng(60, 40, [200, 30, 30]))]);
  await choose(page, "Position", "Tiled");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  const imageMarked = await download(runtime, outs[0].href);
  expect(imageMarked.toString("latin1")).toContain("/Image");
  expect((await loadPdf(imageMarked)).getPageCount()).toBe(3);

  // ---- F006 Images to PDF
  await page.goto("/images-to-pdf");
  const images = page.getByTestId("file-input");
  await images.setInputFiles([pngFile("floor-plan.png", makePng(300, 200)), pngFile("elevation.png", makePng(100, 300, [20, 160, 90]))]);
  await expect(page.getByTestId("file-item")).toHaveCount(2, T);
  await images.setInputFiles([{ name: "readme.txt", mimeType: "text/plain", buffer: Buffer.from("x") }]);
  await expect(page.getByTestId("tool-error")).toContainText("readme.txt", T);
  await page.getByRole("button", { name: "Move up elevation.png" }).click();
  await choose(page, "Page size", "A4");
  await choose(page, "Orientation", "Landscape");
  await choose(page, "Margin", "Large");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  expect(widths(await loadPdf(await download(runtime, outs[0].href)))).toEqual([842, 842]);
  await choose(page, "Page size", "Fit to image");
  await choose(page, "Margin", "None");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  expect(widths(await loadPdf(await download(runtime, outs[0].href)))).toEqual([100, 300]);

  // ---- F007 PDF to JPG
  await page.goto("/pdf-to-jpg");
  await page.getByTestId("file-input").setInputFiles([pdfFile("brochure.pdf", await makePdf(3))]);
  await expect(page.getByTestId("page-count")).toContainText("3 pages", T);
  await choose(page, "Quality", "High");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, { timeout: 60_000 });
  outs = await shownResults(page);
  expect(outs[0].name).toMatch(/\.zip$/);
  const zipped = unzip(await download(runtime, outs[0].href));
  const names = Object.keys(zipped).sort();
  expect(names).toEqual(["brochure-1.jpg", "brochure-2.jpg", "brochure-3.jpg"]);
  const high = jpegSize(zipped["brochure-1.jpg"]);
  await choose(page, "Pages", "Selected pages");
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).click();
  await choose(page, "Quality", "Normal");
  await page.getByTestId("run-tool").click();
  await expect(page.getByTestId("tool-result")).toHaveCount(1, T);
  outs = await shownResults(page);
  expect(outs[0].name).toBe("brochure-2.jpg");
  const normal = jpegSize(await download(runtime, outs[0].href));
  expect(high.width).toBeGreaterThan(normal.width * 1.5);

  // ---- F008 Library: expiry, the scheduled job, admin summary and purge.
  const db = await runtime.database();
  const stale = await (await upload(runtime, "owner", { name: "old-scan.pdf", bytes: budget, tool: "split" })).json();
  await db.prepare("UPDATE results SET expires_at = ? WHERE id = ?").bind(Date.now() - 1000, stale.result.id).run();
  expect((await listResults(runtime, "owner")).map((r) => r.id)).not.toContain(stale.result.id);
  expect((await runtime.fetch(`/api/results/${stale.result.id}`, { role: "owner" })).status).toBe(404);
  await runtime.scheduled("*/5 * * * *");
  expect((await db.prepare("SELECT count(*) AS n FROM results WHERE id = ?").bind(stale.result.id).first()).n).toBe(0);

  const stale2 = await (await upload(runtime, "member", { name: "draft.pdf", bytes: budget, tool: "merge" })).json();
  await db.prepare("UPDATE results SET expires_at = ? WHERE id = ?").bind(Date.now() - 1000, stale2.result.id).run();
  await page.goto("/admin");
  await expect(page.getByTestId("admin-member-row").first()).toBeVisible(T);
  await expect(page.getByTestId("admin-total")).toBeVisible();
  await page.getByRole("button", { name: "Purge expired" }).click();
  await expect(page.getByText("Removed 1 expired file")).toBeVisible(T);
  expect((await db.prepare("SELECT count(*) AS n FROM results WHERE id = ?").bind(stale2.result.id).first()).n).toBe(0);

  // Home shows recent results and the tools.
  await page.goto("/");
  await expect(page.getByTestId("recent-result").first()).toBeVisible(T);
  await expect(page.getByRole("link", { name: /Merge/ }).first()).toBeVisible();

  // The library: sortable, paginated, delete with confirmation.
  await page.goto("/library");
  const rows = page.getByTestId("library-row");
  await expect(rows.first()).toBeVisible(T);
  await expect(rows).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
  const target = await listResults(runtime, "owner").then((all) => all.find((r) => r.name === "board-minutes.pdf"));
  await page.getByRole("button", { name: "Sort by Name" }).click();
  await expect(rows.first().getByTestId("result-name")).toHaveText("board-minutes.pdf");
  await page.getByRole("button", { name: "Delete board-minutes.pdf" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Delete board-minutes.pdf" })).toHaveCount(0, T);
  await expect(rows.first().getByTestId("result-name")).not.toHaveText("board-minutes.pdf");
  expect((await runtime.fetch(`/api/results/${target.id}`, { role: "owner" })).status).toBe(404);
  await expect(rows.first()).toBeVisible();
  await runtime.screenshot(page);
  await context.close();

  // ---- Phone-sized smoke
  const phone = await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const small = await phone.newPage();
  await small.goto("/");
  await expect(small.getByRole("link", { name: /Split/ }).first()).toBeVisible(T);
  await small.goto("/merge");
  await expect(small.getByTestId("run-tool")).toBeVisible(T);
  const overflow = await small.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await phone.close();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
