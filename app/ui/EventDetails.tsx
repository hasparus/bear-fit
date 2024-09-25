import React, { useState, useCallback, useEffect } from "react";

import type {
  AvailabilitySet,
  CalendarEvent,
  IsoDate,
  UserId,
} from "../schemas";
import { CopyIcon } from "./CopyIcon";
import { useY } from "react-yjs";
import { useYDoc } from "../useYDoc";
import { nanoid } from "nanoid";

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

  const setAvailability = (userId: UserId, date: IsoDate, value: boolean) => {
    const key = `${userId}-${date}`;

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

  const groupedAvailability = Object.entries(availability).reduce(
    (acc, [key]) => {
      const [user, date] = key.split("-");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(user);
      return acc;
    },
    {} as Record<string, string[]>
  );

  let allUsers = new Set<string>();
  for (const users of Object.keys(availability)) {
    const user = users.split("-")[0];
    allUsers.add(user);
  }
  const totalUsers = allUsers.size;

  const [userName, setUserName] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  const toggleAvailability = useCallback(
    (dateStr: IsoDate) => {
      if (!userId) {
        throw new Error("user id is missing");
      }
      const isAvailable = availability[`${userId}-${dateStr}`];
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
      <small className="block">Calendar</small>
      <h1 className="text-2xl mb-4">{event.name}</h1>
      <small className="block">Event dates</small>
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
          Your Name:
        </label>
        <input
          type="text"
          id="name"
          value={userName}
          onChange={(e) => {
            if (!userId) {
              throw new Error("user id is missing");
            }

            const value = e.target.value;
            setUserName(value);
          }}
          className="border p-2 w-full"
        />
      </div>
      <div className="availability-grid">
        {Object.entries(groupedDays).map(([monthKey, monthDays]) => (
          <React.Fragment key={monthKey}>
            <div className="month-header">
              {monthDays[0].toLocaleDateString("en-US", { month: "long" })}
            </div>
            {monthDays.map((day) => {
              const dateStr = day.toISOString().split("T")[0] as IsoDate;
              const availableUsers = groupedAvailability[dateStr] || [];

              return (
                <button
                  key={dateStr}
                  className="flex items-center justify-center rounded-md transition duration-200 ease-in-out"
                  style={{
                    height: 40,
                    backgroundColor: `hsl(var(--rdp-accent-color) / ${
                      (availableUsers.length / totalUsers) * 100
                    }%)`,
                  }}
                  onMouseDown={() => handleMouseDown(dateStr)}
                  onMouseEnter={() => handleMouseEnter(dateStr)}
                  title={availableUsers.join(", ")}
                >
                  {day.toLocaleDateString("en-US", { day: "numeric" })}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <CopyEventUrl eventId={event.id} />
    </Container>
  );
}

function eachDayOfInterval(from: Date, to: Date) {
  const days = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(d);
  }
  return days;
}

function CopyEventUrl({ eventId }: { eventId: string }) {
  const eventUrl = `${window.location.origin}${window.location.pathname}?id=${eventId}`;

  return (
    <label className="mt-4 relative">
      <small className="block mb-2">Event URL</small>

      <input
        id="eventUrl"
        readOnly
        value={eventUrl}
        className="block w-full p-2 bg-gray-100 rounded pr-10"
      />
      <button
        onClick={() => navigator.clipboard.writeText(eventUrl)}
        className="absolute right-2 bottom-2 hover:bg-neutral-200 p-2 rounded-md"
        title="Copy to clipboard"
      >
        <CopyIcon />
      </button>
    </label>
  );
}
