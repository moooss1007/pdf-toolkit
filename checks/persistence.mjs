// Saved results and their files survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { listResults, makePdf, upload } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const bytes = await makePdf(3);
  const created = await upload(runtime, "owner", { name: "lease-agreement.pdf", bytes, tool: "organize" });
  expect(created.status).toBe(201);
  const { result } = await created.json();

  await runtime.restart();

  const listed = (await listResults(runtime, "owner")).find((r) => r.id === result.id);
  expect(listed).toMatchObject({ name: "lease-agreement.pdf", tool: "organize", size: bytes.length });
  const file = await runtime.fetch(`/api/results/${result.id}`, { role: "owner" });
  expect(file.status).toBe(200);
  expect(Buffer.from(await file.arrayBuffer()).equals(bytes)).toBe(true);

  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/library");
  await expect(page.getByTestId("result-name").filter({ hasText: "lease-agreement.pdf" })).toBeVisible({ timeout: 20_000 });
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
