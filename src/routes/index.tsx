import { createFileRoute, Link } from "@tanstack/react-router";
import { Combine, FileImage, Hash, Images, LayoutGrid, Scissors, Stamp, type LucideIcon } from "lucide-react";
import { AppPage } from "@/client/components/AppPage";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ResultActions } from "@/client/components/ResultActions";
import { fileIcon } from "@/client/components/tool/Results";
import { Button } from "@/client/components/ui/button";
import { timeLeft } from "@/client/lib/time";
import { TOOLS, formatBytes, isToolId } from "@/lib/constants";
import { getResults } from "@/serverFunctions/results";

export const Route = createFileRoute("/")({
  loader: () => getResults({ data: { limit: 5 } }),
  head: () => ({ meta: [{ title: "PDF Toolkit" }] }),
  component: Home,
});

const TILES: { to: string; title: string; text: string; icon: LucideIcon }[] = [
  { to: "/merge", title: "Merge PDFs", text: "Join PDFs and images into one file.", icon: Combine },
  { to: "/split", title: "Split PDF", text: "Cut a PDF into ranges or single pages.", icon: Scissors },
  { to: "/organize", title: "Organize pages", text: "Reorder, rotate, remove and add pages.", icon: LayoutGrid },
  { to: "/page-numbers", title: "Page numbers", text: "Number the pages.", icon: Hash },
  { to: "/watermark", title: "Watermark", text: "Stamp text or an image on pages.", icon: Stamp },
  { to: "/images-to-pdf", title: "Images to PDF", text: "Turn JPG and PNG images into a PDF.", icon: Images },
  { to: "/pdf-to-jpg", title: "PDF to JPG", text: "Save pages as JPG images.", icon: FileImage },
];

function Home() {
  const recent = Route.useLoaderData();
  return (
    <AppPage>
      <PageHeader title="PDF Toolkit" description="What you make is saved to your library for two hours." />
      <div className="grid gap-3 sm:grid-cols-2">
        {TILES.map(({ to, title, text, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted-foreground">{text}</span>
            </span>
          </Link>
        ))}
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Recent files</h2>
          {recent.length > 0 ? (
            <Button variant="link" size="sm" render={<Link to="/library" />}>
              See all
            </Button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <EmptyState size="sm" title="No files yet" description="Files you make appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recent.map((result) => {
              const Icon = fileIcon(result.mime);
              return (
                <li key={result.id} data-testid="recent-result" className="flex items-center gap-3 py-2 pr-2 pl-4">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{result.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {isToolId(result.tool) ? TOOLS[result.tool] : result.tool} · {formatBytes(result.size)} · deleted in {timeLeft(result.expiresAt)}
                    </span>
                  </span>
                  <ResultActions result={result} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppPage>
  );
}
