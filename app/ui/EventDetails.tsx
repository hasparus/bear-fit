import React, { useState, useEffect } from "react";

import {
  IsoDate,
  type AvailabilitySet,
  type CalendarEvent,
  type UserId,
} from "../schemas";
import { CopyIcon } from "./CopyIcon";
import { useY } from "react-yjs";
import { useYDoc } from "../useYDoc";
import { nanoid } from "nanoid";
import { Container } from "./Container";
import { AvailabilityKey } from "../schemas";
import { cn } from "./cn";
import { getEventMap } from "../shared-data";
import { Skeleton } from "./Skeleton";
import { TooltipContent } from "./TooltipContent";

let userId = window.localStorage.getItem("userId") as UserId | null;
if (!userId) {
  userId = nanoid() as UserId;
  window.localStorage.setItem("userId", userId);
}

export function EventDetails() {
  const yDoc = useYDoc();

  const eventMap = getEventMap(yDoc);
  const event = useY(eventMap) as Partial<CalendarEvent>;

  const namesMap = yDoc.getMap("names");
  const names = useY(namesMap) as Record<UserId, string>;

  const availabilityMap = yDoc.getMap("availability");
  const availability = useY(availabilityMap) as AvailabilitySet;

  const setAvailability = (userId: UserId, date: IsoDate, value: boolean) => {
    const key = AvailabilityKey(userId, date);

    if (value) {
      availabilityMap.set(key, true);
    } else {
      availabilityMap.delete(key);
    }
  };

  const groupedDays = eachDayOfInterval(
    event.startDate ? new Date(event.startDate) : new Date(),
    event.endDate ? new Date(event.endDate) : new Date()
  ).reduce((acc, day) => {
    const monthKey = day.getMonth();
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(day);
    return acc;
  }, {} as Record<string, Date[]>);

  const availabilityForDates = new Map<IsoDate, UserId[]>();
  for (const [key, available] of Object.entries(availability)) {
    if (!available) continue;

    const { date, userId } = AvailabilityKey.parseToObject(key);
    if (!availabilityForDates.has(date)) {
      availabilityForDates.set(date, []);
    }
    availabilityForDates.get(date)!.push(userId);
  }

  let currentUserPickedDatesCount = 0;

  let allUsers = new Set<string>();
  for (const users of Object.keys(availability)) {
    const user = AvailabilityKey.parseToObject(users).userId;
    allUsers.add(user);
    if (user === userId) {
      currentUserPickedDatesCount++;
    }
  }
  const totalUsers = allUsers.size;

  const [userName, setUserName] = useState<string | undefined>(() => {
    const nameFromYDoc = userId && namesMap.get(userId);
    if (nameFromYDoc && typeof nameFromYDoc === "string") return nameFromYDoc;

    const nameFromLocalStorage = localStorage.getItem("userName");
    if (nameFromLocalStorage && typeof nameFromLocalStorage === "string") {
      if (userId) {
        namesMap.set(userId, nameFromLocalStorage);
      }
      return nameFromLocalStorage;
    }

    return undefined;
  });

  // If we have a name for the user in the YJs doc, we use it.
  if (
    userId &&
    names[userId] &&
    typeof names[userId] === "string" &&
    userName === undefined
  ) {
    setUserName(names[userId]);
  }

  const [dragMode, setDragMode] = useState<"none" | "clearing" | "painting">(
    "none"
  );
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  const handlePointerDown = (date: IsoDate, currentUserAvailable: boolean) => {
    setDragMode(currentUserAvailable ? "clearing" : "painting");
    setAvailability(userId!, date, !currentUserAvailable);
    setLastToggled(date);
  };

  const handlePointerEnter = (date: IsoDate) => {
    if (userId && dragMode !== "none" && lastToggled !== date) {
      setAvailability(userId, date, dragMode === "painting");
      setLastToggled(date);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setDragMode("none");
      setLastToggled(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    if (event.name) {
      const oldTitle = document.title;
      document.title = `bear-fit: ${event.name}`;
      return () => {
        document.title = oldTitle;
      };
    }
  }, [event.name]);

  return (
    <Container>
      <p className="block font-mono text-sm">Calendar</p>
      <h1 className="text-2xl mb-4">
        {event.name || <Skeleton className="w-ful h-[32px]" />}
      </h1>
      <p className="block font-mono text-sm">Event dates</p>
      <p className="mb-4" aria-busy={!event.startDate}>
        {event.startDate && event.endDate ? (
          <>
            <time dateTime={event.startDate}>
              {new Date(event.startDate).toLocaleDateString()}
            </time>
            {" - "}
            <time dateTime={event.endDate}>
              {new Date(event.endDate).toLocaleDateString()}
            </time>
          </>
        ) : (
          <Skeleton className="w-[206px]" />
        )}
      </p>
      <div className="mb-4">
        <label htmlFor="name" className="block">
          Your name
        </label>
        <input
          type="text"
          id="name"
          value={userName || ""}
          onChange={(e) => {
            if (!userId) {
              throw new Error("user id is missing");
            }

            const value = e.target.value;
            setUserName(value);
            namesMap.set(userId, value);
            setTimeout(() => {
              localStorage.setItem("userName", value);
            });
          }}
          className="border p-2 w-full"
        />
      </div>
      <div className="mb-4 font-mono text-sm text-neutral-500">
        {!event.id ? (
          <>&nbsp;</>
        ) : currentUserPickedDatesCount > 0 ? (
          currentUserPickedDatesCount === availabilityForDates.size &&
          totalUsers > 1 ? (
            <span>You've picked the most dates! Wow!</span>
          ) : (
            <span>
              You've picked {currentUserPickedDatesCount} date
              {currentUserPickedDatesCount > 1 ? "s" : ""}. Thanks!
            </span>
          )
        ) : (
          <span>⚠️ You haven't picked any dates yet</span>
        )}
      </div>
      <div role="grid" className="mt-2 mb-6 min-h-[72px]">
        {event.startDate &&
          Object.entries(groupedDays).map(([monthKey, monthDays]) => (
            <React.Fragment key={monthKey}>
              <div className="my-2">
                {monthDays[0].toLocaleDateString("en-US", { month: "long" })}
              </div>
              <div className="flex flex-wrap gap-1">
                {monthDays.map((day, i) => {
                  const dateStr = IsoDate(day);
                  const availableUsers =
                    availabilityForDates.get(dateStr) || [];
                  const currentUserAvailable =
                    !!userId && availableUsers.includes(userId);

                  return (
                    <AvailabilityGridCell
                      key={`${day}-${i}`}
                      availableUsers={availableUsers}
                      totalUsers={totalUsers}
                      currentUserAvailable={currentUserAvailable}
                      tabIndex={i === 0 ? 0 : -1}
                      day={day}
                      names={names}
                      onPointerDown={() =>
                        handlePointerDown(dateStr, !!currentUserAvailable)
                      }
                      onPointerEnter={() => handlePointerEnter(dateStr)}
                      onKeyDown={(event) =>
                        moveFocusWithArrowKeys(event, () =>
                          setAvailability(
                            userId!,
                            dateStr,
                            !currentUserAvailable
                          )
                        )
                      }
                    />
                  );
                })}
              </div>
            </React.Fragment>
          ))}
      </div>
      <CopyEventUrl eventId={event.id} />
    </Container>
  );
}

function AvailabilityGridCell({
  day,
  currentUserAvailable,
  availableUsers,
  totalUsers,
  names,
  ...rest
}: {
  day: Date;
  currentUserAvailable: boolean;
  availableUsers: UserId[];
  totalUsers: number;
  names: Record<UserId, string>;
} & React.HTMLAttributes<HTMLButtonElement>) {
  let fill = availableUsers.length / totalUsers;
  return (
    <button
      className={cn(
        "group flex items-center justify-center rounded-md size-10 select-none hover:border-neutral-200 bg-neutral-100 hover:border-2 relative",
        currentUserAvailable && "border-neutral-200 border-4"
      )}
      style={{
        backgroundColor: fill
          ? `hsl(from var(--accent) h s l / ${fill})`
          : undefined,
        color: fill > 0.5 ? "white" : "black",
      }}
      {...rest}
    >
      {day.toLocaleDateString("en-US", { day: "numeric" })}
      {availableUsers.length > 0 && (
        <TooltipContent className="opacity-0 group-hover:opacity-100 whitespace-pre-line text-left">
          {availableUsers.map((userId) => names[userId]).join("\n")}
        </TooltipContent>
      )}
    </button>
  );
}

function eachDayOfInterval(from: Date, to: Date) {
  const days = [];
  const end = new Date(to);
  for (let d = new Date(from); d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }
  return days;
}

function CopyEventUrl({ eventId }: { eventId: string | undefined }) {
  const eventUrl = `${window.location.origin}${window.location.pathname}?id=${eventId}`;
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = () => {
    if (!navigator.clipboard) {
      alert("Clipboard not supported");
    }
    navigator.clipboard.writeText(eventUrl);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <label className="mt-4 relative group cursor-copy" onClick={handleCopy}>
      <span className="block">Event URL</span>

      {eventId ? (
        <>
          <input
            id="eventUrl"
            readOnly
            value={eventUrl}
            className="block w-full p-2 bg-neutral rounded pr-10 [direction:rtl]"
          />
          <button
            className="absolute right-2 bottom-2 hover:bg-neutral-200 p-2 rounded-md active:bg-black active:text-white group-hover:bg-neutral-100"
            title="Copy to clipboard"
            type="button"
            onClick={handleCopy}
          >
            <CopyIcon />
            {showTooltip && (
              <TooltipContent>Copied to clipboard!</TooltipContent>
            )}
          </button>
        </>
      ) : (
        <Skeleton className="h-[46px]" />
      )}
    </label>
  );
}

function moveFocusWithArrowKeys(
  e: React.KeyboardEvent<HTMLButtonElement>,
  onClick: () => void
) {
  const grid = e.currentTarget.parentElement!.parentElement!;

  const allButtons = grid.querySelectorAll("button");
  let index = Array.from(allButtons).indexOf(
    e.currentTarget as HTMLButtonElement
  );

  // move focus to next button with arrow keys
  switch (e.key) {
    case "ArrowRight":
      index++;
      break;
    case "ArrowLeft":
      index--;
      break;
    case "ArrowDown":
      index += 7;
      break;
    case "ArrowUp":
      index -= 7;
      break;

    case " ":
    case "Enter":
      onClick();
      break;
  }

  const nextFocused = allButtons[index % allButtons.length];
  if (nextFocused) {
    nextFocused.focus();
  }
}
