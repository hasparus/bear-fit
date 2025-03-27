import type { UserId } from "../schemas";

import { cn } from "./cn";

export interface AvailabilityGridCellProps
  extends React.HTMLAttributes<HTMLButtonElement> {
  availableUsers: UserId[];
  className?: string;
  day: Date;
  totalUsers: number;
}

export function AvailabilityGridCell({
  availableUsers,
  className,
  day,
  totalUsers,
  ...rest
}: AvailabilityGridCellProps) {
  const fill = availableUsers.length / totalUsers;
  return (
    <button
      type="button"
      aria-label={day.toLocaleDateString(undefined, { dateStyle: "full" })}
      className={cn(
        "group flex items-center justify-center rounded-md size-10 select-none hover:border-neutral-200 bg-neutral-100 hover:border-2 relative transition-all border-transparent",
        className,
      )}
      style={{
        color: fill > 0.5 ? "white" : "black",
        backgroundColor: fill
          ? `hsl(from var(--accent) h s l / ${fill})`
          : undefined,
      }}
      {...rest}
    >
      {day.toLocaleDateString("en-US", { day: "numeric" })}
    </button>
  );
}
