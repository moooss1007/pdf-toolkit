import { getEveryAppUser, isAdmin } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";

type User = NonNullable<Awaited<ReturnType<typeof getEveryAppUser>>>;

/** The member the Gateway verified, or the response that refuses the call. */
export async function memberOf(
  request: Request,
): Promise<{ user: User } | { refused: Response }> {
  const user = await getEveryAppUser(request, env);
  if (!user) return { refused: json({ error: "Sign in first" }, 401) };
  return { user };
}

export async function adminOf(
  request: Request,
): Promise<{ user: User } | { refused: Response }> {
  const member = await memberOf(request);
  if ("refused" in member) return member;
  if (!isAdmin(member.user))
    return { refused: json({ error: "Admins only" }, 403) };
  return member;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
