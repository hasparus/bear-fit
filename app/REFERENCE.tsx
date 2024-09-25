// @ts-nocheck
/** @jsxImportSource https://esm.sh/react */

import { eachDayOfInterval, format, parseISO } from "https://esm.sh/date-fns";
import { nanoid } from "https://esm.sh/nanoid";
import React, { useCallback, useEffect, useState } from "https://esm.sh/react";
import { DayPicker } from "https://esm.sh/react-day-picker@8.7.1";
import { createRoot } from "https://esm.sh/react-dom/client";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "https://esm.sh/unique-names-generator@4.7.1";
import { z } from "https://esm.sh/zod";

// Tailwind CSS
const tailwindCSS =
  "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";

// Custom CSS for react-day-picker and availability grid
const customCSS = `
#root {
  font-family: Chicago, sans-serif;
}

.rdp {
  --rdp-cell-size: 40px;
  --rdp-accent-color: #0000ff;
  --rdp-background-color: #e7edff;
  --rdp-accent-color-dark: #3003e1;
  --rdp-background-color-dark: #180270;
  --rdp-outline: 2px solid var(--rdp-accent-color);
  --rdp-outline-selected: 3px solid var(--rdp-accent-color);
}

.rdp-vhidden {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  background: transparent;
  border: 0;
  -moz-appearance: none;
  -webkit-appearance: none;
  appearance: none;
  position: absolute !important;
  top: 0;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  overflow: hidden !important;
  clip: rect(1px, 1px, 1px, 1px) !important;
  border: 0 !important;
}

.rdp-button_reset {
  appearance: none;
  position: relative;
  margin: 0;
  padding: 0;
  cursor: default;
  color: inherit;
  background: none;
  font: Chicago, sans-serif;
  -moz-appearance: none;
  -webkit-appearance: none;
}

.rdp-button_reset:focus-visible {
  outline: none;
}

.rdp-button {
  border: 2px solid transparent;
}

.rdp-button[disabled]:not(.rdp-day_selected) {
  opacity: 0.25;
}

.rdp-button:not([disabled]) {
  cursor: pointer;
}

.rdp-button:focus-visible:not([disabled]) {
  color: inherit;
  background-color: var(--rdp-background-color);
  border: var(--rdp-outline);
}

.rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
  background-color: var(--rdp-background-color);
}

.rdp-months {
  display: flex;
}

.rdp-month {
  margin: 0 1em;
}

.rdp-month:first-child {
  margin-left: 0;
}

.rdp-month:last-child {
  margin-right: 0;
}

.rdp-table {
  margin: 0;
  max-width: calc(var(--rdp-cell-size) * 7);
  border-collapse: collapse;
}

.rdp-with_weeknumber .rdp-table {
  max-width: calc(var(--rdp-cell-size) * 8);
  border-collapse: collapse;
}

.rdp-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  text-align: left;
}

.rdp-multiple_months .rdp-caption {
  position: relative;
  display: block;
  text-align: center;
}

.rdp-caption_dropdowns {
  position: relative;
  display: inline-flex;
}

.rdp-caption_label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0 0.25em;
  white-space: nowrap;
  color: currentColor;
  border: 0;
  border: 2px solid transparent;
  font-family: Chicago, sans-serif;
  font-size: var(--rdp-caption-font-size);
  font-weight: bold;
}

.rdp-nav {
  white-space: nowrap;
}

.rdp-multiple_months .rdp-caption_start .rdp-nav {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
}

.rdp-multiple_months .rdp-caption_end .rdp-nav {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
}

.rdp-nav_button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rdp-cell-size);
  height: var(--rdp-cell-size);
  padding: 0.25em;
  border-radius: 6px;
}

.rdp-head {
  border: 0;
}

.rdp-head_row,
.rdp-row {
  height: 100%;
}

.rdp-head_cell {
  vertical-align: middle;
  font-size: 0.75em;
  font-weight: 700;
  text-align: center;
  height: 100%;
  height: var(--rdp-cell-size);
  padding: 0;
  text-transform: uppercase;
}

.rdp-tbody {
  border: 0;
}

.rdp-tfoot {
  margin: 0.5em;
}

.rdp-cell {
  width: var(--rdp-cell-size);
  height: 100%;
  height: var(--rdp-cell-size);
  padding: 0;
  text-align: center;
}

.rdp-weeknumber {
  font-size: 0.75em;
}

.rdp-weeknumber,
.rdp-day {
  font-family: Chicago, sans-serif;
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: var(--rdp-cell-size);
  max-width: var(--rdp-cell-size);
  height: var(--rdp-cell-size);
  margin: 0;
  border: 0;
  border-radius: 6px;
}

.rdp-day_today:not(.rdp-day_outside) {
  font-weight: bold;
}

.rdp-day_selected,
.rdp-day_selected:focus-visible,
.rdp-day_selected:hover {
  color: white;
  opacity: 1;
  background-color: var(--rdp-accent-color);
}

.rdp-day_outside {
  opacity: 0.5;
}

.rdp-day_selected:focus-visible {
  outline: var(--rdp-outline);
  outline-offset: 2px;
  z-index: 1;
}

.rdp:not([dir='rtl']) .rdp-day_range_start:not(.rdp-day_range_end) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.rdp:not([dir='rtl']) .rdp-day_range_end:not(.rdp-day_range_start) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.rdp[dir='rtl'] .rdp-day_range_start:not(.rdp-day_range_end) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.rdp[dir='rtl'] .rdp-day_range_end:not(.rdp-day_range_start) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.rdp-day_range_end.rdp-day_range_start {
  border-radius: 6px;
}

.rdp-day_range_middle {
  border-radius: 0;
}

button.rdp-day_range_start {
  background: linear-gradient(to right, var(--rdp-accent-color) 25%, hsl(from var(--rdp-accent-color) h s l / 0.8));
}

button.rdp-day_range_end {
  background: linear-gradient(to left, var(--rdp-accent-color) 25%, hsl(from var(--rdp-accent-color) h s l / 0.8));
}

button.rdp-day_range_middle {
  background: hsl(from var(--rdp-accent-color) h s l / 0.8);
}

.availability-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
}

.availability-grid .month-header {
  grid-column: 1 / -1;
  text-align: center;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.event-url-container {
  position: relative;
}

.copy-button {
  position: absolute;
  right: 8px;
  bottom: 7.5px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.copy-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
`;

