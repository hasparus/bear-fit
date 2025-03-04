import { ClipboardCopyIcon } from "@radix-ui/react-icons";
import React, { useEffect, useRef, useState } from "react";
import { useY } from "react-yjs";
import { unsafeKeys } from "unsafe-keys";

import { getUserId } from "../getUserId";
import {
  type AvailabilitySet,
  type CalendarEvent,
  IsoDate,
  isoDate,
  type UserId,
} from "../schemas";
import { AvailabilityKey } from "../schemas";
import { getEventMap } from "../shared-data";
import { tryGetFirstDayOfTheWeek } from "../tryGetFirstDayOfTheWeek";
import { useYDoc } from "../useYDoc";
import { cn } from "./cn";
import { Container } from "./Container";
import { ExportEventJson } from "./ExportEventJson";
import { getPaddingDays } from "./getPaddingDays";
import { getWeekDayNames } from "./getWeekDayNames";
import { Skeleton } from "./Skeleton";
import { TooltipContent } from "./TooltipContent";

const userId = getUserId();

export function EventDetails() {
  const yDoc = useYDoc();

  const eventMap = getEventMap(yDoc);
  const event = useY(eventMap) as Partial<CalendarEvent>;

  const namesMap = yDoc.getMap("names");
  const names = useY(namesMap) as Record<UserId, string>;

  const availabilityMap = yDoc.getMap("availability");
  const availability = useY(availabilityMap) as AvailabilitySet;

  const [hoveredUser, setHoveredUser] = useState<UserId | null>(null);

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

  // I need SSR for this to affect social cards.
  // Left for a migration to PartyServer.
  useEffect(() => {
    if (event.name) {
      const oldTitle = document.title;
      document.title = `bear-fit: ${event.name}`;

      // This won't do anything. Need to move it to render to SSR.
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

  const monthCount = Object.keys(groupedDays).length;

  return (
    <Container wide={monthCount > 1}>
      <form
        className={cn(
          "font-[inherit] text-base",
          monthCount > 1 &&
            "lg:grid lg:grid-areas-[details_calendar] lg:grid-cols-[1fr_auto_1fr] lg:gap-4"
        )}
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
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
                creatorId={event.creator}
                names={names}
                onHover={(userId) => setHoveredUser(userId)}
                userId={userId}
              />
            )}
          </div>
          <CopyEventUrl className="max-lg:hidden" eventId={event.id} />
        </div>

        <div className="w-px bg-neutral-200 max-lg:hidden" />

        <div className="mb-6 mt-2 min-h-[72px]" role="grid">
          {event.startDate &&
            Object.entries(groupedDays).map(([monthKey, monthDays]) => (
              <React.Fragment key={monthKey}>
                <div className="mb-2 mt-4 first:mt-2">
                  {monthDays[0].toLocaleDateString("en-US", { month: "long" })}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getWeekDayNames(tryGetFirstDayOfTheWeek() ?? 0).map(
                    (name) => (
                      <div
                        className="flex h-10 items-center justify-center text-[11.6667px] font-medium opacity-75"
                        key={name}
                      >
                        {name}
                      </div>
                    )
                  )}

                  {[
                    ...Array(
                      getPaddingDays(
                        monthDays[0],
                        tryGetFirstDayOfTheWeek() ?? 0
                      )
                    ),
                  ].map((_, i) => (
                    <div className="h-10" key={`padding-${i}`} />
                  ))}

                  {monthDays.map((day, i) => {
                    const dateStr = isoDate(day);
                    const availableUsers =
                      availabilityForDates.get(dateStr) || [];
                    const currentUserAvailable =
                      !!userId && availableUsers.includes(userId);

                    return (
                      <AvailabilityGridCell
                        availableUsers={availableUsers}
                        currentUserAvailable={currentUserAvailable}
                        day={day}
                        hoveredUser={
                          hoveredUser
                            ? availableUsers.includes(hoveredUser)
                              ? "available"
                              : "unavailable"
                            : "none"
                        }
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
        <CopyEventUrl className="lg:hidden" eventId={event.id} />
      </form>
      <footer className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
        {event.name && <ExportEventJson eventName={event.name} />}
      </footer>
    </Container>
  );
}

function AvailabilityGridCell({
  availableUsers,
  currentUserAvailable,
  day,
  hoveredUser,
  names,
  totalUsers,
  ...rest
}: {
  availableUsers: UserId[];
  currentUserAvailable: boolean;
  day: Date;
  hoveredUser: "available" | "none" | "unavailable";
  names: Record<UserId, string>;
  totalUsers: number;
} & React.HTMLAttributes<HTMLButtonElement>) {
  const fill = availableUsers.length / totalUsers;
  return (
    <button
      className={cn(
        "group flex items-center justify-center rounded-md size-10 select-none hover:border-neutral-200 bg-neutral-100 hover:border-2 relative transition border-transparent",
        (currentUserAvailable || hoveredUser === "available") &&
          "border-neutral-200 border-4",
        currentUserAvailable &&
          hoveredUser === "available" &&
          "border-neutral-200 border-[6px]",
        hoveredUser === "unavailable" && "opacity-60"
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
interface CopyEventUrlProps
  extends Omit<React.HTMLAttributes<HTMLLabelElement>, "onClick"> {
  eventId: string | undefined;
}

function CopyEventUrl({ eventId, ...rest }: CopyEventUrlProps) {
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
      {...rest}
      className={cn("group relative mt-4 block cursor-copy", rest.className)}
      onClick={handleCopy}
    >
      <span className="block">Event URL</span>

      {eventId ? (
        <>
          <input
            className="block h-[42px] w-full cursor-copy rounded p-2 pr-10 text-neutral-700 [direction:rtl] group-hover:text-neutral-900"
            id="eventUrl"
            readOnly
            value={eventUrl}
          />
          <button
            className="absolute bottom-[7.4px] right-[7px] flex size-7 cursor-copy items-center justify-center rounded-md  active:!bg-black active:text-white group-hover:bg-neutral-200"
            onClick={handleCopy}
            title="Copy to clipboard"
            type="button"
          >
            <ClipboardCopyIcon />
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
  creatorId,
  names,
  onHover,
  userId,
}: {
  availabilityForUsers: Record<UserId, IsoDate[]>;
  creatorId: UserId | undefined;
  names: Record<UserId, string>;
  onHover: (userId: UserId | null) => void;
  userId: UserId | null;
}) {
  return (
    <dl onMouseLeave={() => onHover(null)}>
      {unsafeKeys(availabilityForUsers).map((user) => {
        const dates = availabilityForUsers[user];
        return (
          <UserAvailabilitySummaryItem
            dates={dates}
            isCreator={user === creatorId}
            isCurrentUser={user === userId}
            key={user}
            name={names[user as UserId] ?? user}
            onMouseEnter={() => onHover(user as UserId)}
          />
        );
      })}
      {userId && !availabilityForUsers[userId] && (
        <UserAvailabilitySummaryItem
          dates={[]}
          isCreator={creatorId === userId}
          isCurrentUser={true}
          key={userId}
          name={names[userId as UserId] ?? userId}
          onMouseEnter={() => onHover(userId as UserId)}
        />
      )}
    </dl>
  );
}

interface UserAvailabilitySummaryItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  dates: IsoDate[];
  isCreator: boolean;
  isCurrentUser: boolean;
  name: string;
}
function UserAvailabilitySummaryItem({
  dates,
  isCreator,
  isCurrentUser,
  name,
  ...rest
}: UserAvailabilitySummaryItemProps) {
  const labels = Object.entries({
    creator: isCreator,
    you: isCurrentUser,
  })
    .filter(([_, value]) => value)
    .map(([key]) => `${key}`)
    .join(", ");

  return (
    <div
      className="-mx-1 -my-0.5 flex cursor-default justify-between gap-2 rounded px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-800"
      {...rest}
    >
      <dt>
        {name}
        {labels ? ` (${labels})` : ""}
      </dt>
      <dd>
        {dates.length} date{dates.length === 1 ? "" : "s"}
      </dd>
    </div>
  );
}
