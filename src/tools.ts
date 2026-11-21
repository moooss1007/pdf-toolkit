// The app's tools for AI clients, served by the Gateway at /mcp.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import * as results from "@/server/results";

export const tools = defineTools({
  list_results: {
    description:
      "List the user's saved PDF tool results that haven't expired: name, tool, size in bytes, and creation and expiry times in epoch milliseconds.",
    risk: "read",
    input: z.object({}).strict(),
    handler: (_input, { user }) => results.listResults(user.id),
  },
  delete_result: {
    description: "Delete one of the user's saved results and its file.",
    risk: "write",
    destructive: true,
    input: z.object({ id: z.string().uuid() }).strict(),
    handler: async ({ id }, { user }) => {
      const deleted = await results.deleteResult(user.id, id);
      if (!deleted) throw new ToolError("No result with that id");
      return deleted;
    },
  },
});
