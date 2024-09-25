import React, { useState, useCallback, useEffect } from "react";

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

let userId = window.localStorage.getItem("userId") as UserId | null;
if (!userId) {
  userId = nanoid() as UserId;
  window.localStorage.setItem("userId", userId);
}

export function EventDetails({ event }: { event: CalendarEvent }) {
  const yDoc = useYDoc();

  const namesMap = yDoc.getMap("names");
  const names = useY(namesMap) as Record<UserId, string>;

  const availabilityMap = yDoc.getMap("availability");
  const availability = useY(availabilityMap) as AvailabilitySet;

  console.log({ availability });

  const setAvailability = (userId: UserId, date: IsoDate, value: boolean) => {
    const key = AvailabilityKey(userId, date);

    if (value) {
      availabilityMap.set(key, true);
    } else {
      availabilityMap.delete(key);
    }
  };

  const groupedDays = eachDayOfInterval(
    new Date(event.startDate),
    new Date(event.endDate)
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

  console.log({ availabilityForDates });

  let allUsers = new Set<string>();
  for (const users of Object.keys(availability)) {
    const user = users.split("-")[0];
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

  const [isDragging, setIsDragging] = useState(false);
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  const toggleAvailability = useCallback(
    (dateStr: IsoDate) => {
      if (!userId) {
        throw new Error("user id is missing");
      }
      const isAvailable = availability[AvailabilityKey(userId, dateStr)];
      setAvailability(userId, dateStr, !isAvailable);
    },
    [availability, setAvailability]
  );

  const handleMouseDown = (date: IsoDate) => {
    setIsDragging(true);
    toggleAvailability(date);
    setLastToggled(date);
  };

  const handleMouseEnter = (date: IsoDate) => {
    if (isDragging && lastToggled !== date) {
      toggleAvailability(date);
      setLastToggled(date);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setLastToggled(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  return (
    <Container>
      <p className="block font-mono text-sm">Calendar</p>
      <h1 className="text-2xl mb-4">{event.name}</h1>
      <p className="block font-mono text-sm">Event dates</p>
      <p className="mb-4">
        <time dateTime={event.startDate}>
          {new Date(event.startDate).toLocaleDateString()}
        </time>
        {" - "}
        <time dateTime={event.endDate}>
          {new Date(event.endDate).toLocaleDateString()}
        </time>
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
      <div className="availability-grid mt-2 mb-6">
        {Object.entries(groupedDays).map(([monthKey, monthDays]) => (
          <React.Fragment key={monthKey}>
            <div className="mb-2">
              {monthDays[0].toLocaleDateString("en-US", { month: "long" })}
            </div>
            <div className="flex flex-wrap">
              {monthDays.map((day) => {
                const dateStr = IsoDate(day);
                const availableUsers = availabilityForDates.get(dateStr) || [];

                return (
                  <button
                    key={dateStr}
                    className="flex items-center justify-center rounded-md ease-in-out size-11"
                    style={{
                      height: 40,
                      backgroundColor: `hsl(from var(--accent) h s l / ${
                        availableUsers.length / totalUsers
                      })`,
                      color:
                        availableUsers.length / totalUsers > 0.5
                          ? "white"
                          : "black",
                    }}
                    onMouseDown={() => handleMouseDown(dateStr)}
                    onMouseEnter={() => handleMouseEnter(dateStr)}
                    title={availableUsers.join(", ")}
                  >
                    {day.toLocaleDateString("en-US", { day: "numeric" })}
                  </button>
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

function eachDayOfInterval(from: Date, to: Date) {
  const days = [];
  const end = new Date(to);
  for (let d = new Date(from); d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }
  return days;
}

function CopyEventUrl({ eventId }: { eventId: string }) {
  const eventUrl = `${window.location.origin}${window.location.pathname}?id=${eventId}`;
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(eventUrl);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <label className="mt-4 relative">
      <span className="block">Event URL</span>
      <input
        id="eventUrl"
        readOnly
        value={eventUrl}
        className="block w-full p-2 bg-gray-100 rounded pr-10 [direction:rtl]"
      />
      <button
        className="absolute right-2 bottom-2 hover:bg-neutral-200 p-2 rounded-md active:bg-black active:text-white"
        title="Copy to clipboard"
        type="button"
        onClick={handleCopy}
      >
        <CopyIcon />
        {showTooltip && (
          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap">
            Copied to clipboard!
          </span>
        )}
      </button>
    </label>
  );
}
