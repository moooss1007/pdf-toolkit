import { and, asc, count, desc, eq, gt, lte, sql, sum } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { results, users } from "@/db/schema";
import { MAX_TOTAL_BYTES, RETENTION_MS, isToolId } from "@/lib/constants";
import { cleanName, sniffMime } from "@/server/files";

export interface Member {
  id: string;
  email: string;
}

export interface Result {
  id: string;
  name: string;
  tool: string;
  mime: string;
  size: number;
  createdAt: number;
  expiresAt: number;
}

const shown = {
  id: results.id,
  name: results.name,
  tool: results.tool,
  mime: results.mime,
  size: results.size,
  createdAt: results.createdAt,
  expiresAt: results.expiresAt,
};

export class ResultInputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** The member's row, created on first sight and kept in step with the Gateway's email. */
export async function ensureMember(member: Member): Promise<void> {
  await db
    .insert(users)
    .values({ id: member.id, email: member.email, createdAt: Date.now() })
    .onConflictDoUpdate({ target: users.id, set: { email: member.email } });
}

export async function saveResult(
  member: Member,
  input: { name: string; tool: unknown; file: Blob },
): Promise<Result> {
  if (!isToolId(input.tool)) throw new ResultInputError("Unknown tool");
  if (input.file.size === 0) throw new ResultInputError("The file is empty");
  if (input.file.size > MAX_TOTAL_BYTES)
    throw new ResultInputError("The file is larger than 100 MB", 413);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const mime = sniffMime(bytes.subarray(0, 4));
  if (!mime) throw new ResultInputError("Only PDF, JPG and ZIP files are kept");
  await ensureMember(member);
  const id = crypto.randomUUID();
  const r2Key = `owner/${member.id}/${id}`;
  const now = Date.now();
  const result: Result = {
    id,
    name: cleanName(input.name),
    tool: input.tool,
    mime,
    size: bytes.byteLength,
    createdAt: now,
    expiresAt: now + RETENTION_MS,
  };
  await env.files.put(r2Key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await db.insert(results).values({ ...result, ownerId: member.id, r2Key });
  } catch (error) {
    await env.files.delete(r2Key);
    throw error;
  }
  return result;
}

/** The member's results that haven't expired, newest first. */
export function listResults(ownerId: string, limit = 1000): Promise<Result[]> {
  return db
    .select(shown)
    .from(results)
    .where(and(eq(results.ownerId, ownerId), gt(results.expiresAt, Date.now())))
    .orderBy(desc(results.createdAt), asc(results.id))
    .limit(limit);
}

async function findOwned(ownerId: string, id: string) {
  const [row] = await db
    .select({ ...shown, r2Key: results.r2Key })
    .from(results)
    .where(
      and(
        eq(results.id, id),
        eq(results.ownerId, ownerId),
        gt(results.expiresAt, Date.now()),
      ),
    );
  return row ?? null;
}

/** The file and its row, or null when the member has no live result with this id. */
export async function getResultFile(ownerId: string, id: string) {
  const row = await findOwned(ownerId, id);
  if (!row) return null;
  const object = await env.files.get(row.r2Key);
  if (!object) return null;
  const { r2Key: _key, ...result } = row;
  return { result, body: object.body };
}

/** Deletes the row and its file. Null when the member has no live result with this id. */
export async function deleteResult(
  ownerId: string,
  id: string,
): Promise<Result | null> {
  const row = await findOwned(ownerId, id);
  if (!row) return null;
  await db
    .delete(results)
    .where(and(eq(results.id, id), eq(results.ownerId, ownerId)));
  await env.files.delete(row.r2Key);
  const { r2Key: _key, ...result } = row;
  return result;
}

/** Removes every expired result and its file. Returns how many went. */
export async function purgeExpired(now = Date.now()): Promise<number> {
  let removed = 0;
  for (;;) {
    const batch = await db
      .select({ id: results.id, r2Key: results.r2Key })
      .from(results)
      .where(lte(results.expiresAt, now))
      .limit(100);
    if (batch.length === 0) return removed;
    await env.files.delete(batch.map((row) => row.r2Key));
    const [first, ...rest] = batch.map((row) =>
      db.delete(results).where(eq(results.id, row.id)),
    );
    await db.batch([first!, ...rest]);
    removed += batch.length;
  }
}

/** Live storage per member: totals only, never names or contents. */
export async function storageSummary() {
  const now = Date.now();
  const members = await db
    .select({
      email: users.email,
      count: count(results.id),
      size: sql<number>`coalesce(${sum(results.size)}, 0)`.mapWith(Number),
    })
    .from(results)
    .innerJoin(users, eq(users.id, results.ownerId))
    .where(gt(results.expiresAt, now))
    .groupBy(users.id, users.email)
    .orderBy(desc(sql`coalesce(${sum(results.size)}, 0)`));
  const [expired] = await db
    .select({ count: count() })
    .from(results)
    .where(lte(results.expiresAt, now));
  return {
    members,
    total: {
      count: members.reduce((total, m) => total + m.count, 0),
      size: members.reduce((total, m) => total + m.size, 0),
    },
    expired: expired?.count ?? 0,
  };
}
