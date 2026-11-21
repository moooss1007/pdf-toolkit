import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:font-medium";

/** AppShell with the app's own links: the tools, the library, and Admin for admins. */
export function AppPage({ children }: { children: ReactNode }) {
  const isAdmin = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return Boolean(root && "isAdmin" in root && root.isAdmin);
    },
  });
  return (
    <AppShell
      nav={
        <nav className="flex items-center gap-3">
          <Link to="/" className={LINK} activeOptions={{ exact: true }}>
            Tools
          </Link>
          <Link to="/library" className={LINK}>
            Library
          </Link>
          {isAdmin ? (
            <Link to="/admin" className={LINK}>
              Admin
            </Link>
          ) : null}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