const Event = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

type Event = z.infer<typeof Event>;

const AvailabilityDelta = z.object({
  userId: z.string(),
  name: z.string().optional(),
  add: z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

type AvailabilityDelta = z.infer<typeof AvailabilityDelta>;

interface Availability {
  [date: string]: string[];
}

const Availability = z.record(z.array(z.string()));

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 2V1H10V2H5ZM4.75 0C4.33579 0 4 0.335786 4 0.75V1H3.5C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H7V13H3.5C3.22386 13 3 12.7761 3 12.5V2.5C3 2.22386 3.22386 2 3.5 2H4V2.25C4 2.66421 4.33579 3 4.75 3H10.25C10.6642 3 11 2.66421 11 2.25V2H11.5C11.7761 2 12 2.22386 12 2.5V7H13V2.5C13 1.67157 12.3284 1 11.5 1H11V0.75C11 0.335786 10.6642 0 10.25 0H4.75ZM9 8.5C9 8.77614 8.77614 9 8.5 9C8.22386 9 8 8.77614 8 8.5C8 8.22386 8.22386 8 8.5 8C8.77614 8 9 8.22386 9 8.5ZM10.5 9C10.7761 9 11 8.77614 11 8.5C11 8.22386 10.7761 8 10.5 8C10.2239 8 10 8.22386 10 8.5C10 8.77614 10.2239 9 10.5 9ZM13 8.5C13 8.77614 12.7761 9 12.5 9C12.2239 9 12 8.77614 12 8.5C12 8.22386 12.2239 8 12.5 8C12.7761 8 13 8.22386 13 8.5ZM14.5 9C14.7761 9 15 8.77614 15 8.5C15 8.22386 14.7761 8 14.5 8C14.2239 8 14 8.22386 14 8.5C14 8.77614 14.2239 9 14.5 9ZM15 10.5C15 10.7761 14.7761 11 14.5 11C14.2239 11 14 10.7761 14 10.5C14 10.2239 14.2239 10 14.5 10C14.7761 10 15 10.2239 15 10.5ZM14.5 13C14.7761 13 15 12.7761 15 12.5C15 12.2239 14.7761 12 14.5 12C14.2239 12 14 12.2239 14 12.5C14 12.7761 14.2239 13 14.5 13ZM14.5 15C14.7761 15 15 14.7761 15 14.5C15 14.2239 14.7761 14 14.5 14C14.2239 14 14 14.2239 14 14.5C14 14.7761 14.2239 15 14.5 15ZM8.5 11C8.77614 11 9 10.7761 9 10.5C9 10.2239 8.77614 10 8.5 10C8.22386 10 8 10.2239 8 10.5C8 10.7761 8.22386 11 8.5 11ZM9 12.5C9 12.7761 8.77614 13 8.5 13C8.22386 13 8 12.7761 8 12.5C8 12.2239 8.22386 12 8.5 12C8.77614 12 9 12.2239 9 12.5ZM8.5 15C8.77614 15 9 14.7761 9 14.5C9 14.2239 8.77614 14 8.5 14C8.22386 14 8 14.2239 8 14.5C8 14.7761 8.22386 15 8.5 15ZM11 14.5C11 14.7761 10.7761 15 10.5 15C10.2239 15 10 14.7761 10 14.5C10 14.2239 10.2239 14 10.5 14C10.7761 14 11 14.2239 11 14.5ZM12.5 15C12.7761 15 13 14.7761 13 14.5C13 14.2239 12.7761 14 12.5 14C12.2239 14 12 14.2239 12 14.5C12 14.7761 12.2239 15 12.5 15Z"
        fill="currentColor"
      />
    </svg>
  );
}

