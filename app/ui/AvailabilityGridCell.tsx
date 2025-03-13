import type { UserId } from "../schemas";

import { cn } from "./cn";
import { TooltipContent } from "./TooltipContent";

export interface AvailabilityGridCellProps
  extends React.HTMLAttributes<HTMLButtonElement> {
  availableUsers: UserId[];
  currentUserAvailable: boolean;
  day: Date;
  hoveredUser: "available" | "none" | "unavailable";
  names: Record<UserId, string>;
  totalUsers: number;
}

export function AvailabilityGridCell({
  availableUsers,
  currentUserAvailable,
  day,
  hoveredUser,
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
        (currentUserAvailable || hoveredUser === "available") &&
          "border-neutral-200 border-4",
        currentUserAvailable &&
          hoveredUser === "available" &&
          "border-neutral-200 border-[6px]",
        hoveredUser === "unavailable" && "opacity-60 saturate-25",
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
