import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold tracking-wide text-primary",
        className,
      )}
      {...props}
    />
  );
}