let userId: string | null = null;
if (typeof window !== "undefined") {
  userId = window.localStorage.getItem("userId");
  if (!userId) {
    userId = nanoid();
    window.localStorage.setItem("userId", userId);
  }
}

function App() {
  const [event, setEvent] = useState<Event | null>(null);
  const [name, setName] = useState("");
  const [eventName, setEventName] = useState("");
  const [availability, setAvailability] = useState<Availability>({});
  const [isDragging, setIsDragging] = useState(false);
  const [lastToggled, setLastToggled] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const [eventId, setEventId] = useState(
    new URLSearchParams(window.location.search).get("id")
  );

  function sendMessage(delta: Omit<AvailabilityDelta, "userId">) {
    if (!eventId) {
      throw new Error("No event ID");
    }
    if (!userId) {
      throw new Error("No user ID");
    }

    const body = {
      eventId,
      delta: {
        userId,
        ...delta,
      } satisfies AvailabilityDelta,
    };

    fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .catch(console.error)
      .then(async (res) => {
        const json = await res?.json();
        if (json?.success) {
          setAvailability(json.availability);
        }
      });
  }

  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get("id");
    if (eventId) {
      fetch(`/api/event?id=${eventId}`)
        .then((response) => response.json())
        .then(setEvent);
    }
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`/api/sse?id=${eventId}`);
    eventSource.onmessage = (e) => {
      const delta: AvailabilityDelta = AvailabilityDelta.parse(e.data);
      console.log("sse ->", e.data);

      setAvailability((prev) => {
        const newAvailability = { ...prev };
        if (delta.add) {
          delta.add.forEach((date) => {
            if (!newAvailability[date]) newAvailability[date] = [];
            if (!newAvailability[date].includes(delta.userId)) {
              newAvailability[date].push(delta.userId);
            }
          });
        }
        if (delta.remove) {
          delta.remove.forEach((date) => {
            if (newAvailability[date]) {
              newAvailability[date] = newAvailability[date].filter(
                (user) => user !== delta.userId
              );
            }
          });
        }
        return newAvailability;
      });
    };

    return () => eventSource.close();
  }, [eventId]);

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateRange.from || !dateRange.to) return;

    const randomName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      style: "capital",
      separator: " ",
    });

    const eventId = nanoid();
    const newEvent: Event = {
      id: eventId,
      name: eventName || randomName,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    };

    setEventId(eventId);
    setEvent(newEvent);
    window.history.pushState({}, "", `?id=${newEvent.id}`);

    let ok = true;

    try {
      const response = await fetch("/api/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newEvent),
      });

      if (response.ok) {
      }
    } catch (e) {
      console.error(e);
      ok = false;
    }

    if (!ok) {
      setEvent(null);
      setEventId(null);
    }
  };

  const toggleAvailability = useCallback(
    async (date: string) => {
      console.log("toggle", date);
      if (!event) return;

      const newAvailability = { ...availability };
      const delta: AvailabilityDelta = { userId };

      if (!newAvailability[date] || !newAvailability[date].includes(name)) {
        if (!newAvailability[date]) newAvailability[date] = [];
        newAvailability[date].push(userId);
        delta.add = [date];
      } else {
        newAvailability[date] = newAvailability[date].filter(
          (user) => user !== name
        );
        if (newAvailability[date].length === 0) delete newAvailability[date];
        delta.remove = [date];
      }

      sendMessage(delta);

      setAvailability(newAvailability);
      setLastToggled(date);
    },
    [name, event, availability]
  );

  const handleMouseDown = (date: string) => {
    setIsDragging(true);
    toggleAvailability(date);
  };

  const handleMouseEnter = (date: string) => {
    if (isDragging && lastToggled !== date) {
      toggleAvailability(date);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setLastToggled(null);
  };

  if (!eventId) {
    return (
      <form
        className="container mx-auto p-4 bg-white"
        style={{ width: "312px" }}
        onSubmit={createEvent}
      >
        <h1 className="text-2xl font-bold mb-4">Create a Calendar</h1>
        <div className="mb-4">
          <label htmlFor="eventName" className="block mb-2">
            <span>Name your event</span>
            <small className="block text-gray-500">
              or leave blank to generate a random name
            </small>
          </label>
          <input
            type="text"
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="calendar" className="block mb-2">
            <span>Choose a date range</span>
            <small className="block text-gray-500">
              what times should the guests consider?
            </small>
          </label>
          <DayPicker
            id="calendar"
            mode="range"
            selected={dateRange}
            onSelect={(range) =>
              setDateRange(range || { from: undefined, to: undefined })
            }
            disabled={{ before: new Date() }}
          />
        </div>
        <button
          type="submit"
          className="btn btn-default w-full hover:bg-neutral-200"
          style={{ borderWidth: "0.5em" }}
          disabled={!dateRange.from || !dateRange.to}
        >
          Create Event
        </button>
      </form>
    );
  }

  if (!event) return null;

  const days = eachDayOfInterval({
    start: parseISO(event.startDate),
    end: parseISO(event.endDate),
  });

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
  );
}

