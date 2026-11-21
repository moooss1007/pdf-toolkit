import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatBytes } from "@/lib/constants";
import { getStorage, purgeExpired } from "@/serverFunctions/results";

export const Route = createFileRoute("/admin")({
  loader: () => getStorage(),
  head: () => ({ meta: [{ title: "Storage" }] }),
  component: Admin,
});

function Admin() {
  const storage = Route.useLoaderData();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [purged, setPurged] = useState<number | null>(null);

  if (storage.forbidden) {
    return (
      <AppPage>
        <PageHeader title="Storage" />
        <div data-testid="admin-forbidden">
          <EmptyState kind="error" title="Admins only" description="Ask an owner or admin of your organization." />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        title="Storage"
        description="Files each member has saved."
        actions={
          <Button
            variant="outline"
            pending={pending}
            onClick={async () => {
              setPending(true);
              try {
                const { purged: count } = await purgeExpired();
                setPurged(count);
                await router.invalidate();
              } finally {
                setPending(false);
              }
            }}
          >
            Purge expired
          </Button>
        }
      />
      {purged !== null ? (
        <p className="text-sm text-muted-foreground" role="status">
          Removed {purged} expired {purged === 1 ? "file" : "files"}.
        </p>
      ) : null}
      <dl className="grid grid-cols-3 gap-3" data-testid="admin-total">
        <Stat label="Files" value={String(storage.total.count)} />
        <Stat label="Stored" value={formatBytes(storage.total.size)} />
        <Stat label="Expired, not yet removed" value={String(storage.expired)} />
      </dl>
      {storage.members.length === 0 ? (
        <EmptyState title="Nothing stored" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storage.members.map((member) => (
                <TableRow key={member.email} data-testid="admin-member-row">
                  <TableCell className="truncate">{member.email}</TableCell>
                  <TableCell className="text-right tabular-nums">{member.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBytes(member.size)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AppPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
