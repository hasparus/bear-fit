import { DayPicker, type DateRange } from "react-day-picker";
import { nanoid } from "nanoid";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { CalendarEvent, IsoDate } from "../schemas";
import { useState } from "react";

import "./react-day-picker.css";
import { Container } from "./Container";

export function CreateEventForm({
  createEvent,
}: {
  createEvent: (event: CalendarEvent) => void;
}) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  return (
    <Container>
      <form
        onSubmit={(event) => {
          const eventName = event.currentTarget.elements.namedItem(
            "eventName"
          ) as HTMLInputElement;

          const { from, to } = dateRange;
          if (!from || !to) {
            throw new Error("full date range is required");
          }

          createEvent({
            id: nanoid(),
            name:
              eventName.value ||
              uniqueNamesGenerator({
                dictionaries: [adjectives, animals, colors],
                separator: " ",
                style: "capital",
                length: 3,
              }),
            startDate: IsoDate(from),
            endDate: IsoDate(to),
          });
        }}
      >
        <h1 className="text-2xl font-bold mb-4">Create a Calendar</h1>
        <div className="mb-4">
          <label htmlFor="eventName" className="block mb-2">
            <span>Name your event</span>
            <small className="block text-gray-500">
              or leave blank to generate a random name
            </small>
          </label>
          <input type="text" id="eventName" className="border p-2 w-full" />
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
          // eslint-disable-next-line @hasparus/tailwindcss/no-custom-classname
          className="btn btn-default w-full hover:bg-neutral-100 "
          style={{ borderWidth: "0.5em" }}
          disabled={!dateRange.from || !dateRange.to}
        >
          Create Event
        </button>
      </form>
    </Container>
  );
}

export default CreateEventForm;
