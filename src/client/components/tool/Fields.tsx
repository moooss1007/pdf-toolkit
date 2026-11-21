import { useId, type ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/toggle-group";

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  /** The accessible name, when `label` isn't text. */
  name?: string;
}

/** One pick from a few options, as a labelled row of toggles. */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <ToggleGroup
        aria-label={label}
        variant="outline"
        size="sm"
        spacing={1}
        disabled={disabled}
        value={[value]}
        onValueChange={(next) => {
          const picked = options.find((option) => option.value === next[0]);
          if (picked) onChange(picked.value);
        }}
        className={cn("flex-wrap", className)}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.name}
            className="aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** A labelled input. */
export function TextField({
  label,
  testId,
  suffix,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; testId: string; suffix?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} data-testid={testId} className="bg-card" {...props} />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

/** The options of a tool, under the file it works on. */
export function OptionsPanel({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">{children}</div>;
}
