import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { AppPage } from "@/client/components/AppPage";
import { ErrorState } from "@/client/components/ErrorState";
import { PageHeader } from "@/client/components/PageHeader";
import { ResultActions } from "@/client/components/ResultActions";
import { DataTable, useDataTable } from "@/client/components/table/DataTable";
import { SortableHeader } from "@/client/components/table/SortableHeader";
import { TablePagination } from "@/client/components/table/TablePagination";
import { fileIcon } from "@/client/components/tool/Results";
import { Button } from "@/client/components/ui/button";
import type { SavedResult } from "@/client/lib/save";
import { formatTime, timeLeft } from "@/client/lib/time";
import { TOOLS, formatBytes, isToolId } from "@/lib/constants";
import { getResults } from "@/serverFunctions/results";

export const Route = createFileRoute("/library")({
  loader: () => getResults({ data: {} }),
  head: () => ({ meta: [{ title: "Library" }] }),
  component: Library,
  errorComponent: ({ reset }) => (
    <AppPage>
      <PageHeader title="Library" />
      <ErrorState message="The library couldn't be loaded." onRetry={reset} />
    </AppPage>
  ),
});

const PAGE_SIZE = 10;

const columns: ColumnDef<SavedResult>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => {
      const Icon = fileIcon(row.original.mime);
      return (
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate" data-testid="result-name">
            {row.original.name}
          </span>
        </span>
      );
    },
    meta: { width: 190 },
  },
  {
    accessorKey: "tool",
    header: ({ column }) => <SortableHeader column={column} label="Tool" />,
    cell: ({ getValue }) => {
      const tool = getValue<string>();
      return isToolId(tool) ? TOOLS[tool] : tool;
    },
    meta: { width: 125 },
  },
  {
    accessorKey: "size",
    header: ({ column }) => <SortableHeader column={column} label="Size" align="right" />,
    cell: ({ getValue }) => <span className="block text-right tabular-nums">{formatBytes(getValue<number>())}</span>,
    meta: { width: 80 },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <SortableHeader column={column} label="Created" />,
    cell: ({ getValue }) => formatTime(getValue<number>()),
    sortDescFirst: true,
    meta: { width: 90 },
  },
  {
    accessorKey: "expiresAt",
    header: ({ column }) => <SortableHeader column={column} label="Deleted in" />,
    cell: ({ getValue }) => <span className="text-muted-foreground">{timeLeft(getValue<number>())}</span>,
    meta: { width: 100 },
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <ResultActions result={row.original} />,
    meta: { width: 80 },
  },
];

function Library() {
  const results = Route.useLoaderData();
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [page, setPage] = useState(1);
  const data = useMemo(() => results, [results]);
  const table = useDataTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE } },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
    withSorting: true,
    withPagination: true,
  });

  return (
    <AppPage>
      <PageHeader title="Library" description="Files you made in the last two hours." />
      <DataTable
        table={table}
        rowTestId="library-row"
        filteredTitle="No files match"
        empty={{
          title: "No files yet",
          description: "What you make with a tool is saved here for two hours.",
          action: (
            <Button variant="outline" render={<Link to="/" />}>
              Open a tool
            </Button>
          ),
        }}
        footer={<TablePagination page={page} pageSize={PAGE_SIZE} totalCount={results.length} onPageChange={setPage} />}
      />
    </AppPage>
  );
}
