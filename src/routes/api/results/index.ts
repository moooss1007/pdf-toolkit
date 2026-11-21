import { createFileRoute } from "@tanstack/react-router";
import { json, memberOf } from "@/server/http";
import { ResultInputError, listResults, saveResult } from "@/server/results";

// The caller's live results, and where the tool pages save what they make.
export const Route = createFileRoute("/api/results/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const member = await memberOf(request);
        if ("refused" in member) return member.refused;
        return json({ results: await listResults(member.user.id) });
      },
      POST: async ({ request }: { request: Request }) => {
        const member = await memberOf(request);
        if ("refused" in member) return member.refused;
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Send the file as multipart form data" }, 400);
        }
        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: "No file" }, 400);
        try {
          const result = await saveResult(member.user, {
            name: file.name,
            tool: form.get("tool"),
            file,
          });
          return json({ result }, 201);
        } catch (error) {
          if (error instanceof ResultInputError)
            return json({ error: error.message }, error.status);
          throw error;
        }
      },
    },
  },
});
