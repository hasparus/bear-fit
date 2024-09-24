import React from "react";

import * as v from "valibot";
import type { CalendarEvent } from "../schemas";
import { CopyIcon } from "./CopyIcon";

export function EventDetails({ event }: { event: CalendarEvent }) {
  const eventUrl = `${window.location.origin}${window.location.pathname}?id=${event.id}`;

  const groupedDays = days.reduce((acc, day) => {
    const monthKey = format(day, "yyyy-MM");
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(day);
    return acc;
  }, {} as Record<string, Date[]>);

  let allUsers = new Set<string>();
  for (const users of Object.values(availability)) {
    for (const user of users) {
      allUsers.add(user);
    }
  }
  const totalUsers = allUsers.size;

  return (
    <div className="container mx-auto p-4 bg-white" style={{ width: "312px" }}>
      <small className="block">Calendar</small>
      <h1 className="text-2xl mb-4">{event.name}</h1>
      <small className="block">Event dates</small>
      <p className="mb-4">
        <time dateTime={event.startDate}>
          {format(parseISO(event.startDate), "MMM d, yyyy")}
        </time>
        {" - "}
        <time dateTime={event.endDate}>
          {format(parseISO(event.endDate), "MMM d, yyyy")}
        </time>
      </p>
      <div className="mb-4">
        <label htmlFor="name" className="block">
          Your Name:
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => {
            if (!userId) {
              throw new Error("user id is missing");
            }

            const value = e.target.value;
            setName(value);
            sendMessage({ name: value });
          }}
          className="border p-2 w-full"
        />
      </div>
      <div className="availability-grid">
        {Object.entries(groupedDays).map(([monthKey, monthDays]) => (
          <React.Fragment key={monthKey}>
            <div className="month-header">
              {format(monthDays[0], "MMMM yyyy")}
            </div>
            {monthDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const availableUsers = availability[dateStr] || [];
              const isSelected = availableUsers.includes(name);

              console.log(availableUsers, totalUsers);
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
                  onMouseUp={handleMouseUp}
                  title={availableUsers.join(", ")}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-4 event-url-container">
        <small className="block mb-2">Event URL</small>
        <input
          id="eventUrl"
          readOnly
          value={eventUrl}
          className="block w-full p-2 bg-gray-100 rounded pr-10"
        />
        <button
          onClick={() => navigator.clipboard.writeText(eventUrl)}
          className="copy-button"
          title="Copy to clipboard"
        >
          <CopyIcon />
        </button>
      </div>
    </div>
}

function eachDayOfInterval(from: Date, to: Date) {
  const days = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(d);
  }
  return days;
}
