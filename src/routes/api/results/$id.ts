import { createFileRoute } from "@tanstack/react-router";
import { attachment } from "@/server/files";
import { json, memberOf } from "@/server/http";
import { deleteResult, getResultFile } from "@/server/results";

// One result: download it or delete it. Another member's id is not found.
export const Route = createFileRoute("/api/results/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const member = await memberOf(request);
        if ("refused" in member) return member.refused;
        const file = await getResultFile(member.user.id, params.id);
        if (!file) return json({ error: "Not found" }, 404);
        return new Response(file.body, {
          headers: {
            "content-type": file.result.mime,
            "content-length": String(file.result.size),
            "content-disposition": attachment(file.result.name),
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
      DELETE: async ({ request, params }) => {
        const member = await memberOf(request);
        if ("refused" in member) return member.refused;
        const deleted = await deleteResult(member.user.id, params.id);
        if (!deleted) return json({ error: "Not found" }, 404);
        return json({ deleted: true });
      },
    },
  },
});
