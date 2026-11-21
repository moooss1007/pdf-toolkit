import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import {
  ConfigurationError,
  gatewayUrl,
  isAdmin,
} from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { ensureMember } from "@/server/results";

/**
 * The Gateway's origin (the way back to the other apps, and the host the
 * light/dark cookie is set on), and whether the viewer is an admin. Also
 * records the member on first sight.
 */
export const getGatewayUrl = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await ensureMember({ id: user.id, email: user.email });
    const admin = isAdmin(user);
    try {
      return { gatewayUrl: new URL(gatewayUrl(env)).origin, isAdmin: admin };
    } catch (error) {
      if (!(error instanceof ConfigurationError)) throw error;
      return { gatewayUrl: null, isAdmin: admin };
    }
  });
