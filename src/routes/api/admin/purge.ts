import { createFileRoute } from "@tanstack/react-router";
import { adminOf, json } from "@/server/http";
import { purgeExpired } from "@/server/results";

export const Route = createFileRoute("/api/admin/purge")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const admin = await adminOf(request);
        if ("refused" in admin) return admin.refused;
        return json({ purged: await purgeExpired() });
      },
    },
  },
});
