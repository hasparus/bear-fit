import type { UserId } from "../schemas";

import { cn } from "./cn";

export interface AvailabilityGridCellProps
  extends React.HTMLAttributes<HTMLButtonElement> {
  availableUsers: UserId[];
  className?: string;
  day: Date;
  disabled?: boolean;
  totalUsers: number;
}

export function AvailabilityGridCell({
  availableUsers,
  className,
  day,
  disabled,
  totalUsers,
  ...rest
}: AvailabilityGridCellProps) {
  const fill = availableUsers.length / totalUsers;
  return (
    <button
      type="button"
      aria-label={day.toLocaleDateString(undefined, { dateStyle: "full" })}
      disabled={disabled}
      className={cn(
        "group flex items-center justify-center rounded-md h-8 w-8 sm:h-10 sm:w-10 min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] select-none hover:border-neutral-200 bg-neutral-100 hover:border-2 relative transition-all border-transparent text-sm sm:text-base touch-manipulation",
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