function client() {
  createRoot(document.getElementById("root")).render(<App />);
}

if (typeof document !== "undefined") {
  client();
}

export default async function server(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path || (path === "/" && request.method === "GET")) {
    return new Response(
      `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Calendar</title>
          <link href="${tailwindCSS}" rel="stylesheet">
          <link rel="stylesheet" href="https://unpkg.com/@sakun/system.css">
          <style>${customCSS}</style>
        </head>
        <body>
          <div id="root"></div>
          <script src="https://esm.town/v/std/catch"></script>
          <script type="module" src="${import.meta.url}"></script>
        </body>
        </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  const { sqlite } = await import("https://esm.town/v/std/sqlite?v=6");

  await sqlite.batch([
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_start TEXT NOT NULL,
      date_end TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS availabilities (
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id)
    )`,
  ]);

  const ApiSchema = {
    "/api/event": {
      POST: {
        body: z.object({
          id: z.string(),
          name: z.string(),
          date: z.string(),
          date_end: z.string(),
        }),
      },
      GET: {
        query: z.object({
          eventId: z.string(),
        }),
      },
    },
    "/api/availability": {
      POST: {
        body: z.object({
          eventId: z.string(),
          delta: AvailabilityDelta,
        }),
      },
    },
  };

  type ApiSchema = z.infer<typeof ApiSchema>;

  switch (path) {
    case "/api/event": {
      if (request.method === "GET") {
        const searchParams = ApiSchema["/api/event"].GET.query.parse(
          Object.fromEntries(url.searchParams.entries())
        );
        const { eventId } = searchParams;

        const result = await sqlite.execute({
          sql: "SELECT id, name, date_start, date_end FROM events WHERE id = ? LIMIT 1",
          args: [eventId],
        });
        const event = result.rows.length ? result.rows[0] : null;
        if (event) {
          const availability = await sqlite.execute({
            sql: "SELECT user_id, date FROM availabilities WHERE event_id = ?",
            args: [eventId],
          });
          return new Response(JSON.stringify({ event, availability }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      } else {
        const event = await request.json();
        await sqlite.execute({
          sql: "INSERT INTO events (id, name, date_start, date_end) VALUES (?, ?, ?, ?)",
          args: [event.id, event.name, event.date, event.date_end],
        });
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    case "/api/availability": {
      if (request.method === "POST") {
        const { eventId, delta } = ApiSchema[
          "/api/availability"
        ].POST.body.parse(await request.json());

        console.log("update:", eventId, delta);
        const queries: { sql: string; args: string[][] }[] = [];

        if (delta.remove && delta.remove.length > 0) {
          queries.push({
            sql: `DELETE FROM availabilities WHERE (event_id, user_id, date) IN (${delta.remove
              .map(() => "(?, ?, ?)")
              .join(", ")})`,
            args: delta.remove.map((date: string) => [
              eventId,
              delta.userId,
              date,
            ]),
          });
        }

        if (delta.add && delta.add.length > 0) {
          queries.push({
            sql: `INSERT INTO availabilities (event_id, user_id, date) VALUES ${delta.add
              .map(() => "(?, ?, ?)")
              .join(", ")}`,
            args: delta.add.map((date: string) => [
              eventId,
              delta.userId,
              date,
            ]),
          });
        }

        for (const query of queries) {
          await sqlite.batch(query);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    case "/api/sse": {
      const eventId = url.searchParams.get("id");
      if (eventId) {
        const headers = new Headers({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const stream = new ReadableStream({
          async start(controller) {
            const availability = await sqlite.get(
              `SELECT * FROM availabilities WHERE event_id = ?`,
              [eventId]
            );

            const initialDelta: AvailabilityDelta = {
              userId: "((server))",
              add: Object.entries(availability)
                .flatMap(([date, users]) =>
                  users.map((user) => ({ date, user }))
                )
                .map(({ date, user }) => `${date}:${user}`),
            };
            controller.enqueue(`data: ${JSON.stringify(initialDelta)}\n\n`);

            // Clean up the interval when the connection is closed
            request.signal.addEventListener("abort", () => {
              clearInterval(interval);
            });
          },
        });

        return new Response(stream, { headers });
      }
    }

    default:
      throw new Error("path not found");
  }
}
