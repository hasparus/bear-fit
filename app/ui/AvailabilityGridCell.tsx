import type { UserId } from "../schemas";

import { cn } from "./cn";
import { TooltipContent } from "./TooltipContent";

export interface AvailabilityGridCellProps
  extends React.HTMLAttributes<HTMLButtonElement> {
  availableUsers: UserId[];
  className?: string;
  day: Date;
  names: Record<UserId, string>;
  totalUsers: number;
}

export function AvailabilityGridCell({
  availableUsers,
  className,
  day,
  names,
  totalUsers,
  ...rest
}: AvailabilityGridCellProps) {
  const fill = availableUsers.length / totalUsers;
  return (
    <button
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
      type="button"
      {...rest}
    >
      {day.toLocaleDateString("en-US", { day: "numeric" })}
      {availableUsers.length > 0 && (
        // todo: lift up and animate names using experimental_ViewTransition
        <TooltipContent className="whitespace-pre text-left opacity-0 group-hover:opacity-100">
          {availableUsers.map((userId) => names[userId]).join("\n")}
        </TooltipContent>
      )}
    </button>
  );
}
