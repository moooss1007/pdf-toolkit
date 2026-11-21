import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { purgeExpired } from "@/server/results";
import { tools } from "./tools";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401), and serves the tools.
const app = everyApp<Env>(async (request) => tanstackEntry.fetch(request), {
  tools,
});

export default {
  ...app,
  // The cron in cloudflare.config.ts: results expire two hours after they
  // are made, and this removes the rows and their files.
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(purgeExpired().then(() => undefined));
  },
};
