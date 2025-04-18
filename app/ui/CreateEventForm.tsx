import { nanoid } from "nanoid";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { DayPicker } from "react-day-picker";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { getUserId } from "../getUserId";
import { CalendarEvent, isoDate } from "../schemas";
import { tryGetFirstDayOfTheWeek } from "../tryGetFirstDayOfTheWeek";
import { Container } from "./Container";
import "./react-day-picker.css";

export function CreateEventForm({
  onSubmit,
}: {
  onSubmit: (event: CalendarEvent) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  return (
    <Container>
      <form
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const parent =
              e.target instanceof HTMLElement && e.target.parentElement;
            const inNavigation = parent && parent.tagName === "NAV";

            if (inNavigation) {
              let button: HTMLButtonElement | null = null;

              if (e.key === "ArrowLeft")
                button = parent.querySelector(
                  ".rdp-button_previous",
                ) as HTMLButtonElement;

              if (e.key === "ArrowRight")
                button = parent.querySelector(
                  ".rdp-button_next",
                ) as HTMLButtonElement;

              if (button) {
                button.focus();
                button.click();
              }
            }
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const eventName = event.currentTarget.elements.namedItem(
            "eventName",
          ) as HTMLInputElement;

          const { from, to } = dateRange;
          if (!from || !to) {
            throw new Error("full date range is required");
          }

          setIsSubmitting(true);
          onSubmit({
            id: nanoid(),
            creator: getUserId(),
            endDate: isoDate(to),
            startDate: isoDate(from),
            name:
              eventName.value ||
              uniqueNamesGenerator({
                dictionaries: [adjectives, animals, colors],
                length: 3,
                separator: " ",
                style: "capital",
              }),
          }).finally(() => {
            setIsSubmitting(false);
          });
        }}
      >
        <h1 className="mb-4 text-2xl font-bold">Create a Calendar</h1>
        <div className="mb-4">
          <label className="mb-2 block" htmlFor="eventName">
            <span>Name your event</span>
            <small className="block text-neutral-500">
              or leave blank to generate a random name
            </small>
          </label>
          <input
            id="eventName"
            type="text"
            autoComplete="off"
            className="w-full border p-2"
          />
        </div>
        <div className="mb-4">
          <label className="mb-2 block">
            <span>Choose a date range</span>
            <small className="block text-neutral-500">
              what times should the guests consider?
            </small>
          </label>
          <DayPicker
            showOutsideDays
            disabled={{ before: new Date() }}
            fixedWeeks // avoid layout shift when changing months
            mode="range"
            selected={dateRange}
            timeZone="UTC"
            weekStartsOn={tryGetFirstDayOfTheWeek()}
            onSelect={(range) =>
              setDateRange(range || { from: undefined, to: undefined })
            }
          />
        </div>
        <button
          type="submit"
          className="btn btn-default w-full"
          style={{ borderWidth: "0.5em" }}
          disabled={
            !dateRange.from || !dateRange.to || dateRange.from >= dateRange.to
          }
          onClick={(event) => {
            event.currentTarget.textContent = "Creating...";
          }}
        >
          {isSubmitting ? "Creating..." : "Create Event"}
        </button>
      </form>
    </Container>
  );
}
