import { nanoid } from "nanoid";
import React, { useEffect, useRef, useState } from "react";
import { useY } from "react-yjs";
import { unsafeKeys } from "unsafe-keys";

import {
  type AvailabilitySet,
  type CalendarEvent,
  IsoDate,
  type UserId,
} from "../schemas";
import { AvailabilityKey } from "../schemas";
import { getEventMap } from "../shared-data";
import { useYDoc } from "../useYDoc";
import { cn } from "./cn";
import { Container } from "./Container";
import { CopyIcon } from "./CopyIcon";
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

  const availabilityForUsers = Object.keys(availability).reduce((acc, key) => {
    const { date, userId } = AvailabilityKey.parseToObject(key);
    if (!acc[userId]) {
      acc[userId] = [];
    }
    acc[userId].push(date);
    return acc;
  }, {} as Record<UserId, IsoDate[]>);

  const groupedDays = eachDayOfInterval(
    event.startDate ? new Date(event.startDate) : new Date(),
    event.endDate ? new Date(event.endDate) : new Date()
  ).reduce((acc, day) => {
    const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
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

  const allUsers = new Set<string>();
  for (const users of Object.keys(availability)) {
    const user = AvailabilityKey.parseToObject(users).userId;
    allUsers.add(user);
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

  const [dragMode, setDragMode] = useState<"clearing" | "none" | "painting">(
    "none"
  );
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  const handlePointerDown = (date: IsoDate, currentUserAvailable: boolean) => {
    setDragMode(currentUserAvailable ? "clearing" : "painting");
    setAvailability(userId!, date, !currentUserAvailable);
    setLastToggled(date);
  };

  const lastToggledByDrag = useRef<HTMLButtonElement | null>(null);

  const handlePointerEnter = (
    date: IsoDate,
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (userId && dragMode !== "none" && lastToggled !== date) {
      setAvailability(userId, date, dragMode === "painting");
      setLastToggled(date);
      lastToggledByDrag.current = event.currentTarget;
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setDragMode("none");
      setLastToggled(null);
      if (lastToggledByDrag.current) {
        lastToggledByDrag.current.focus();
        lastToggledByDrag.current = null;
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    if (event.name) {
      const oldTitle = document.title;
      document.title = `bear-fit: ${event.name}`;

      const metaTitle = document.querySelector("meta[name='title']");
      const metaTitleName = metaTitle?.getAttribute("content");
      if (metaTitle) {
        metaTitle.setAttribute("content", `bear-fit: ${event.name}`);
      }

      return () => {
        document.title = oldTitle;
        if (metaTitleName && metaTitle) {
          metaTitle.setAttribute("content", metaTitleName);
        }
      };
    }
  }, [event.name]);

  return (
    <Container>
      <form
        className="font-[inherit] text-base"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="block font-mono text-sm">Calendar</p>
        <h1 className="mb-4 text-2xl">
          {event.name || <Skeleton className="h-[32px]" />}
        </h1>
        <p className="block font-mono text-sm">Event dates</p>
        <p aria-busy={!event.startDate} className="mb-4">
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
          <label className="block" htmlFor="name">
            Your name
          </label>
          <input
            className="w-full border p-2"
            id="name"
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
            type="text"
            value={userName || ""}
          />
        </div>
        <div className="mb-4 font-mono text-sm text-neutral-500">
          {!event.id ? (
            <>&nbsp;</>
          ) : (
            <UserAvailabilitySummary
              availabilityForUsers={availabilityForUsers}
              names={names}
              userId={userId}
            />
          )}
        </div>
        <div className="mb-6 mt-2 min-h-[72px]" role="grid">
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
                        availableUsers={availableUsers}
                        currentUserAvailable={currentUserAvailable}
                        day={day}
                        key={`${day}-${i}`}
                        names={names}
                        onKeyDown={(event) =>
                          moveFocusWithArrowKeys(event, () =>
                            setAvailability(
                              userId!,
                              dateStr,
                              !currentUserAvailable
                            )
                          )
                        }
                        onPointerDown={() =>
                          handlePointerDown(dateStr, !!currentUserAvailable)
                        }
                        onPointerEnter={(event) =>
                          handlePointerEnter(dateStr, event)
                        }
                        tabIndex={i === 0 ? 0 : -1}
                        totalUsers={totalUsers}
                      />
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
        </div>
        <CopyEventUrl eventId={event.id} />
      </form>
    </Container>
  );
}

function AvailabilityGridCell({
  availableUsers,
  currentUserAvailable,
  day,
  names,
  totalUsers,
  ...rest
}: {
  availableUsers: UserId[];
  currentUserAvailable: boolean;
  day: Date;
  names: Record<UserId, string>;
  totalUsers: number;
} & React.HTMLAttributes<HTMLButtonElement>) {
  const fill = availableUsers.length / totalUsers;
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
      type="button"
      {...rest}
    >
      {day.toLocaleDateString("en-US", { day: "numeric" })}
      {availableUsers.length > 0 && (
        <TooltipContent className="whitespace-pre-line text-left opacity-0 group-hover:opacity-100">
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
    <label
      className="group relative mt-4 block cursor-copy"
      onClick={handleCopy}
    >
      <span className="block">Event URL</span>

      {eventId ? (
        <>
          <input
            className="block w-full rounded p-2 pr-10 [direction:rtl]"
            id="eventUrl"
            readOnly
            value={eventUrl}
          />
          <button
            className="absolute bottom-2 right-2 rounded-md p-2 hover:bg-neutral-200 active:bg-black active:text-white group-hover:bg-neutral-100"
            onClick={handleCopy}
            title="Copy to clipboard"
            type="button"
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

function UserAvailabilitySummary({
  availabilityForUsers,
  names,
  userId,
}: {
  availabilityForUsers: Record<UserId, IsoDate[]>;
  names: Record<UserId, string>;
  userId: UserId | null;
}) {
  return (
    <dl>
      {unsafeKeys(availabilityForUsers).map((user) => {
        const dates = availabilityForUsers[user];
        return (
          <UserAvailabilitySummaryItem
            dates={dates}
            isCurrentUser={user === userId}
            key={user}
            name={names[user as UserId] ?? user}
          />
        );
      })}
      {userId && !availabilityForUsers[userId] && (
        <UserAvailabilitySummaryItem
          dates={[]}
          isCurrentUser={true}
          key={userId}
          name={names[userId as UserId] ?? userId}
        />
      )}
    </dl>
  );
}

function UserAvailabilitySummaryItem({
  dates,
  isCurrentUser,
  name,
}: {
  dates: IsoDate[];
  isCurrentUser: boolean;
  name: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt>
        {name}
        {isCurrentUser && " (you)"}
      </dt>
      <dd>
        {dates.length} date{dates.length === 1 ? "" : "s"}
      </dd>
    </div>
  );
}
