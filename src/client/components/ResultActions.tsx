import { useRouter } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Button } from "@/client/components/ui/button";
import { deleteResult } from "@/serverFunctions/results";

/** Download and delete for one saved result. */
export function ResultActions({ result }: { result: { id: string; name: string } }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Download ${result.name}`}
        render={<a href={`/api/results/${result.id}`} download={result.name} />}
      >
        <Download />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${result.name}`}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${result.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deleteResult({ data: { id: result.id } });
              setConfirming(false);
              await router.invalidate();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The file couldn't be deleted.");
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
