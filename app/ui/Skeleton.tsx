import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-full w-full bg-neutral-200 animate-pulse opacity-0 transition-opacity",
        className
      )}
    >
      &nbsp;
    </span>
  );
}
