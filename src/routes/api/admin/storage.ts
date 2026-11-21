import { createFileRoute } from "@tanstack/react-router";
import { adminOf, json } from "@/server/http";
import { storageSummary } from "@/server/results";

export const Route = createFileRoute("/api/admin/storage")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const admin = await adminOf(request);
        if ("refused" in admin) return admin.refused;
        return json(await storageSummary());
      },
    },
  },
});
