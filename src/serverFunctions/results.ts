import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as results from "@/server/results";

export const getResults = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(1000).optional() }).parse(data ?? {}),
  )
  .handler(({ data, context }) =>
    results.listResults(context.user.id, data.limit),
  );

export const deleteResult = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const deleted = await results.deleteResult(context.user.id, data.id);
    if (!deleted) throw new Error("That file is gone.");
    return deleted;
  });

/** Admins get the storage totals; anyone else gets `forbidden`. */
export const getStorage = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    if (!isAdmin(context.user)) return { forbidden: true as const };
    return { forbidden: false as const, ...(await results.storageSummary()) };
  });

export const purgeExpired = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    if (!isAdmin(context.user)) throw new Error("Admins only");
    return { purged: await results.purgeExpired() };
  });
