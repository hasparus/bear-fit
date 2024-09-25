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
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const parent =
              e.target instanceof HTMLElement && e.target.parentElement;
            const inNavigation = parent && parent.tagName === "NAV";

            if (inNavigation) {
              let button: HTMLButtonElement | null = null;

              if (e.key === "ArrowLeft")
                button = parent.querySelector(
                  ".rdp-button_previous"
                ) as HTMLButtonElement;

              if (e.key === "ArrowRight")
                button = parent.querySelector(
                  ".rdp-button_next"
                ) as HTMLButtonElement;

              if (button) {
                button.focus();
                button.click();
              }
            }
          }
        }}
      >
        <h1 className="text-2xl font-bold mb-4">Create a Calendar</h1>
        <div className="mb-4">
          <label htmlFor="eventName" className="block mb-2">
            <span>Name your event</span>
            <small className="block text-neutral-500">
              or leave blank to generate a random name
            </small>
          </label>
          <input type="text" id="eventName" className="border p-2 w-full" />
        </div>
        <div className="mb-4">
          <label htmlFor="calendar" className="block mb-2">
            <span>Choose a date range</span>
            <small className="block text-neutral-500">
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
          disabled={
            !dateRange.from || !dateRange.to || dateRange.from >= dateRange.to
          }
        >
          Create Event
        </button>
      </form>
    </Container>
  );
}

export default CreateEventForm;
