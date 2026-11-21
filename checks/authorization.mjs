// Who may reach what: private pages and routes, per-member results, admin-only actions.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { listResults, makePdf, upload } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/library", "/merge", "/split", "/organize", "/page-numbers", "/watermark", "/images-to-pdf", "/pdf-to-jpg", "/api/results", "/health"]);

  const bytes = await makePdf(2);
  const mine = await (await upload(runtime, "member", { name: "payslip-october.pdf", bytes, tool: "merge" })).json();
  const id = mine.result.id;
  const path = `/api/results/${id}`;

  // Anonymous callers and outsiders get nothing.
  for (const role of [undefined, "outsider"]) {
    const read = await runtime.fetch(path, { role });
    expect(read.status, `GET as ${role}`).not.toBe(200);
    expect(Buffer.from(await read.arrayBuffer()).includes(Buffer.from("%PDF"))).toBe(false);
    expect((await runtime.fetch(path, { role, method: "DELETE" })).status).not.toBe(200);
    expect((await upload(runtime, role, { name: "x.pdf", bytes })).status).not.toBe(201);
    expect((await runtime.fetch("/api/admin/storage", { role })).status).not.toBe(200);
    expect((await runtime.fetch("/api/admin/purge", { role, method: "POST" })).status).not.toBe(200);
  }

  // Another member, the admin included, can't list, read or delete it.
  expect((await listResults(runtime, "owner")).map((r) => r.id)).not.toContain(id);
  const peek = await runtime.fetch(path, { role: "owner" });
  expect(peek.status).toBe(404);
  expect((await runtime.fetch(path, { role: "owner", method: "DELETE" })).status).toBe(404);
  expect((await runtime.fetch(path, { role: "member" })).status).toBe(200);
  expect((await listResults(runtime, "member")).map((r) => r.id)).toContain(id);

  // Owners' files stay theirs too.
  const ownerFile = await (await upload(runtime, "owner", { name: "salary-review.pdf", bytes, tool: "split" })).json();
  expect((await runtime.fetch(`/api/results/${ownerFile.result.id}`, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(`/api/results/${ownerFile.result.id}`, { role: "member", method: "DELETE" })).status).toBe(404);
  expect((await runtime.fetch(`/api/results/${ownerFile.result.id}`, { role: "owner" })).status).toBe(200);

  // A client can't choose the storage key or the owner.
  const form = new FormData();
  form.set("tool", "merge");
  form.set("ownerId", "someone-else");
  form.set("key", `owner/x/${id}`);
  form.set("file", new Blob([bytes], { type: "application/pdf" }), "../../evil.pdf");
  const forged = await runtime.fetch("/api/results", { role: "outsider", method: "POST", body: form });
  expect(forged.status).not.toBe(201);
  const sneaky = await (await runtime.fetch("/api/results", { role: "owner", method: "POST", body: form })).json();
  expect(sneaky.result.name).not.toContain("/");
  expect((await runtime.fetch(path, { role: "member" })).status).toBe(200);

  // Admin-only: the storage summary and purge refuse non-admins.
  expect((await runtime.fetch("/api/admin/storage", { role: "member" })).status).toBe(403);
  expect((await runtime.fetch("/api/admin/purge", { role: "member", method: "POST" })).status).toBe(403);
  const summary = await runtime.fetch("/api/admin/storage", { role: "owner" });
  expect(summary.status).toBe(200);
  const body = await summary.text();
  expect(body).not.toContain("payslip-october.pdf");
  expect(JSON.parse(body).total.count).toBeGreaterThanOrEqual(3);
  expect((await runtime.fetch("/api/admin/purge", { role: "owner", method: "POST" })).status).toBe(200);

  // The admin page shows nothing to a member.
  const memberContext = await runtime.context("member");
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/admin");
  await expect(memberPage.getByTestId("admin-forbidden")).toBeVisible({ timeout: 20_000 });
  await expect(memberPage.getByTestId("admin-member-row")).toHaveCount(0);
  // A member's library lists only their own files.
  await memberPage.goto("/library");
  await expect(memberPage.getByTestId("library-row").first()).toBeVisible({ timeout: 20_000 });
  await expect(memberPage.getByText("salary-review.pdf")).toHaveCount(0);
  await memberContext.close();

  // No sign-in of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/logout", "/auth/login"]) {
    const response = await runtime.fetch(path, { role: "member" });
    const text = await response.text();
    expect(text).not.toMatch(/type=["']?password/i);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.status, path).toBe(404);
  }
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
