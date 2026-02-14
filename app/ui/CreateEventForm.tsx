import Clarity from "@microsoft/clarity";
import { nanoid } from "nanoid";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { getUserId } from "../getUserId";
import { CalendarEvent, isoDate } from "../schemas";
import { Container } from "./Container";
import { DateRangePicker, handleCalendarArrowKeys } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";

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
        onKeyDown={handleCalendarArrowKeys}
        onSubmit={(event) => {
          event.preventDefault();
          const eventName = event.currentTarget.elements.namedItem(
            "eventName",
          ) as HTMLInputElement;

          const { from, to } = requireValidDateRange(dateRange);

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
            Clarity.event("event-created");
            setIsSubmitting(false);
          });
        }}
      >
        <h1 className="mb-4 font-bold leading-[1.3333]">Create a Calendar</h1>
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
            className="w-full border pt-2 pr-2 pb-2 pl-[5px]"
          />
        </div>
        <div className="mb-4">
          <label className="mb-2 block">
            <span>Choose a date range</span>
            <small className="block text-neutral-500">
              what times should the guests consider?
            </small>
          </label>
          <DateRangePicker
            disabled={{ before: new Date() }}
            onSelect={setDateRange}
            selected={dateRange}
          />
        </div>
        <button
          type="submit"
          className="btn btn-default w-full"
          disabled={!isValidDateRange(dateRange)}
          style={{ borderWidth: "0.5em" }}
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
